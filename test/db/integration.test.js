'use strict';
// Runs server/plugin/mysql.js and /rank against a real MySQL. See README "測試" for setup.
const {src, SERVER} = require('../helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const config = require('../helpers/config');
const {djs, makeGuild, addChannel} = require('../helpers/fakes');

// These tests wipe tables, so refuse anything that doesn't look like a throwaway database.
if (!config.mysqlConnect.database.endsWith('_test')) {
    throw new Error(`Refusing to run against "${config.mysqlConnect.database}": the test database name must end with _test`);
}

// Keep a handle on the app's pool so it can be closed when the tests finish.
const mysql2 = require('mysql2');
const createPool = mysql2.createPool;
let appPool;
mysql2.createPool = (...args) => (appPool = createPool(...args));
const db = src('plugin/mysql');
const {localDay} = src('plugin/activity');
const G = '1180000000000000001'; // 19-digit snowflakes are beyond Number precision
let conn;

test.before(async () => {
    const {database, ...server} = config.mysqlConnect;
    delete server.connectionLimit;
    conn = await mysql.createConnection({...server, multipleStatements: true});
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4`);
    await conn.query(`USE \`${database}\``);
    await conn.query('DROP TABLE IF EXISTS reply, backup, guild_role, channel_activity, chat_memory');
});

test.after(async () => {
    await conn?.end();
    await new Promise(resolve => appPool ? appPool.end(resolve) : resolve());
});

test('schema.sql creates all tables and is safe to re-run', async () => {
    const schema = fs.readFileSync(path.join(SERVER, '..', 'schema.sql'), 'utf8');
    await conn.query(schema);
    await conn.query(schema);
    const [tables] = await conn.query('SHOW TABLES');
    assert.deepEqual(tables.map(row => Object.values(row)[0]).sort(), ['backup', 'channel_activity', 'chat_memory', 'guild_role', 'reply']);
});

test('reply CRUD with emoji, CJK and case-insensitive lookup', async () => {
    await db.createReply('Hello', '你好 {m} 🥺^早安', G);
    assert.equal((await db.readReply('hello', G)).output, '你好 {m} 🥺^早安');
    await db.updateReply('Hello', '改了 ✨', G);
    assert.equal((await db.readReply('Hello', G)).output, '改了 ✨');
    assert.equal((await db.readReplyInDM('Hello')).output, '改了 ✨');
    assert.equal(await db.deleteReply('Hello', G), 1);
    assert.equal(await db.deleteReply('Hello', G), 0);
    assert.equal(await db.readReply('Hello', G), undefined);
});

test('reply search treats %, _ and \\ literally', async () => {
    for (const [input, output] of [['100%', 'a'], ['1000', 'b'], ['a_b', 'c'], ['axb', 'd'], ['back\\slash', 'e'], ['backslash', 'f']]) {
        await db.createReply(input, output, G);
    }
    const search = async q => (await db.searchReply(q, G)).map(r => r.input).sort();
    assert.deepEqual(await search('%'), ['100%']);
    assert.deepEqual(await search('_'), ['a_b']);
    assert.deepEqual(await search('\\'), ['back\\slash']);
    assert.deepEqual(await search('0'), ['100%', '1000']);
    assert.equal((await search('')).length, 6);
});

test('backup channel and guild roles keep snowflakes exact', async () => {
    const channelId = '1199999999999999999', roleId = '1234567890123456789';
    await db.createBackupChannel(G, channelId);
    assert.equal((await db.readBackupChannel(G)).channelId, channelId);
    await db.deleteBackupChannel(G);
    assert.equal(await db.readBackupChannel(G), undefined);

    await db.createGuildRole(G, roleId);
    assert.equal((await db.readGuildRole(G))[0].roleId, roleId);
    assert.equal((await db.searchGuildRoleByRoleId(roleId)).roleId, roleId);
    assert.equal(await db.deleteGuildRole(G, roleId), 1);
    assert.equal(await db.deleteGuildRole(G, roleId), 0);
});

test('channel activity counting and /rank over real data', async () => {
    const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return localDay(d); };
    const A = '1000000000000000001', B = '1000000000000000002', C = '1000000000000000003';

    for (let i = 0; i < 3; i++) await db.incrementChannelActivity(G, A, daysAgo(0));
    const [[{count}]] = await conn.query('SELECT count FROM channel_activity WHERE guildId = ? AND channelId = ?', [G, A]);
    assert.equal(count, 3, 'same channel and day accumulate in one row');

    const seed = [[A, 3, 5], [A, 10, 100], [B, 6, 20], [C, 7, 999]];
    for (const [channel, ago, n] of seed) await conn.query('INSERT INTO channel_activity VALUES (?, ?, ?, ?)', [G, channel, daysAgo(ago), n]);
    await conn.query('INSERT INTO channel_activity VALUES (?, ?, ?, ?)', ['999', A, daysAgo(0), 7777]); // another guild

    const totals = Object.fromEntries((await db.readChannelActivity(G, daysAgo(6))).map(r => [r.channelId, Number(r.total)]));
    assert.deepEqual(totals, {[A]: 8, [B]: 20}, '7-day window: today..6 days ago');
    assert.equal(await db.readActivityStartDay(G), daysAgo(10));
    assert.equal(await db.readActivityStartDay('nobody'), null);

    const {client, guild} = makeGuild({id: G});
    const category = '1004665762453143612';
    addChannel(client, guild, {id: category, type: djs.ChannelType.GuildCategory});
    [A, B, C].forEach((id, position) => addChannel(client, guild, {id, type: djs.ChannelType.GuildText, parent_id: category, position}));
    const out = [];
    await src('command/rank').execute({
        guild, guildId: G, options: {getInteger: () => 8, getChannel: () => null},
        deferReply: async () => {}, editReply: async p => out.push(p.content), followUp: async p => out.push(p.content),
    });
    assert.deepEqual(out[0].split('\n').slice(1), [`第1名 <#${C}> : 999`, `第2名 <#${B}> : 20`, `第3名 <#${A}> : 8`]);
});

test('chat memory is stored per guild and person', async () => {
    assert.equal(await db.readChatMemory(G, '11'), null);
    await db.saveChatMemory(G, '11', '- 喜歡冬天 ❄️');
    await db.saveChatMemory(G, '12', '- 喜歡貓');
    await db.saveChatMemory(G, '11', '- 喜歡冬天 ❄️\n- 明天考試');
    assert.equal(await db.readChatMemory(G, '11'), '- 喜歡冬天 ❄️\n- 明天考試');
    assert.equal(await db.readChatMemory('other-guild', '11'), null);
    assert.equal(await db.deleteChatMemory(G, '11'), 1);
    assert.equal(await db.deleteChatMemory(G, '11'), 0);
    assert.equal(await db.readChatMemory(G, '12'), '- 喜歡貓');
});
