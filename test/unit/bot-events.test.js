'use strict';
const {src} = require('../helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const {djs, BOT_ID, fakePool, role, member, makeGuild, addChannel, tick} = require('../helpers/fakes');

const pool = fakePool();

// Load bot.js without connecting: capture the client it creates instead of logging in.
let client;
djs.Client.prototype.login = function () { client = this; return Promise.resolve('test'); };
src('bot');
const {localDay} = src('plugin/activity');

const P = djs.PermissionFlagsBits;
const {guild} = makeGuild({
    roles: [role('1', 0, P.ViewChannel | P.SendMessages)],
    members: [member('11')],
}, client);
const CATEGORY = '1004665762453143612';
addChannel(client, guild, {id: CATEGORY, type: djs.ChannelType.GuildCategory});
const text = addChannel(client, guild, {id: '2000', type: djs.ChannelType.GuildText, parent_id: CATEGORY});
const forum = addChannel(client, guild, {id: '2001', type: djs.ChannelType.GuildForum, parent_id: CATEGORY});
const thread = addChannel(client, guild, {id: '2002', type: djs.ChannelType.PublicThread, parent_id: forum.id});
const backup = addChannel(client, guild, {id: '2003', type: djs.ChannelType.GuildText});
const sent = [];
for (const channel of [text, backup]) channel.send = async payload => { sent.push([channel.id, payload]); return {}; };

function message(channel, {bot = false, authorId = '11', content = 'hello', when = new Date()} = {}) {
    return {
        author: {bot, id: authorId, username: 'user' + authorId, tag: 'user' + authorId, avatarURL: () => null},
        content, guild, guildId: guild.id, member: guild.members.cache.get(authorId) ?? null, createdAt: when,
        channel, channelId: channel.id, id: String(Math.random()).slice(2), partial: false,
        delete: async () => { message.deleted.push(channel.id); },
        reply: async () => {}, react: async () => {},
    };
}
message.deleted = [];

const activityWrites = () => pool.calls.filter(c => c.sql.startsWith('INSERT INTO channel_activity')).map(c => c.params);

test('ready handler is registered on clientReady', () => {
    assert.equal(djs.Events.ClientReady, 'clientReady');
    assert.equal(client.listenerCount(djs.Events.ClientReady), 1);
});

test('message counting for /rank', async () => {
    pool.calls.length = 0;
    pool.respond = () => [];
    client.emit(djs.Events.MessageCreate, message(text));
    client.emit(djs.Events.MessageCreate, message(text, {bot: true}));
    client.emit(djs.Events.MessageCreate, message(thread));
    client.emit(djs.Events.MessageCreate, message(text, {when: new Date('2026-11-24T16:00:00Z')}));
    client.emit(djs.Events.MessageCreate, message(text, {content: '@everyone 免費 nitro'})); // deleted by the filter
    await tick();
    assert.deepEqual(activityWrites(), [
        [guild.id, text.id, localDay()],
        [guild.id, forum.id, localDay()], // thread message counts toward the forum
        [guild.id, text.id, '2026-11-25'], // 00:00 Taipei
    ]);
    assert.deepEqual(message.deleted, [text.id]);
});

test('activity write failures do not break keyword replies', async () => {
    pool.respond = sql => sql.startsWith('INSERT INTO channel_activity') ? new Error('table missing')
        : sql.includes('FROM reply') ? [{output: 'pong'}] : [];
    sent.length = 0;
    client.emit(djs.Events.MessageCreate, message(text, {content: 'ping'}));
    await tick();
    assert.equal(sent.at(-1)[1].content, 'pong');
});

test('deleted-message backup', async (t) => {
    pool.respond = sql => sql.includes('FROM backup') ? [{guildId: guild.id, channelId: backup.id}] : [];
    const remove = msg => client.emit(djs.Events.MessageDelete, msg);

    await t.test('backs up a member message', async () => {
        sent.length = 0;
        remove(message(text, {content: 'oops'}));
        await tick();
        assert.equal(sent.length, 1);
        assert.equal(sent[0][0], backup.id);
        assert.match(sent[0][1].embeds[0].toJSON().description, /oops$/);
    });

    await t.test("skips Alice's own messages and deletions in the backup channel", async () => {
        sent.length = 0;
        remove(message(text, {authorId: BOT_ID}));
        remove(message(backup));
        await tick();
        assert.equal(sent.length, 0);
    });

    await t.test('truncates long messages to the 4096-character limit', async () => {
        sent.length = 0;
        remove(message(text, {content: '長'.repeat(5000)}));
        await tick();
        assert.equal(sent[0][1].embeds[0].toJSON().description.length, 4096);
    });

    await t.test('ignores uncached (partial) messages', async () => {
        sent.length = 0;
        remove({...message(text), partial: true});
        await tick();
        assert.equal(sent.length, 0);
    });
});
