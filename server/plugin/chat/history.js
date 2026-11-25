'use strict';
// Channel-history tools Alice can call during a chat, so she can answer "what did people talk about lately?"
// The model first sees statistics (channel_activity), then reads filtered slices (search_messages) or asks
// for a summary of a period (summarize_period) instead of receiving the raw history at once.
const {localDay} = require('../activity');
const {SUMMARY_PROMPT} = require('./persona');

const MAX_DAYS = 7;
const MAX_HISTORY = 1000;          // messages loaded from Discord per chat
const MAX_STORED_CHARS = 200;      // per message kept in memory
const SEARCH_CHARS = 100;          // per message returned by search_messages
const MAX_SEARCH_RESULTS = 30;
const DEFAULT_SEARCH_RESULTS = 20;
const SUMMARY_CHUNK_CHARS = 3000;  // text per summarization call
const MAX_SUMMARY_CHUNKS = 3;      // calls per summary, sent one after another
const SUMMARY_TOKENS = 250;
const MERGE_GAP = 5 * 60000;       // consecutive messages by one person within this gap share a line
const HOUR = 3600000;

const pad = n => String(n).padStart(2, '0');
const stamp = ms => { const d = new Date(ms); return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fullStamp = ms => { const d = new Date(ms); return `${localDay(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// Shrink a message before it reaches the model: links and custom emoji carry few meaningful tokens.
const compact = text => String(text ?? '')
    .replace(/https?:\/\/\S+/g, '[連結]')
    .replace(/<a?(:\w+:)\d+>/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

// Compact transcript: a header per day, "HH:MM name: text", and one person's consecutive messages joined with " / ".
function transcript(records, chars){
    const lines = [];
    let day = null, prev = null;
    for(const r of records){
        const [date, time] = stamp(r.at).split(' ');
        if(date !== day){ lines.push(`【${date}】`); day = date; prev = null; }
        const text = r.content.slice(0, chars);
        if(prev && prev.author === r.author && r.at - prev.at <= MERGE_GAP) lines[lines.length - 1] += ` / ${text}`;
        else lines.push(`${time} ${r.author}: ${text}`);
        prev = r;
    }
    return lines;
}

// Tool definitions in a provider-neutral shape (JSON Schema parameters); provider adapters translate them.
const TOOL_DEFINITIONS = [
    {
        name: 'channel_activity',
        description: '頻道最近幾天的統計（不含內容）：總則數、每天則數、最熱鬧時段、發言最多的人。先用這個看概況，再決定讀哪一段。',
        parameters: {
            type: 'object',
            properties: {days: {type: 'integer', minimum: 1, maximum: MAX_DAYS, description: '往回看幾天'}},
            required: ['days'],
        },
    },
    {
        name: 'search_messages',
        description: `讀某段時間的訊息，可用發言者或關鍵字篩選。回傳符合總數；超過 limit 時平均抽樣，可縮小範圍再查。`,
        parameters: {
            type: 'object',
            properties: {
                since: {type: 'string', description: '開始時間，台灣時間，格式 YYYY-MM-DD HH:MM 或 YYYY-MM-DD'},
                until: {type: 'string', description: '結束時間，格式同上；省略表示到現在'},
                author: {type: 'string', description: '只看名字包含這段文字的發言者'},
                keyword: {type: 'string', description: '只看包含這段文字的訊息'},
                limit: {type: 'integer', minimum: 1, maximum: MAX_SEARCH_RESULTS, description: `最多幾則（預設 ${DEFAULT_SEARCH_RESULTS}）`},
            },
            required: ['since'],
        },
    },
    {
        name: 'summarize_period',
        description: '某段時間的對話摘要。訊息很多、想知道大家聊了什麼時用。',
        parameters: {
            type: 'object',
            properties: {
                since: {type: 'string', description: '開始時間，台灣時間，格式 YYYY-MM-DD HH:MM 或 YYYY-MM-DD'},
                until: {type: 'string', description: '結束時間，格式同上；省略表示到現在'},
            },
            required: ['since'],
        },
    },
];

// "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" in the process timezone -> ms, or null when malformed.
function parseTime(text){
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(String(text ?? '').trim());
    if(!match) return null;
    const [, y, mo, d, h = '0', mi = '0'] = match;
    const ms = new Date(+y, +mo - 1, +d, +h, +mi).getTime();
    return Number.isNaN(ms) ? null : ms;
}

// Load up to MAX_HISTORY messages from the last MAX_DAYS days before `beforeId`, oldest first.
async function loadHistory(channel, {beforeId, now, botId}){
    const cutoff = now - MAX_DAYS * 24 * HOUR;
    const records = [];
    let cursor = beforeId;
    while(records.length < MAX_HISTORY){
        const page = await channel.messages.fetch({limit: 100, before: cursor});
        if(page.size === 0) break;
        const sorted = [...page.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp);
        for(const m of sorted){
            if(m.createdTimestamp < cutoff) return records.reverse();
            if(!m.content) continue;
            records.push({
                at: m.createdTimestamp,
                author: m.author.id === botId ? '愛麗絲' : (m.member?.displayName ?? m.author.username),
                content: compact(m.author.id === botId ? m.content : m.cleanContent).slice(0, MAX_STORED_CHARS),
            });
            if(records.length >= MAX_HISTORY) break;
        }
        if(page.size < 100) break;
        cursor = sorted.at(-1).id;
    }
    return records.reverse();
}

function channelActivity(records, {days}, now){
    days = Math.min(Math.max(Math.trunc(Number(days)) || 1, 1), MAX_DAYS);
    const since = now - days * 24 * HOUR;
    const inRange = records.filter(r => r.at >= since);
    const header = `範圍：${fullStamp(since)} ～ ${fullStamp(now)}（最近 ${days} 天）\n總共 ${inRange.length} 則訊息`;
    if(inRange.length === 0) return header;

    const countBy = key => {
        const counts = new Map();
        for(const r of inRange) counts.set(key(r), (counts.get(key(r)) ?? 0) + 1);
        return [...counts.entries()];
    };
    const perDay = countBy(r => localDay(new Date(r.at)).slice(5).replace('-', '/'));
    const perHour = countBy(r => Math.floor(r.at / HOUR)).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const speakers = countBy(r => r.author).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return [
        header,
        `每天：${perDay.map(([day, n]) => `${day} ${n} 則`).join('、')}`,
        `最熱鬧的時段：${perHour.map(([hour, n]) => `${stamp(hour * HOUR)}–${pad((new Date((hour + 1) * HOUR)).getHours())}:00（${n} 則）`).join('、')}`,
        `發言最多：${speakers.map(([name, n]) => `${name} ${n} 則`).join('、')}`,
    ].join('\n');
}

// Messages in [since, until] matching the filters; returns {records} or {error} for the model.
function selectRange(records, {since, until, author, keyword}, now){
    const from = parseTime(since);
    const to = until ? parseTime(until) : now;
    if(from === null || to === null) return {error: '時間格式錯誤，請用 YYYY-MM-DD HH:MM 或 YYYY-MM-DD'};
    const needle = keyword?.toLowerCase();
    return {records: records.filter(r => r.at >= from && r.at <= to
        && (!author || r.author.includes(author))
        && (!needle || r.content.toLowerCase().includes(needle)))};
}

// Pick `count` items spread evenly over the list, keeping order.
const spread = (items, count) => items.length <= count ? items
    : Array.from({length: count}, (_, i) => items[Math.floor(i * items.length / count)]);

const OLDEST_NOTE = `（只能查到最近 ${MAX_DAYS} 天、最多 ${MAX_HISTORY} 則訊息）`;

function searchMessages(records, input, now){
    const {error, records: matched} = selectRange(records, input, now);
    if(error) return error;
    const limit = Math.min(Math.max(Math.trunc(Number(input.limit)) || DEFAULT_SEARCH_RESULTS, 1), MAX_SEARCH_RESULTS);
    if(matched.length === 0) return `沒有符合的訊息${OLDEST_NOTE}`;
    const shown = spread(matched, limit);
    const note = shown.length < matched.length ? `符合 ${matched.length} 則，平均抽樣顯示 ${shown.length} 則：` : `符合 ${matched.length} 則：`;
    return [note, ...transcript(shown, SEARCH_CHARS)].join('\n');
}

async function summarizePeriod(records, input, now, provider){
    const {error, records: matched} = selectRange(records, {since: input.since, until: input.until}, now);
    if(error) return error;
    if(matched.length === 0) return `這段時間沒有訊息${OLDEST_NOTE}`;

    // Split into chunks of about SUMMARY_CHUNK_CHARS; sample evenly if there are too many.
    const chunks = [];
    let current = [], size = 0;
    for(const r of matched){
        const length = r.author.length + r.content.length + 8;
        if(size + length > SUMMARY_CHUNK_CHARS && current.length > 0){ chunks.push(current); current = []; size = 0; }
        current.push(r);
        size += length;
    }
    if(current.length > 0) chunks.push(current);
    const used = spread(chunks, MAX_SUMMARY_CHUNKS);

    // One call at a time: the account allows few requests per second.
    const summaries = [];
    for(const chunk of used){
        const summary = await provider.generate({system: SUMMARY_PROMPT, messages: [{role: 'user', content: transcript(chunk, MAX_STORED_CHARS).join('\n')}], maxTokens: SUMMARY_TOKENS});
        const text = typeof summary === 'string' ? summary : (summary?.text ?? '');
        summaries.push(`${stamp(chunk[0].at)} 起：${text.trim()}`);
    }
    const header = used.length < chunks.length
        ? `共 ${matched.length} 則訊息，太多了，只摘要其中 ${used.length}/${chunks.length} 段：`
        : `共 ${matched.length} 則訊息的摘要：`;
    return [header, ...summaries].join('\n');
}

// Tool runner for one chat: loads the channel history once, on first use.
function createHistoryTools({channel, beforeId, now, botId, provider}){
    let history;
    const records = async () => (history ??= loadHistory(channel, {beforeId, now, botId}));
    return {
        definitions: TOOL_DEFINITIONS,
        async run(name, input = {}){
            switch(name){
                case 'channel_activity': return channelActivity(await records(), input, now);
                case 'search_messages': return searchMessages(await records(), input, now);
                case 'summarize_period': return summarizePeriod(await records(), input, now, provider);
                default: return `沒有這個工具：${name}`;
            }
        },
    };
}

module.exports = {TOOL_DEFINITIONS, createHistoryTools, parseTime, compact, transcript, MAX_DAYS, MAX_HISTORY};
