'use strict';
const {src} = require('../helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const {djs, BOT_ID, fakePool} = require('../helpers/fakes');

fakePool();
const {createHistoryTools, parseTime, TOOL_DEFINITIONS} = src('plugin/chat/history');
const {createChat} = src('plugin/chat');
const {SUMMARY_PROMPT} = src('plugin/chat/persona');

const NOW = Date.parse('2026-11-25T06:00:00Z'); // 14:00 Taipei
const MIN = 60000;

// A channel with one message every `everyMinutes`, going back `days` days from NOW (oldest first).
function fakeChannel({days = 9, everyMinutes = 10, make} = {}) {
    const messages = [];
    const count = Math.floor(days * 1440 / everyMinutes);
    for (let i = count; i >= 1; i--) {
        const at = NOW - i * everyMinutes * MIN;
        const index = messages.length;
        const {authorId = String(index % 3), name = ['阿華', '小美', '小明'][index % 3], content = `訊息${index}`} = make?.(index, at) ?? {};
        messages.push({id: String(1000000 + index), createdTimestamp: at, content, cleanContent: content,
            author: {id: authorId, username: name}, member: {displayName: name}});
    }
    let fetches = 0;
    const channel = {
        messages: {fetch: async ({limit, before}) => {
            fetches++;
            const end = before ? messages.findIndex(m => m.id === before) : messages.length;
            const end2 = end === -1 ? messages.length : end;
            return new djs.Collection(messages.slice(Math.max(0, end2 - limit), end2).reverse().map(m => [m.id, m]));
        }},
    };
    return {channel, messages, fetches: () => fetches};
}

function fakeSummarizer() {
    const requests = [];
    return {requests, async generate(request) { requests.push(request); return `摘要${requests.length}`; }};
}

const tools = (channel, provider = fakeSummarizer()) => createHistoryTools({channel, beforeId: 'mention', now: NOW, botId: BOT_ID, provider});

test('parseTime reads Taipei dates and rejects garbage', () => {
    assert.equal(parseTime('2026-11-25 14:00'), NOW);
    assert.equal(parseTime('2026-11-25'), NOW - 14 * 60 * MIN);
    assert.equal(parseTime('昨天'), null);
    assert.equal(parseTime(undefined), null);
});

test('history is loaded once per chat, capped at 7 days and 1000 messages', async () => {
    const {channel, fetches} = fakeChannel({days: 9, everyMinutes: 15}); // 864 messages within 9 days, 672 within 7
    const t = tools(channel);
    const first = await t.run('channel_activity', {days: 7});
    assert.match(first, /總共 672 則訊息/);
    await t.run('search_messages', {since: '2026-11-20'});
    assert.ok(fetches() <= 8, `stopped at the 7-day cutoff (${fetches()} fetches)`);
    const before = fetches();
    await t.run('channel_activity', {days: 1});
    assert.equal(fetches(), before, 'no refetch within the same chat');

    const busy = fakeChannel({days: 7, everyMinutes: 5}); // 2016 messages
    assert.match(await tools(busy.channel).run('channel_activity', {days: 7}), /總共 1000 則訊息/);
});

test('channel_activity shows statistics only, never content', async () => {
    const {channel} = fakeChannel({days: 3, everyMinutes: 60, make: (i, at) => {
        const hour = new Date(at).getHours();
        return hour === 21 ? {content: '熱鬧'} : {};
    }});
    const text = await tools(channel).run('channel_activity', {days: 3});
    assert.match(text, /範圍：2026-11-22 14:00 ～ 2026-11-25 14:00（最近 3 天）/);
    assert.match(text, /總共 72 則訊息/);
    assert.match(text, /每天：11\/22 10 則、11\/23 24 則、11\/24 24 則、11\/25 14 則/);
    assert.match(text, /發言最多：阿華 24 則、小美 24 則、小明 24 則/);
    assert.doesNotMatch(text, /: 熱鬧|訊息\d/, "no message content");
    assert.match(await tools(channel).run('channel_activity', {days: 99}), /最近 7 天/, 'days clamped');
});

test('search_messages filters, reports totals and samples evenly', async () => {
    const {channel} = fakeChannel({days: 2, everyMinutes: 10, make: (i) => ({content: i % 20 === 0 ? `下週要考試 ${i}` : `閒聊 ${i}`})});
    const t = tools(channel);

    let text = await t.run('search_messages', {since: '2026-11-24', keyword: '考試'});
    const lines = text.split('\n');
    assert.match(lines[0], /^符合 \d+ 則：$/);
    assert.ok(lines.slice(1).every(l => /^\[\d\d\/\d\d \d\d:\d\d\] .+: 下週要考試/.test(l)));

    text = await t.run('search_messages', {since: '2026-11-24 00:00', until: '2026-11-24 23:59', author: '小美', limit: 5});
    assert.match(text, /^符合 48 則，平均抽樣顯示 5 則：/);
    assert.equal(text.split('\n').length, 6);
    assert.ok(text.split('\n').slice(1).every(l => l.includes('] 小美: ')));

    assert.match(await t.run('search_messages', {since: '昨天'}), /時間格式錯誤/);
    assert.match(await t.run('search_messages', {since: '2026-11-24', keyword: '不存在的字'}), /沒有符合的訊息（只能查到最近 7 天/);
});

test('search_messages truncates each message', async () => {
    const {channel} = fakeChannel({days: 1, everyMinutes: 60, make: () => ({content: '長'.repeat(1000)})});
    const text = await tools(channel).run('search_messages', {since: '2026-11-25', limit: 1});
    assert.ok(text.split('\n')[1].length < 230);
});

test('summarize_period summarizes in chunks and caps the number of calls', async () => {
    const small = fakeChannel({days: 1, everyMinutes: 60});
    const summarizer = fakeSummarizer();
    let text = await tools(small.channel, summarizer).run('summarize_period', {since: '2026-11-25'});
    assert.equal(summarizer.requests.length, 1);
    assert.equal(summarizer.requests[0].system, SUMMARY_PROMPT);
    assert.match(summarizer.requests[0].messages[0].content, /^\[11\/25 00:00\] /);
    assert.match(text, /^共 14 則訊息的摘要：\n11\/25 00:00 起：摘要1$/);

    const big = fakeChannel({days: 7, everyMinutes: 10, make: () => ({content: '字'.repeat(300)})});
    const busy = fakeSummarizer();
    text = await tools(big.channel, busy).run('summarize_period', {since: '2026-11-18'});
    assert.equal(busy.requests.length, 6);
    assert.ok(busy.requests.every(r => r.messages[0].content.length <= 8500));
    assert.match(text, /^共 1000 則訊息，太多了，只摘要其中 6\/\d+ 段：/);
});

test('unknown tools get an error message', async () => {
    assert.match(await tools(fakeChannel({days: 1}).channel).run('delete_everything', {}), /沒有這個工具/);
});

test('tool definitions are plain JSON Schema', () => {
    assert.deepEqual(TOOL_DEFINITIONS.map(t => t.name), ['channel_activity', 'search_messages', 'summarize_period']);
    for (const tool of TOOL_DEFINITIONS) {
        assert.equal(tool.parameters.type, 'object');
        assert.ok(tool.description.length > 0);
    }
});

// ---- the tool loop inside a chat ----

// A tools-capable provider that follows a script of responses for chat requests.
function scriptedProvider(script) {
    const requests = [];
    return {
        supportsTools: true, requests,
        async generate(request) {
            requests.push(request);
            if (request.system === SUMMARY_PROMPT) return '大家在討論期末考';
            if (!request.tools) return script.final ?? '（沒有工具時的回答）';
            const next = script.steps.shift();
            if (next instanceof Error) throw next;
            return next ?? script.final;
        },
    };
}

function mentionIn(channel) {
    const replies = [];
    const message = {
        id: 'mention', content: `<@${BOT_ID}> 最近這幾天這邊聊了什麼？`, cleanContent: '@愛麗絲 最近這幾天這邊聊了什麼？',
        createdTimestamp: NOW, createdAt: new Date(NOW), guildId: '1',
        author: {id: '11', username: 'user11'}, member: {displayName: '小明'},
        mentions: {users: new djs.Collection([[BOT_ID, {}]])},
        channel: {...channel, sendTyping: async () => {}},
        reply: async payload => { replies.push(payload); return {}; }, react: async () => {},
    };
    return {message, replies};
}

const chatWith = provider => createChat({provider, botId: () => BOT_ID, now: () => NOW, cooldownSeconds: 0});

test('Alice looks at the overview first, then reads a slice, then answers', async () => {
    const {channel} = fakeChannel({days: 3, everyMinutes: 30});
    const provider = scriptedProvider({
        steps: [
            {text: '讓我看看……', toolCalls: [{id: 't1', name: 'channel_activity', input: {days: 3}}]},
            {toolCalls: [{id: 't2', name: 'summarize_period', input: {since: '2026-11-24 20:00', until: '2026-11-24 23:00'}}]},
        ],
        final: '前天晚上大家在討論期末考呢。',
    });
    const {message, replies} = mentionIn(channel);
    await chatWith(provider).handle(message);

    const chatRequests = provider.requests.filter(r => r.system !== SUMMARY_PROMPT);
    assert.equal(chatRequests.length, 3);
    assert.deepEqual(chatRequests[0].tools.map(t => t.name), ['channel_activity', 'search_messages', 'summarize_period']);
    const last = chatRequests[2].messages;
    assert.deepEqual(last.at(-4), {role: 'assistant', content: '讓我看看……', toolCalls: [{id: 't1', name: 'channel_activity', input: {days: 3}}]});
    assert.equal(last.at(-3).role, 'tool');
    assert.equal(last.at(-3).toolCallId, 't1');
    assert.match(last.at(-3).content, /總共 144 則訊息/);
    assert.deepEqual(last.at(-2).toolCalls[0].name, 'summarize_period');
    assert.match(last.at(-1).content, /大家在討論期末考/);
    assert.equal(replies[0].content, '前天晚上大家在討論期末考呢。');
});

test('tool use stops after 4 calls and Alice must answer', async () => {
    const {channel} = fakeChannel({days: 1});
    const ask = id => ({toolCalls: [{id, name: 'channel_activity', input: {days: 1}}]});
    const provider = scriptedProvider({
        steps: [ask('a'), {toolCalls: [ask('b').toolCalls[0], ask('c').toolCalls[0], ask('d').toolCalls[0], ask('e').toolCalls[0]]}, ask('f')],
        final: '我查到的就這些。',
    });
    const {message, replies} = mentionIn(channel);
    await chatWith(provider).handle(message);

    const chatRequests = provider.requests.filter(r => r.system !== SUMMARY_PROMPT);
    assert.equal(chatRequests.length, 3);
    assert.equal(chatRequests[2].tools, undefined, 'final request offers no tools');
    const results = chatRequests[2].messages.filter(m => m.role === 'tool');
    assert.equal(results.length, 5);
    assert.match(results[4].content, /已達本次查詢上限/);
    assert.equal(replies[0].content, '我查到的就這些。');
});

test('a failing tool lets Alice answer anyway', async (t) => {
    t.mock.method(console, 'error', () => {});
    const channel = {messages: {fetch: async () => { throw new Error('Missing Access'); }}};
    const provider = scriptedProvider({steps: [{toolCalls: [{id: 'x', name: 'channel_activity', input: {days: 3}}]}], final: '我現在查不到紀錄。'});
    const {message, replies} = mentionIn(channel);
    await chatWith(provider).handle(message);
    const toolResult = provider.requests.at(-1).messages.find(m => m.role === 'tool');
    assert.match(toolResult.content, /查詢失敗/);
    assert.equal(replies[0].content, '我現在查不到紀錄。');
});

test('providers without tool support never receive tools', async () => {
    const requests = [];
    const provider = {async generate(request) { requests.push(request); return '我只記得剛剛的對話。'; }};
    const {message, replies} = mentionIn(fakeChannel({days: 1}).channel);
    await chatWith(provider).handle(message);
    assert.ok(requests.every(r => r.tools === undefined));
    assert.equal(replies[0].content, '我只記得剛剛的對話。');
});
