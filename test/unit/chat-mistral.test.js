'use strict';
const {src} = require('../helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');

const {createProvider, toMistralMessages, estimateTokens} = src('plugin/chat/providers/mistral');

const CONFIG = {provider: 'mistral', apiKey: 'test-key', model: 'mistral-small-2603'};

function jsonResponse(status, body, headers = {}) {
    return {
        ok: status >= 200 && status < 300, status,
        headers: {get: name => headers[name.toLowerCase()] ?? null},
        json: async () => body, text: async () => JSON.stringify(body),
    };
}
const reply = (message, usage = {total_tokens: 100}) => jsonResponse(200, {choices: [{message, finish_reason: 'stop'}], usage});

// A fake clock: wait() advances time instead of sleeping. fetch answers from a list of responses.
function setup({responses = [], config = {}} = {}) {
    let clock = 0;
    const calls = [];
    const fetchImpl = async (url, init) => {
        calls.push({url, init, at: clock, body: JSON.parse(init.body)});
        const next = responses.shift();
        return typeof next === 'function' ? next() : next ?? reply({content: '好的。'});
    };
    const provider = createProvider({...CONFIG, ...config}, {fetchImpl, now: () => clock, wait: async ms => { clock += ms; }});
    return {provider, calls, time: () => clock};
}

const ask = (provider, extra = {}) => provider.generate({system: '你是愛麗絲', messages: [{role: 'user', content: '[14:00] 小明: 嗨'}], maxTokens: 300, ...extra});

test('sends a chat completion with the configured model and key', async () => {
    const {provider, calls} = setup();
    assert.equal(await ask(provider), '好的。');
    const [{url, init, body}] = calls;
    assert.equal(url, 'https://api.mistral.ai/v1/chat/completions');
    assert.equal(init.headers.Authorization, 'Bearer test-key');
    assert.equal(body.model, 'mistral-small-2603');
    assert.equal(body.max_tokens, 300);
    assert.equal(body.temperature, 0.7);
    assert.deepEqual(body.messages, [{role: 'system', content: '你是愛麗絲'}, {role: 'user', content: '[14:00] 小明: 嗨'}]);
    assert.equal(body.tools, undefined);
    assert.equal(provider.supportsTools, true);
});

test('requires an api key and a model', () => {
    assert.throws(() => createProvider({provider: 'mistral', model: 'x'}), /apiKey/);
    assert.throws(() => createProvider({provider: 'mistral', apiKey: 'x'}), /model/);
});

test('translates conversations with tool calls and merges consecutive user messages', () => {
    assert.deepEqual(toMistralMessages('sys', [
        {role: 'user', content: '[13:58] 小美: 想喝熱可可'},
        {role: 'user', content: '[14:00] 小明: @愛麗絲 最近聊了什麼？'},
        {role: 'assistant', content: '', toolCalls: [{id: 'abc123XYZ', name: 'channel_activity', input: {days: 3}}]},
        {role: 'tool', toolCallId: 'abc123XYZ', name: 'channel_activity', content: '總共 10 則訊息'},
        {role: 'assistant', content: '我說過的話'},
    ]), [
        {role: 'system', content: 'sys'},
        {role: 'user', content: '[13:58] 小美: 想喝熱可可\n[14:00] 小明: @愛麗絲 最近聊了什麼？'},
        {role: 'assistant', content: '', tool_calls: [{id: 'abc123XYZ', type: 'function', function: {name: 'channel_activity', arguments: '{"days":3}'}}]},
        {role: 'tool', tool_call_id: 'abc123XYZ', name: 'channel_activity', content: '總共 10 則訊息'},
        {role: 'assistant', content: '我說過的話'},
    ]);
});

