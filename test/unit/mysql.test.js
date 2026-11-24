'use strict';
const {src} = require('../helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const {fakePool} = require('../helpers/fakes');

const pool = fakePool();
const db = src('plugin/mysql');

test('queries resolve with results and reject on errors', async () => {
    pool.respond = () => ({affectedRows: 1});
    assert.equal(await db.deleteGuildRole('g', 'r'), 1);
    assert.deepEqual(pool.calls.at(-1).params, ['g', 'r']);

    pool.respond = () => new Error('db down');
    await assert.rejects(db.readReply('x', 'g'), /db down/);
});

test('deleteReply reports how many rows were removed', async () => {
    pool.respond = () => ({affectedRows: 0});
    assert.equal(await db.deleteReply('kw', 'g'), 0);
});

test('searchReply escapes LIKE wildcards', async () => {
    pool.respond = () => [];
    await db.searchReply('100%_a\\b', 'g');
    assert.deepEqual(pool.calls.at(-1).params, ['g', '%100\\%\\_a\\\\b%', '%100\\%\\_a\\\\b%']);
});

test('readActivityStartDay returns null when nothing is recorded', async () => {
    pool.respond = () => [{firstDay: null}];
    assert.equal(await db.readActivityStartDay('g'), null);
});
