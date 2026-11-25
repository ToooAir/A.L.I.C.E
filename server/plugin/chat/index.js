'use strict';
// LLM chat replies when Alice is mentioned. Disabled unless config.chat.provider names a provider in ./providers.
//
// A provider is a module exporting `createProvider(chatConfig)`; see providers/README.md for the interface.
const path = require('node:path');
const {SYSTEM_PROMPT, MEMORY_PROMPT, LINES} = require('./persona');
const {localDay} = require('../activity');
const {createHistoryTools, compact, nameOf} = require('./history');

const CONTEXT_WINDOW_MINUTES = 30; // earlier messages within this window are sent as context...
const CONTEXT_MESSAGES = 20;       // ...up to this many
const MAX_CONTEXT_CHARS = 300;     // per earlier message
const MAX_PROMPT_CHARS = 600;      // the message that mentions Alice
const MAX_REPLY_TOKENS = 300;
const MAX_NOTES_TOKENS = 200;
const MAX_TOOL_CALLS = 3;          // history lookups per chat
const MIN_MEMORABLE_CHARS = 6;     // shorter messages ("嗨", "早安") don't trigger a memory update
const MAX_NOTES_CHARS = 1000;      // chat_memory.notes column size
const NO_NOTES = '（無）';
const DISCORD_MESSAGE_LIMIT = 2000;

// Models sometimes copy the transcript format ("[09:22] 愛麗絲: ...") or wrap the whole reply in quotes.
function cleanReply(text){
    let reply = text.trim().replace(/^(\[\d{1,2}:\d{2}\]\s*)?(愛麗絲|Alice)\s*[:：]\s*/i, '').trim();
    if(/^「[^「」]*」$/.test(reply)) reply = reply.slice(1, -1).trim();
    return reply;
}

// Providers return a string, or {text, toolCalls} when they support tools.
const asText = result => typeof result === 'string' ? result : (result?.text ?? '');

const pad = n => String(n).padStart(2, '0');
const clock = date => `${pad(date.getHours())}:${pad(date.getMinutes())}`; // process timezone (Asia/Taipei under Docker)

function describeGap(ms){
    const minutes = Math.round(ms / 60000);
    if(minutes < 60) return `${minutes} 分鐘`;
    if(minutes < 48 * 60) return `${Math.round(minutes / 60)} 小時`;
    return `${Math.round(minutes / 1440)} 天`;
}

