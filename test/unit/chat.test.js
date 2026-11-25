'use strict';
const {src} = require('../helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const {djs, BOT_ID, fakePool, tick} = require('../helpers/fakes');

const pool = fakePool();
const {createChat, loadProvider} = src('plugin/chat');
const {SYSTEM_PROMPT, MEMORY_PROMPT, LINES} = src('plugin/chat/persona');

const NOW = Date.parse('2026-11-25T06:00:00Z'); // 14:00 Taipei
const MIN = 60000;

// A provider that records requests. `reply` answers chat requests; `notes` answers memory updates.
function fakeProvider({reply = '你好，我是愛麗絲。', notes = '- 喜歡冬天'} = {}) {
    const requests = [];
    return {
        requests, reply, notes,
        chatRequests: () => requests.filter(r => r.system !== MEMORY_PROMPT),
        memoryRequests: () => requests.filter(r => r.system === MEMORY_PROMPT),
        async generate(request) {
            requests.push(request);
            const answer = request.system === MEMORY_PROMPT ? this.notes : this.reply;
            if (answer instanceof Error) throw answer;
            return answer;
        },
    };
}

function fakeMemory(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
        store,
        read: async (guildId, userId) => store.get(`${guildId}/${userId}`) ?? null,
        save: async (guildId, userId, notes) => { store.set(`${guildId}/${userId}`, notes); },
    };
}

let nextId = 100;
// A channel message `minutesAgo` before NOW.
function channelMessage(authorId, content, minutesAgo, name = 'user' + authorId) {
    const at = NOW - minutesAgo * MIN;
    return {id: String(nextId++), content, cleanContent: content, createdTimestamp: at, createdAt: new Date(at),
        author: {id: authorId, username: name}, member: {displayName: name}};
}

function mention(content, {authorId = '11', name = '小明', mentionsAlice = true, history = [], reference = null} = {}) {
    const replies = [], reactions = [];
    const message = {
        ...channelMessage(authorId, content, 0, name),
        cleanContent: content.replaceAll(`<@${BOT_ID}>`, '@愛麗絲'),
        guildId: '1',
        mentions: {users: new djs.Collection(mentionsAlice ? [[BOT_ID, {}]] : [])},
        reference: reference ? {messageId: reference.id} : null,
        fetchReference: async () => reference,
        channel: {
            sendTyping: async () => {},
            // Discord returns newest first
            messages: {fetch: async () => new djs.Collection([...history].reverse().map(m => [m.id, m]))},
        },
        reply: async payload => { replies.push(payload); return {}; },
        react: async emoji => { reactions.push(emoji); },
    };
    return {message, replies, reactions};
}

function setup(options = {}) {
    let clock = NOW;
    const provider = options.provider === undefined ? fakeProvider() : options.provider;
    const chat = createChat({provider, botId: () => BOT_ID, now: () => clock, cooldownSeconds: 0, ...options});
    return {chat, provider, advance: ms => { clock += ms; }, setClock: iso => { clock = Date.parse(iso); }};
}

test('sends the recent conversation with times and speakers', async () => {
    const {chat, provider} = setup();
    const history = [
        channelMessage('12', '三天前的話題', 3 * 1440), // outside the 30-minute window
        channelMessage('12', '今天好冷', 12, '阿華'),
        channelMessage(BOT_ID, '請注意保暖。', 11),
        channelMessage('13', '', 5), // attachment only
        channelMessage('14', '想喝熱可可', 2, '小美'),
    ];
    const {message, replies} = mention(`<@${BOT_ID}> 妳喜歡冬天嗎？`, {history});

    assert.equal(await chat.handle(message), true);
    const [request] = provider.chatRequests();
    assert.deepEqual(request.messages, [
        {role: 'user', content: '[13:48] 阿華: 今天好冷'},
        {role: 'assistant', content: '請注意保暖。'},
        {role: 'user', content: '[13:58] 小美: 想喝熱可可'},
        {role: 'user', content: '[14:00] 小明: @愛麗絲 妳喜歡冬天嗎？'},
    ]);
    assert.ok(request.system.startsWith(SYSTEM_PROMPT));
    assert.match(request.system, /【現在】台灣時間 2026-11-25 14:00/);
    assert.doesNotMatch(request.system, /安靜/);
    assert.equal(replies[0].content, '你好，我是愛麗絲。');
});

test('tells Alice when the channel had gone quiet', async () => {
    const {chat, provider} = setup();
    await chat.handle(mention(`<@${BOT_ID}> 有人嗎`, {history: [channelMessage('12', '晚安', 5 * 60)]}).message);
    const [request] = provider.chatRequests();
    assert.equal(request.messages.length, 1);
    assert.match(request.system, /已經安靜了大約 5 小時/);
});

