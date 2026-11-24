'use strict';
const {src, SERVER} = require('../helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {djs, fakePool, role, member, makeGuild} = require('../helpers/fakes');

const pool = fakePool();
const commandFiles = fs.readdirSync(path.join(SERVER, 'command')).filter(f => f.endsWith('.js'));
const command = name => src('command/' + name);
const EPHEMERAL = djs.MessageFlags.Ephemeral;

// Minimal chat-input interaction; `options` maps option names to values.
function fakeInteraction({subcommand = null, options = {}, ...extra} = {}) {
    const replies = [];
    return {
        replies,
        interaction: {
            guildId: '1', user: {id: '11', tag: 'user11', avatarURL: () => null}, createdTimestamp: Date.now(),
            options: {
                getSubcommand: () => subcommand,
                getString: key => options[key] ?? null,
                getInteger: key => options[key] ?? null,
                getRole: key => options[key] ?? null,
                getChannel: key => options[key] ?? null,
            },
            reply: async payload => { replies.push(payload); return {}; },
            editReply: async payload => replies.push(payload),
            deferReply: async () => {},
            followUp: async payload => replies.push(payload),
            ...extra,
        },
    };
}

test('command definitions', async (t) => {
    const definitions = Object.fromEntries(commandFiles.map(f => {
        const json = command(f).data.toJSON();
        return [json.name, json];
    }));

    await t.test('every command except /about is guild-only (contexts, not dm_permission)', () => {
        for (const json of Object.values(definitions)) {
            assert.equal(json.dm_permission, undefined, json.name);
            if (json.name === 'about') assert.equal(json.contexts, undefined);
            else assert.deepEqual(json.contexts, [djs.InteractionContextType.Guild], json.name);
        }
    });

    await t.test('staff commands have default member permissions', () => {
        const P = djs.PermissionFlagsBits;
        const expected = {
            'clear': P.ManageMessages, 'give-role': P.ManageRoles, 'give-role-with-role': P.ManageRoles,
            'backup': P.ManageGuild, 'guild-role': P.ManageGuild, 'broadcast': P.ManageGuild, 'rank': P.ManageChannels,
        };
        for (const [name, permission] of Object.entries(expected)) {
            assert.equal(definitions[name].default_member_permissions, String(permission), name);
        }
        for (const name of ['reply', 'guild', 'about']) assert.equal(definitions[name].default_member_permissions ?? null, null, name);
    });

    await t.test('/broadcast and /backup only offer text and announcement channels', () => {
        const textOnly = [djs.ChannelType.GuildText, djs.ChannelType.GuildAnnouncement];
        assert.deepEqual(definitions.broadcast.options[0].channel_types, textOnly);
        assert.deepEqual(definitions.backup.options[0].options[0].channel_types, textOnly);
    });

    await t.test('/reply lengths match the database columns', () => {
        const add = definitions.reply.options.find(o => o.name === 'add');
        assert.equal(add.options.find(o => o.name === 'input').max_length, 256);
        assert.equal(add.options.find(o => o.name === 'output').max_length, 1024);
    });

    await t.test('/rank days is limited to 1-90', () => {
        const days = definitions.rank.options.find(o => o.name === 'days');
        assert.equal(days.min_value, 1);
        assert.equal(days.max_value, 90);
    });
});

test('/reply', async (t) => {
    await t.test('search with no match says so privately', async () => {
        pool.respond = () => [];
        const {replies, interaction} = fakeInteraction({subcommand: 'search'});
        await command('reply').execute(interaction);
        assert.equal(replies[0].content, '找不到符合的關鍵字');
        assert.equal(replies[0].flags, EPHEMERAL);
    });

    await t.test('delete of a missing keyword says so privately', async () => {
        pool.respond = () => ({affectedRows: 0});
        const {replies, interaction} = fakeInteraction({subcommand: 'delete', options: {input: 'kw'}});
        await command('reply').execute(interaction);
        assert.equal(replies[0].content, '找不到這個關鍵字');
        assert.equal(replies[0].flags, EPHEMERAL);
    });

    await t.test('delete of an existing keyword shows the embed', async () => {
        pool.respond = () => ({affectedRows: 1});
        const {replies, interaction} = fakeInteraction({subcommand: 'delete', options: {input: 'kw'}});
        await command('reply').execute(interaction);
        assert.equal(replies[0].embeds[0].toJSON().title, '回覆已刪除');
    });

    await t.test('database errors propagate to the shared error handler', async () => {
        pool.respond = () => new Error('db down');
        const {interaction} = fakeInteraction({subcommand: 'add', options: {input: 'a', output: 'b'}});
        await assert.rejects(command('reply').execute(interaction), /db down/);
    });
});

test('/guild-role delete passes the role id and reports a missing role', async () => {
    pool.respond = () => ({affectedRows: 0});
    const {replies, interaction} = fakeInteraction({subcommand: 'delete', options: {role: {id: 'r1'}}});
    await command('guildrole').execute(interaction);
    assert.deepEqual(pool.calls.at(-1).params, ['1', 'r1']);
    assert.match(replies[0], /不在guild/);
});

test('/clear deletes every message in range across pages, skipping newer ones', async () => {
    const now = Date.now();
    const all = new djs.Collection();
    all.set('reply', {id: 'reply', createdTimestamp: now + 1000}); // Alice's own reply, newer than the command
    for (let i = 0; i < 250; i++) all.set(String(1000 - i), {id: String(1000 - i), createdTimestamp: now - (i + 1) * 60000});
    const keys = [...all.keys()];
    const deleted = [];
    const channel = {
        messages: {fetch: async ({limit, before}) => {
            const start = before ? keys.indexOf(before) + 1 : 0;
            return new djs.Collection(keys.slice(start, start + limit).map(k => [k, all.get(k)]));
        }},
        bulkDelete: async messages => deleted.push(...messages.keys()),
    };
    const from = new Date(now - 150.5 * 60000);
    const {replies, interaction} = fakeInteraction({
        options: {year: from.getFullYear(), month: from.getMonth() + 1, day: from.getDate(), hour: from.getHours(), minute: from.getMinutes()},
        createdTimestamp: now, channel,
    });
    await command('clear').execute(interaction);

    const cutoff = new Date(from.getFullYear(), from.getMonth(), from.getDate(), from.getHours(), from.getMinutes()).getTime();
    const expected = keys.filter(k => all.get(k).createdTimestamp > cutoff && all.get(k).createdTimestamp < now);
    assert.ok(expected.length > 100, 'range must span more than one page');
    assert.deepEqual(new Set(deleted), new Set(expected));
    assert.equal(deleted.length, expected.length, 'no message deleted twice');
    assert.equal(replies.at(-1).content, `總共刪除了${expected.length}則訊息`);
});

test('/clear rejects future times and ranges over 12 hours', async () => {
    for (const [offset, message] of [[+3600e3, /時空支配術/], [-13 * 3600e3, /12小時/]]) {
        const d = new Date(Date.now() + offset);
        const {replies, interaction} = fakeInteraction({options: {year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes()}});
        await command('clear').execute(interaction);
        assert.match(replies[0].content, message);
        assert.equal(replies[0].flags, EPHEMERAL);
    }
});

test('/give-role-with-role loads all members first so uncached role holders are included', async () => {
    const {guild} = makeGuild({
        member_count: 5,
        roles: [role('1', 0), role('20', 1), role('30', 2)],
        members: [member('10'), member('11', ['20'])], // only 2 of 5 cached
    });
    let fetches = 0;
    guild.members.fetch = async () => {
        fetches++;
        for (const m of [member('12', ['20']), member('13', ['20']), member('14')]) guild.members._add(m);
        return guild.members.cache;
    };
    const given = [];
    const originalAdd = djs.GuildMemberRoleManager.prototype.add;
    djs.GuildMemberRoleManager.prototype.add = async function () { given.push(this.member.id); };
    const permission = src('plugin/permission');
    const originalCheck = permission.checkAssignableRole;
    permission.checkAssignableRole = async () => null;
    try {
        delete require.cache[require.resolve(path.join(SERVER, 'command/role'))];
        const {replies, interaction} = fakeInteraction({guild, options: {'member-role': guild.roles.cache.get('20'), 'give-role': guild.roles.cache.get('30')}});
        await command('role').execute(interaction);
        assert.deepEqual(given.sort(), ['11', '12', '13']);
        assert.equal(replies.at(-1), '給予成功');

        await command('role').execute(interaction);
        assert.equal(fetches, 1, 'complete cache is not fetched again');
    } finally {
        djs.GuildMemberRoleManager.prototype.add = originalAdd;
        permission.checkAssignableRole = originalCheck;
    }
});

test('/about measures latency from the reply message', async () => {
    const edits = [];
    await command('about').execute({
        createdTimestamp: 1000,
        reply: async payload => { assert.equal(payload.withResponse, true); return {resource: {message: {createdTimestamp: 1234}}}; },
        editReply: async payload => edits.push(payload),
    });
    const ping = edits[0].embeds[0].toJSON().fields.find(f => f.name === 'ping');
    assert.equal(ping.value, '234 ms');
});