// memory: optional {read(guildId, userId) -> notes|null, save(guildId, userId, notes)}
function createChat({provider, botId, memory = null, dailyLimit = 300, cooldownSeconds = 20, now = Date.now}){
    const lastUse = new Map(); // userId -> timestamp
    let usage = {day: null, count: 0};

    // Alice is addressed by a mention, by mentioning her managed bot role (Discord's autocomplete sometimes
    // picks it instead of the user), or by a reply to one of her text messages even with the ping turned off.
    // Replies to her embeds (deletion logs, /rank, search results) don't count: those aren't conversation.
    async function isAddressed(message){
        const id = botId();
        const mentions = message.mentions;
        if(mentions?.users?.has(id)) return true;
        const botRole = message.guild?.members?.me?.roles?.botRole;
        if(botRole && mentions?.roles?.has(botRole.id)) return true;
        if(mentions?.repliedUser?.id !== id) return false;
        const referenced = await message.fetchReference?.().catch(() => null);
        return Boolean(referenced?.content);
    }

    // Text of a message; for embed-only messages (Alice's logs and command results) the embed's title and description.
    const textOf = m => m.content
        || (m.embeds ?? []).map(e => [e.title, e.description].filter(Boolean).join(' ')).filter(Boolean).join(' ');
    const speaker = nameOf;
    const isAlice = m => m.author.id === botId();
    // "[HH:MM] name（回覆 X）: text". Alice's chat replies always reply to a message, so her messages without a
    // reference are keyword replies, greetings or embeds: labelled 自動回覆 so the model doesn't take them as its own words.
    // `known` maps message ids to messages, to name the person a reply points at.
    function lineOf(m, limit, known){
        const name = !isAlice(m) ? speaker(m) : m.reference ? '愛麗絲' : '自動回覆';
        const target = known.get(m.reference?.messageId)
            ?? (m.mentions?.repliedUser?.id === botId() ? {author: {id: botId()}} : null);
        const replyTo = target ? `（回覆 ${isAlice(target) ? '愛麗絲' : speaker(target)}）` : '';
        const text = compact(isAlice(m) ? textOf(m) : m.cleanContent).slice(0, limit);
        return `[${clock(new Date(m.createdTimestamp))}] ${name}${replyTo}: ${text}`;
    }

    // Whether the message says enough about the person to be worth a memory update.
    const memorable = message => compact(message.cleanContent).replace(/@\S+/g, '').replace(/\s/g, '').length >= MIN_MEMORABLE_CHARS;

    // What the channel was talking about: recent messages, plus the message being replied to.
    async function gatherContext(message){
        const fetched = await message.channel.messages.fetch({limit: CONTEXT_MESSAGES, before: message.id}).catch(() => null);
        const older = fetched ? [...fetched.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp) : [];
        const cutoff = message.createdTimestamp - CONTEXT_WINDOW_MINUTES * 60000;
        const recent = older.filter(m => m.createdTimestamp >= cutoff && textOf(m)).reverse();

        let referenced = null;
        const referencedId = message.reference?.messageId;
        if(referencedId && !recent.some(m => m.id === referencedId)){
            referenced = await message.fetchReference?.().catch(() => null) ?? null;
        }
        const known = new Map([...older, referenced].filter(Boolean).map(m => [m.id, m]));
        return {recent, previous: older[0] ?? null, referenced, known};
    }

    // The channel's recent messages go into the system prompt as background; only the message being
    // answered is sent as the user turn, so the model doesn't answer everyone in the channel at once.
    function buildSystem(message, {recent, previous, referenced, known}, notes){
        const sent = new Date(message.createdTimestamp);
        let system = `${SYSTEM_PROMPT}\n\n【現在】台灣時間 ${localDay(sent)} ${clock(sent)}`;
        if(notes) system += `\n\n【你對「${speaker(message)}」的印象筆記】\n${notes}`;
        const background = [...(referenced && textOf(referenced) ? [referenced] : []), ...recent];
        if(background.length){
            system += `\n\n【頻道最近對話（背景）】\n${background.map(m => lineOf(m, MAX_CONTEXT_CHARS, known)).join('\n')}`;
        } else if(previous){
            system += `\n\n聊天室在這之前已經安靜了大約 ${describeGap(message.createdTimestamp - previous.createdTimestamp)}。`;
        }
        return system;
    }

    async function readNotes(message){
        if(!memory) return null;
        try {
            return await memory.read(message.guildId, message.author.id);
        } catch(error) {
            console.error('[chat] memory read failed', error);
            return null;
        }
    }

    // Ask the model to fold the latest exchange into its notes about this person.
    async function updateNotes(message, notes, reply){
        if(!memory) return;
        try {
            const input = `舊筆記：\n${notes ?? NO_NOTES}\n\n最新對話：\n${speaker(message)}: ${compact(message.cleanContent).slice(0, MAX_PROMPT_CHARS)}\n愛麗絲: ${reply}`;
            const updated = asText(await provider.generate({system: MEMORY_PROMPT, messages: [{role: 'user', content: input}], maxTokens: MAX_NOTES_TOKENS}))
                .replace(/\*\*|__/g, '').trim(); // small models add markdown bold despite the prompt
            // "Nothing worth noting" never wipes existing notes; members clear theirs with /chat forget.
            if(!updated || updated === NO_NOTES || updated === notes) return;
            await memory.save(message.guildId, message.author.id, updated.slice(0, MAX_NOTES_CHARS));
        } catch(error) {
            console.error('[chat] memory update failed', error);
        }
    }

    // Get {text, usedTools}. Providers that support tools may look up channel history first.
    async function converse(message, system, messages){
        if(!provider.supportsTools) return {text: asText(await provider.generate({system, messages, maxTokens: MAX_REPLY_TOKENS})), usedTools: false};

        const tools = createHistoryTools({channel: message.channel, beforeId: message.id, now: message.createdTimestamp, botId: botId(), provider});
        const conversation = [...messages];
        let calls = 0;
        for(;;){
            const allowTools = calls < MAX_TOOL_CALLS;
            const result = await provider.generate({system, messages: conversation, maxTokens: MAX_REPLY_TOKENS, ...(allowTools && {tools: tools.definitions})});
            const toolCalls = typeof result === 'object' ? result?.toolCalls ?? [] : [];
            if(!allowTools || toolCalls.length === 0) return {text: asText(result), usedTools: calls > 0};

            conversation.push({role: 'assistant', content: asText(result), toolCalls});
            for(const call of toolCalls){
                calls++;
                let content;
                if(calls > MAX_TOOL_CALLS){
                    content = '已達本次查詢上限，請根據目前的資訊回答';
                } else {
                    content = await tools.run(call.name, call.input).catch(error => {
                        console.error('[chat] tool failed', call.name, error);
                        return '查詢失敗，請根據目前的資訊回答';
                    });
                }
                conversation.push({role: 'tool', toolCallId: call.id, name: call.name, content});
            }
        }
    }

    // Returns true when the message was handled as a chat (the caller should skip other replies).
    async function handle(message){
        if(!provider || !(await isAddressed(message))) return false;

        const last = lastUse.get(message.author.id) ?? 0;
        if(now() - last < cooldownSeconds * 1000){
            message.react('⏳').catch(() => {});
            return true;
        }
        lastUse.set(message.author.id, now());

        const today = localDay(new Date(now()));
        if(usage.day !== today) usage = {day: today, count: 0};
        if(usage.count >= dailyLimit){
            await send(message, LINES.dailyLimit);
            return true;
        }
        usage.count++;

        message.channel.sendTyping?.().catch(() => {});
        const [context, notes] = await Promise.all([gatherContext(message), readNotes(message)]);
        const messages = [{role: 'user', content: lineOf(message, MAX_PROMPT_CHARS, context.known)}];

        let reply, usedTools = false;
        try {
            ({text: reply, usedTools} = await converse(message, buildSystem(message, context, notes), messages));
            reply = cleanReply(reply);
        } catch(error) {
            console.error('[chat]', error);
        }
        await send(message, reply || LINES.error);
        // After a history lookup the reply is about other people, so it would pollute this person's notes.
        if(reply && !usedTools && memorable(message)) await updateNotes(message, notes, reply);
        return true;
    }

    // Model output never pings anyone except the person Alice is replying to.
    const send = (message, content) => message.reply({
        content: content.slice(0, DISCORD_MESSAGE_LIMIT),
        allowedMentions: {parse: [], repliedUser: true},
    }).catch(error => console.error('[chat] send failed', error));

    return {handle, usage: () => ({...usage})};
}

function loadProvider(chatConfig){
    if(!chatConfig?.provider) return null;
    const {createProvider} = require(path.join(__dirname, 'providers', chatConfig.provider));
    return createProvider(chatConfig);
}

module.exports = {createChat, loadProvider, cleanReply};
