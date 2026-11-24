'use strict';
const {src} = require('../helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const {djs, role, member, makeGuild, addChannel} = require('../helpers/fakes');
const {checkAssignableRole, isUnauthorizedEveryone} = src('plugin/permission');

const P = djs.PermissionFlagsBits;

test('checkAssignableRole enforces role hierarchy and blocks dangerous roles', async (t) => {
    const {guild} = makeGuild({
        owner_id: '10',
        roles: [role('1', 0), role('20', 1), role('30', 2), role('40', 3, P.ManageRoles), role('50', 4, P.ManageRoles),
            role('60', 5, P.Administrator), role('70', 0, 0n, {managed: true})],
        members: [member('10'), member('11', ['40']), member('900', ['50'])], // owner, mod (top 40), Alice (top 50)
    });
    const check = (userId, roleId) => checkAssignableRole({guild, user: {id: userId}}, guild.roles.cache.get(roleId));

    const cases = [
        ['mod gives a lower role', '11', '30', null],
        ['mod gives their own top role', '11', '40', /最高身分組/],
        ['mod gives a higher role', '11', '50', /最高身分組/],
        ['mod gives an admin role', '11', '60', /管理員/],
        ['mod gives @everyone', '11', '1', /@everyone/],
        ['mod gives a managed role', '11', '70', /整合服務/],
        ['owner gives a role above Alice', '10', '50', /愛麗絲的身分組位階/],
        ['owner gives a role below Alice', '10', '40', null],
    ];
    for (const [name, userId, roleId, expected] of cases) {
        await t.test(name, async () => {
            const result = await check(userId, roleId);
            if (expected === null) assert.equal(result, null);
            else assert.match(result ?? '', expected);
        });
    }
});

test('isUnauthorizedEveryone only flags @everyone from members without permission', async (t) => {
    const {client, guild} = makeGuild({
        roles: [role('1', 0, P.SendMessages | P.ViewChannel), role('20', 1), role('30', 2, P.MentionEveryone), role('60', 3, P.Administrator)],
        members: [member('11', ['20']), member('12', ['30']), member('13', ['60'])], // member, announcer, admin
    });
    addChannel(client, guild, {id: '100', type: 0, permission_overwrites: []});
    // The announcer's MentionEveryone is denied in #101.
    addChannel(client, guild, {id: '101', type: 0, permission_overwrites: [{id: '30', type: djs.OverwriteType.Role, allow: '0', deny: String(P.MentionEveryone)}]});

    let nextId = 1000;
    const message = (userId, content, channel) => channel.messages._add({
        id: String(nextId++), channel_id: channel.id, guild_id: channel.guildId ?? undefined,
        author: {id: userId, username: 'user' + userId, discriminator: '0'}, content,
        timestamp: '2020-01-01T00:00:00Z', edited_timestamp: null, tts: false, mention_everyone: false,
        mentions: [], mention_roles: [], attachments: [], embeds: [], pinned: false, type: 0,
    });
    const general = guild.channels.cache.get('100');
    const chat = guild.channels.cache.get('101');
    const dm = client.channels._add({id: '555', type: djs.ChannelType.DM, recipients: [{id: '11', username: 'user11', discriminator: '0'}]});

    const cases = [
        ['member sends @everyone', message('11', '@everyone 免費 nitro', general), true],
        ['member sends normal text', message('11', '大家好', general), false],
        ['announcer sends @everyone', message('12', '@everyone 公告', general), false],
        ['announcer sends @everyone where it is denied', message('12', '@everyone 公告', chat), true],
        ['admin overrides a channel deny', message('13', '@everyone 公告', chat), false],
        ['@everyone in a DM', message('11', '@everyone', dm), false],
    ];
    for (const [name, msg, expected] of cases) {
        await t.test(name, () => assert.equal(isUnauthorizedEveryone(msg), expected));
    }
});
