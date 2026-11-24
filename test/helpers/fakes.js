'use strict';
// Shared fakes: a mysql2 pool that never connects, and real discord.js structures built from raw API data.
const djs = require('discord.js');

const JOINED = '2020-01-01T00:00:00Z';
const BOT_ID = '900';

// Replace mysql2's pool before server/plugin/mysql.js is required. `respond(sql, params)` returns
// the result rows/packet, or an Error to make the query fail. Every query is recorded in `calls`.
function fakePool(respond = () => []) {
    const calls = [];
    const pool = {
        calls,
        respond,
        query(sql, params, callback) {
            setImmediate(() => {
                calls.push({sql, params});
                let result;
                try { result = pool.respond(sql, params); } catch (error) { result = error; }
                if (result instanceof Error) callback(result);
                else callback(null, result);
            });
        },
    };
    require('mysql2').createPool = () => pool;
    return pool;
}

const role = (id, position, permissions = 0n, extra = {}) => ({
    id, name: 'role' + id, position, permissions: String(permissions),
    color: 0, hoist: false, managed: false, mentionable: false, ...extra,
});

const member = (id, roles = []) => ({user: {id, username: 'user' + id, discriminator: '0'}, roles, joined_at: JOINED});

// A logged-out client with Alice as the client user and one guild built from `guildData`.
function makeGuild(guildData = {}, client = new djs.Client({intents: []})) {
    client.user = new djs.ClientUser(client, {id: BOT_ID, username: 'alice', discriminator: '0'});
    const guild = client.guilds._add({id: '1', name: 'guild', owner_id: '10', roles: [], members: [], channels: [], ...guildData});
    return {client, guild};
}

// Add a channel (raw API shape, e.g. {id, type: 0, parent_id}) to the guild.
const addChannel = (client, guild, data) => client.channels._add({name: 'channel' + data.id, guild_id: guild.id, ...data}, guild);

const tick = (ms = 20) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {djs, BOT_ID, JOINED, fakePool, role, member, makeGuild, addChannel, tick};