test('includes the message being replied to even when it is older', async () => {
    const {chat, provider} = setup();
    const old = channelMessage('12', '我明天要考試', 3 * 60, '阿華');
    await chat.handle(mention(`<@${BOT_ID}> 幫他加油`, {reference: old}).message);
    assert.deepEqual(provider.chatRequests()[0].messages.map(m => m.content), ['[11:00] 阿華: 我明天要考試', '[14:00] 小明: @愛麗絲 幫他加油']);
});

test('remembers people across chats', async (t) => {
    const memory = fakeMemory();
    const {chat, provider} = setup({memory});

    await t.test('first chat: no notes yet, then notes are written', async () => {
        await chat.handle(mention(`<@${BOT_ID}> 我超喜歡冬天`).message);
        assert.doesNotMatch(provider.chatRequests()[0].system, /【你對/);
        const [update] = provider.memoryRequests();
        assert.match(update.messages[0].content, /舊筆記：\n（無）/);
        assert.match(update.messages[0].content, /小明: @愛麗絲 我超喜歡冬天\n愛麗絲: 你好，我是愛麗絲。/);
        assert.equal(memory.store.get('1/11'), '- 喜歡冬天');
    });

    await t.test('next chat: notes are in the system prompt', async () => {
        await chat.handle(mention(`<@${BOT_ID}> 又是我，今天考完試了`).message);
        assert.match(provider.chatRequests()[1].system, /【你對「小明」的印象筆記】\n- 喜歡冬天/);
        assert.match(provider.memoryRequests()[1].messages[0].content, /舊筆記：\n- 喜歡冬天/);
    });

    await t.test('notes belong to one person', async () => {
        await chat.handle(mention(`<@${BOT_ID}> 我是別人`, {authorId: '12', name: '阿華'}).message);
        assert.doesNotMatch(provider.chatRequests()[2].system, /【你對/);
    });
});

test('memory updates never wipe or overflow notes', async (t) => {
    t.mock.method(console, 'error', () => {});
    const memory = fakeMemory({'1/11': '- 喜歡貓'});
    const {chat, provider} = setup({memory});
    let saves = 0;
    const save = memory.save;
    memory.save = async (...args) => { saves++; return save(...args); };

    for (const notes of ['（無）', '', '- 喜歡貓', new Error('API down')]) {
        provider.notes = notes;
        await chat.handle(mention(`<@${BOT_ID}> 我今天去看了電影`).message);
    }
    assert.equal(saves, 0, 'nothing / unchanged / failed updates are not saved');
    assert.equal(memory.store.get('1/11'), '- 喜歡貓');

    provider.notes = '- ' + '長'.repeat(2000);
    await chat.handle(mention(`<@${BOT_ID}> 我今天去看了電影`).message);
    assert.equal(memory.store.get('1/11').length, 1000);
});

test('short greetings do not spend a memory update', async () => {
    const {chat, provider} = setup({memory: fakeMemory()});
    for (const text of ['嗨', '早安', '在嗎？  ']) await chat.handle(mention(`<@${BOT_ID}> ${text}`).message);
    assert.equal(provider.chatRequests().length, 3);
    assert.equal(provider.memoryRequests().length, 0);
});

test('links and custom emoji are shortened before reaching the model', async () => {
    const {chat, provider} = setup();
    await chat.handle(mention(`<@${BOT_ID}> 看這個 https://example.com/very/long/path?x=1   <:pepe:123456789012345678>`).message);
    assert.equal(provider.chatRequests()[0].messages[0].content, '[14:00] 小明: @愛麗絲 看這個 [連結] :pepe:');
});

test('chat still works when memory is unavailable', async (t) => {
    t.mock.method(console, 'error', () => {});
    const {chat} = setup({memory: {read: async () => { throw new Error('table missing'); }, save: async () => { throw new Error('table missing'); }}});
    const {message, replies} = mention(`<@${BOT_ID}> 嗨`);
    await chat.handle(message);
    assert.equal(replies[0].content, '你好，我是愛麗絲。');
});

test('model output can only ping the person being replied to', async () => {
    const {chat, provider} = setup();
    provider.reply = '@everyone <@&1> <@12> 大家好';
    const {message, replies} = mention(`<@${BOT_ID}> 打個招呼`);
    await chat.handle(message);
    assert.deepEqual(replies[0].allowedMentions, {parse: [], repliedUser: true});
});

test('long input and output are cut to size', async () => {
    const {chat, provider} = setup();
    provider.reply = '長'.repeat(3000);
    const {message, replies} = mention('字'.repeat(5000), {history: [channelMessage('12', '長'.repeat(5000), 1)]});
    await chat.handle(message);
    const [earlier, current] = provider.chatRequests()[0].messages;
    assert.ok(earlier.content.length <= 300 + '[13:59] user12: '.length);
    assert.ok(current.content.length <= 600 + '[14:00] 小明: '.length);
    assert.equal(replies[0].content.length, 2000);
});

test('messages that do not mention Alice are left for keyword replies', async () => {
    const {chat, provider} = setup();
    assert.equal(await chat.handle(mention('大家好', {mentionsAlice: false}).message), false);
    assert.equal(provider.requests.length, 0);
});

