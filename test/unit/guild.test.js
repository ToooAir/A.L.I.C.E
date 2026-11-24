'use strict';
const {src} = require('../helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const {role, member, makeGuild} = require('../helpers/fakes');
const {guildEmbed} = src('plugin/embed/responseEmbed');

test('/guild counts members and presences, fetching the member list only once', async () => {
    const {guild} = makeGuild({
        owner_id: '10', member_count: 5,
        roles: [role('1', 0), role('20', 1), role('30', 2)],
        members: [member('10'), member('11', ['20'])], // only 2 of 5 cached
        presences: [
            {user: {id: '10'}, status: 'online'}, {user: {id: '11'}, status: 'idle'},
            {user: {id: '12'}, status: 'dnd'}, {user: {id: '99'}, status: 'online'}, // 99 already left
        ],
    });
    let fetches = 0;
    const fetchOne = guild.members.fetch.bind(guild.members); // fetchOwner() fetches a single member from the cache
    guild.members.fetch = async (options) => {
        if (options !== undefined) return fetchOne(options);
        fetches++;
        for (const m of [member('12', ['20', '30']), member('13', ['20']), member('900')]) guild.members._add(m);
        return guild.members.cache;
    };

    const roles = [{roleId: '20'}, {roleId: '30'}, {roleId: '404'}]; // 404 was deleted from the server
    const embed = (await guildEmbed({guild}, roles)).toJSON();
    const fields = Object.fromEntries(embed.fields.map(f => [f.name, f.value]));
    assert.equal(fields['人數'], '5');
    assert.equal(fields['線上'], '1');
    assert.equal(fields['閒置'], '1');
    assert.equal(fields['請勿打擾'], '1');
    assert.equal(fields['role20'], '3');
    assert.equal(fields['role30'], '1');
    assert.ok(!('role404' in fields));
    assert.equal(embed.author.name, 'user10');

    await guildEmbed({guild}, roles);
    assert.equal(fetches, 1, 'second call uses the cache');
});

test('/guild stays within the 25-field embed limit', async () => {
    const {guild} = makeGuild({member_count: 1, roles: [role('1', 0), role('20', 1)], members: [member('10', ['20'])]});
    const many = Array.from({length: 30}, () => ({roleId: '20'}));
    assert.equal((await guildEmbed({guild}, many)).toJSON().fields.length, 25);
});
