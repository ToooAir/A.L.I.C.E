'use strict';
const {src} = require('../helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const {fakePool, tick} = require('../helpers/fakes');

const pool = fakePool();
const {localDay, recordMessage} = src('plugin/activity');

test('localDay uses Taipei calendar days', () => {
    assert.equal(localDay(new Date('2026-11-24T15:59:59Z')), '2026-11-24');
    assert.equal(localDay(new Date('2026-11-24T16:00:00Z')), '2026-11-25');
});

test('recordMessage ignores messages outside a guild', async () => {
    pool.calls.length = 0;
    recordMessage({guildId: null, channel: {isThread: () => false}, channelId: '1', createdAt: new Date()});
    await tick();
    assert.equal(pool.calls.length, 0);
});

test('recordMessage logs failures instead of throwing', async (t) => {
    pool.respond = () => new Error('table missing');
    const logged = [];
    t.mock.method(console, 'error', (...args) => logged.push(args));
    recordMessage({guildId: '1', channel: {isThread: () => false}, channelId: '2', createdAt: new Date()});
    await tick();
    assert.equal(logged[0][0], '[activity]');
});
