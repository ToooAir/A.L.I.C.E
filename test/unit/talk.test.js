'use strict';
const {src} = require('../helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const {fakePool, tick} = require('../helpers/fakes');

const pool = fakePool();
const {talk, replyInDM} = src('plugin/talk');

function fakeMessage(content) {
    const sent = [];
    return {
        sent,
        message: {
            content, guildId: '1',
            author: {username: 'u', toString: () => '<@11>', send: async () => {}},
            channel: {send: async payload => sent.push(payload)},
            react: async () => {},
        },
    };
}

test('keyword replies replace {m} and only allow user pings', async () => {
    pool.respond = sql => sql.includes('FROM reply') ? [{output: '@everyone <@&123> 嗨 {m}，{m}'}] : [];
    const {sent, message} = fakeMessage('hi');
    talk(message);
    replyInDM(message);
    await tick();

    assert.equal(sent.length, 2);
    for (const payload of sent) {
        assert.equal(payload.content, '@everyone <@&123> 嗨 <@11>，<@11>');
        assert.deepEqual(payload.allowedMentions, {parse: ['users']});
    }
});

test('^ separates alternative replies', async () => {
    pool.respond = sql => sql.includes('FROM reply') ? [{output: 'a^b^c'}] : [];
    const seen = new Set();
    for (let i = 0; i < 60; i++) {
        const {sent, message} = fakeMessage('hi');
        talk(message);
        await tick(2);
        seen.add(sent[0].content);
    }
    assert.deepEqual([...seen].sort(), ['a', 'b', 'c']);
});

test('no reply when the keyword is unknown', async () => {
    pool.respond = () => [];
    const {sent, message} = fakeMessage('nothing');
    talk(message);
    await tick();
    assert.equal(sent.length, 0);
});