test('offers tools and returns tool calls whether arguments are a string or an object', async () => {
    const {provider, calls} = setup({responses: [reply({content: '', tool_calls: [
        {id: 'a1', type: 'function', function: {name: 'channel_activity', arguments: '{"days":3}'}},
        {id: 'a2', type: 'function', function: {name: 'search_messages', arguments: {since: '2026-11-24'}}},
        {id: 'a3', type: 'function', function: {name: 'channel_activity', arguments: 'not json'}},
    ]})]});
    const tool = {name: 'channel_activity', description: 'stats', parameters: {type: 'object', properties: {}}};
    const result = await ask(provider, {tools: [tool]});
    assert.deepEqual(calls[0].body.tools, [{type: 'function', function: tool}]);
    assert.equal(calls[0].body.tool_choice, 'auto');
    assert.deepEqual(result, {text: '', toolCalls: [
        {id: 'a1', name: 'channel_activity', input: {days: 3}},
        {id: 'a2', name: 'search_messages', input: {since: '2026-11-24'}},
        {id: 'a3', name: 'channel_activity', input: {}},
    ]});
});

test('reads text out of chunked content and skips thinking', async () => {
    const {provider} = setup({responses: [reply({content: [{type: 'thinking', thinking: [{type: 'text', text: '思考中'}]}, {type: 'text', text: '你好'}, {type: 'text', text: '。'}]})]});
    assert.equal(await ask(provider), '你好。');
});

test('keeps at most one request per second, even for concurrent chats', async () => {
    const {provider, calls} = setup();
    await Promise.all([ask(provider), ask(provider), ask(provider)]);
    assert.deepEqual(calls.map(c => c.at), [0, 1000, 2000]);
});

test('waits for the token budget of the last minute', async () => {
    const {provider, calls} = setup({
        config: {tokensPerMinute: 1000},
        responses: [reply({content: '一'}, {total_tokens: 900}), reply({content: '二'}, {total_tokens: 50})],
    });
    await ask(provider);
    await ask(provider);
    assert.equal(calls[1].at, 60000, 'second request waits until the first one leaves the window');
});

test('retries 429 and 5xx with backoff or Retry-After', async () => {
    const {provider, calls} = setup({responses: [
        jsonResponse(429, {message: 'rate limited'}, {'retry-after': '5'}),
        jsonResponse(503, {message: 'busy'}),
        reply({content: '終於。'}),
    ]});
    assert.equal(await ask(provider), '終於。');
    assert.deepEqual(calls.map(c => c.at), [0, 5000, 9000]);
});

test('gives up after repeated failures and on client errors', async () => {
    const busy = setup({responses: Array.from({length: 10}, () => jsonResponse(429, {message: 'rate limited'}))});
    await assert.rejects(ask(busy.provider), /Mistral API 429/);
    assert.equal(busy.calls.length, 4);

    const bad = setup({responses: [jsonResponse(401, {message: 'Unauthorized'})]});
    await assert.rejects(ask(bad.provider), /Mistral API 401: .*Unauthorized/);
    assert.equal(bad.calls.length, 1);

    // A failed request doesn't block the queue for the next chat.
    const after = setup({responses: [jsonResponse(400, {message: 'bad'})]});
    await assert.rejects(ask(after.provider));
    assert.equal(await ask(after.provider), '好的。');
});

test('token estimate counts Chinese characters as about one token each', () => {
    assert.equal(estimateTokens('愛麗絲你好'), 5);
    assert.equal(estimateTokens('hello world!'), 3);
});

test('a limit of 0 (no API access) fails at once with a clear message', async () => {
    const {provider, calls} = setup({responses: [jsonResponse(429, {code: '1300'}, {'x-ratelimit-limit-req-minute': '0'})]});
    await assert.rejects(ask(provider), /no API access to mistral-small-2603/);
    assert.equal(calls.length, 1);
});

test('slows down to the per-minute request limit reported by the API', async () => {
    const limited = () => ({...reply({content: '好'}), headers: {get: name => name === 'x-ratelimit-limit-req-minute' ? '2' : null}});
    const {provider, calls} = setup({responses: [limited, limited, limited]});
    await ask(provider); await ask(provider); await ask(provider);
    assert.deepEqual(calls.map(c => c.at), [0, 30000, 60000]);
});