test('without a provider the feature is off', async () => {
    const {chat} = setup({provider: null});
    assert.equal(await chat.handle(mention(`<@${BOT_ID}> 在嗎`).message), false);
    assert.equal(loadProvider(undefined), null);
    assert.equal(loadProvider({provider: ''}), null);
});

test('per-user cooldown', async () => {
    const {chat, provider, advance} = setup({cooldownSeconds: 20});
    await chat.handle(mention(`<@${BOT_ID}> 一`).message);
    const second = mention(`<@${BOT_ID}> 二`);
    assert.equal(await chat.handle(second.message), true, 'handled, so no keyword reply either');
    await tick();
    assert.deepEqual(second.reactions, ['⏳']);
    await chat.handle(mention(`<@${BOT_ID}> 別人`, {authorId: '12'}).message);
    advance(20_000);
    await chat.handle(mention(`<@${BOT_ID}> 三`).message);
    assert.equal(provider.chatRequests().length, 3);
});

test('daily limit resets at midnight Taipei time', async () => {
    const {chat, provider, setClock} = setup({dailyLimit: 2});
    for (const user of ['1', '2']) await chat.handle(mention(`<@${BOT_ID}> 嗨`, {authorId: user}).message);
    const limited = mention(`<@${BOT_ID}> 嗨`, {authorId: '3'});
    await chat.handle(limited.message);
    assert.equal(limited.replies[0].content, LINES.dailyLimit);
    assert.equal(provider.chatRequests().length, 2);

    setClock('2026-11-25T16:00:00Z'); // 00:00 Taipei, next day
    await chat.handle(mention(`<@${BOT_ID}> 早安`, {authorId: '3'}).message);
    assert.equal(provider.chatRequests().length, 3);
    assert.deepEqual(chat.usage(), {day: '2026-11-26', count: 1});
});

test('provider failures and empty replies answer with a fallback line', async (t) => {
    t.mock.method(console, 'error', () => {});
    const memory = fakeMemory();
    const {chat, provider} = setup({memory});
    for (const reply of [new Error('API down'), '   ']) {
        provider.reply = reply;
        const {message, replies} = mention(`<@${BOT_ID}> 在嗎`);
        await chat.handle(message);
        assert.equal(replies[0].content, LINES.error);
    }
    assert.equal(provider.memoryRequests().length, 0, 'no memory update without a real reply');
});

test('context still works when message history cannot be read', async () => {
    const {chat, provider} = setup();
    const {message} = mention(`<@${BOT_ID}> 嗨`);
    message.channel.messages.fetch = async () => { throw new Error('Missing Access'); };
    await chat.handle(message);
    assert.equal(provider.chatRequests()[0].messages.length, 1);
});

test('/chat memory and /chat forget are private and per person', async () => {
    const chatCommand = src('command/chat');
    const run = async (subcommand) => {
        const replies = [];
        await chatCommand.execute({guildId: '1', user: {id: '11'}, options: {getSubcommand: () => subcommand}, reply: async p => replies.push(p)});
        return replies[0];
    };

    pool.respond = () => [{notes: '- 喜歡冬天'}];
    let reply = await run('memory');
    assert.equal(reply.content, '愛麗絲記得的事：\n- 喜歡冬天');
    assert.equal(reply.flags, djs.MessageFlags.Ephemeral);
    assert.deepEqual(pool.calls.at(-1).params, ['1', '11']);

    pool.respond = () => [];
    assert.equal((await run('memory')).content, '愛麗絲目前還沒有關於你的記憶');

    pool.respond = () => ({affectedRows: 1});
    reply = await run('forget');
    assert.match(reply.content, /已經忘記了/);
    assert.equal(reply.flags, djs.MessageFlags.Ephemeral);
    pool.respond = () => ({affectedRows: 0});
    assert.match((await run('forget')).content, /本來就沒有/);
});

test('markdown bold is removed from memory notes', async () => {
    const memory = fakeMemory();
    const {chat, provider} = setup({memory});
    provider.notes = '- **興趣**：迷因圖';
    await chat.handle(mention(`<@${BOT_ID}> 我最近超喜歡看迷因圖`).message);
    assert.equal(memory.store.get('1/11'), '- 興趣：迷因圖');
});

test('replies that copy the transcript format or are wrapped in quotes are cleaned', () => {
    const {cleanReply} = src('plugin/chat');
    assert.equal(cleanReply('[09:22] 愛麗絲: 當然記得。'), '當然記得。');
    assert.equal(cleanReply('愛麗絲：你好'), '你好');
    assert.equal(cleanReply('「……迷因？那是神聖術嗎？」'), '……迷因？那是神聖術嗎？');
    assert.equal(cleanReply('「迷因」是什麼？我想知道「神聖術」'), '「迷因」是什麼？我想知道「神聖術」');
});
