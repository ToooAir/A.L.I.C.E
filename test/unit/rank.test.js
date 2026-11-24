'use strict';
const {src} = require('../helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const {djs, fakePool, makeGuild, addChannel} = require('../helpers/fakes');

const pool = fakePool();
const rank = src('command/rank');
const {localDay} = src('plugin/activity');

const CATEGORY = '1004665762453143612'; // one of the default rankCategoryIds
const OTHER_CATEGORY = '501';

function setup() {
    const {client, guild} = makeGuild();
    addChannel(client, guild, {id: CATEGORY, type: djs.ChannelType.GuildCategory});
    addChannel(client, guild, {id: OTHER_CATEGORY, type: djs.ChannelType.GuildCategory});
    const ids = [];
    for (let i = 0; i < 65; i++) {
        const id = String(1000000000000000000n + BigInt(i));
        ids.push(id);
        addChannel(client, guild, {id, type: djs.ChannelType.GuildText, parent_id: CATEGORY, position: i});
    }
    addChannel(client, guild, {id: '1200000000000000000', type: djs.ChannelType.GuildText, parent_id: OTHER_CATEGORY});
    return {guild, ids};
}

// Answer the two /rank queries: per-channel totals and the first recorded day.
function respondWith(totals, firstDay) {
    pool.respond = sql => sql.includes('SUM(count)')
        ? Object.entries(totals).map(([channelId, total]) => ({channelId, total}))
        : [{firstDay}];
}

async function run(guild, {days = null, category = null} = {}) {
    const out = [];
    await rank.execute({
        guild, guildId: guild.id,
        options: {getInteger: () => days, getChannel: () => category},
        reply: async p => out.push(['reply', p]),
        deferReply: async () => out.push(['defer']),
        editReply: async p => out.push(['edit', p]),
        followUp: async p => out.push(['follow', p]),
    });
    return out;
}

const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return localDay(d); };

test('ranks channels in the default categories, listing quiet ones as 0', async () => {
    const {guild, ids} = setup();
    respondWith({[ids[0]]: 15, [ids[1]]: 20, '1200000000000000000': 500}, daysAgo(30));
    const out = await run(guild);

    assert.equal(out[0][0], 'defer');
    assert.equal(out.length, 4, '66 lines -> 3 messages of up to 30');
    assert.deepEqual(pool.calls.at(-2).params, [guild.id, daysAgo(6)], 'last 7 days includes today');
    const text = out.slice(1).map(([, p]) => p.content).join('\n');
    assert.ok(out.slice(1).every(([, p]) => p.content.length < 2000 && p.allowedMentions.parse.length === 0));
    assert.match(text, new RegExp(`^最近 7 天（${daysAgo(6)} 起）`));
    assert.ok(!text.includes('⚠️'));

    const lines = text.split('\n').filter(l => l.startsWith('第'));
    assert.equal(lines.length, 65, 'other category excluded');
    assert.equal(lines[0], `第1名 <#${ids[1]}> : 20`);
    assert.equal(lines[1], `第2名 <#${ids[0]}> : 15`);
    assert.equal(lines[2], `第3名 <#${ids[2]}> : 0`, 'ties keep channel order');
    assert.equal(lines[64], `第65名 <#${ids[64]}> : 0`);
});

test('category and days options', async () => {
    const {guild} = setup();
    respondWith({'1200000000000000000': 500}, daysAgo(30));
    const out = await run(guild, {days: 30, category: guild.channels.cache.get(OTHER_CATEGORY)});
    assert.deepEqual(pool.calls.at(-2).params, [guild.id, daysAgo(29)]);
    assert.match(out[1][1].content, /^最近 30 天.*\n第1名 <#1200000000000000000> : 500$/);
});

test('warns when data starts inside the window or does not exist yet', async () => {
    const {guild} = setup();
    respondWith({}, daysAgo(2));
    assert.match((await run(guild))[1][1].content, new RegExp(`⚠️ 資料從 ${daysAgo(2)} 開始累積`));
    respondWith({}, null);
    assert.match((await run(guild))[1][1].content, /目前還沒有累積任何資料/);
});

test('a category without channels gets a private reply', async () => {
    const {guild} = setup();
    const out = await run(guild, {category: {id: '404'}});
    assert.equal(out[0][0], 'reply');
    assert.equal(out[0][1].flags, djs.MessageFlags.Ephemeral);
});
