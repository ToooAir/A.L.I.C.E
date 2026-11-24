const mysql = require('mysql');
const {mysqlConnect} = require('../config');

const pool = mysql.createPool(mysqlConnect);

// Run a query and settle only after MySQL responds; errors reject instead of crashing the process.
function query(sql, params){
    return new Promise((resolve, reject) => {
        pool.query(sql, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
}

async function createReply(input, output, guildId){
    const results = await query('INSERT INTO reply (guildId, input, output) VALUES (?, ?, ?);', [guildId, input, output]);
    console.log('[SQL insert] Inserted ' + results.affectedRows + ' row(s) from reply.');
}

async function readReply(input, guildId){
    const results = await query('SELECT * FROM reply WHERE guildId = ? AND input = ? LIMIT 1', [guildId, input]);
    return results[0];
}

async function updateReply(input, output, guildId){
    await query('UPDATE reply SET output = ? WHERE guildId = ? AND input = ?', [output, guildId, input]);
}

async function deleteReply(input, guildId){
    await query('DELETE FROM reply WHERE guildId = ? AND input = ?', [guildId, input]);
}

async function searchReply(input, guildId){
    const results = await query('SELECT * FROM reply WHERE guildId = ? AND (input LIKE ? or output LIKE ?) ORDER BY id DESC', [guildId, '%'+input+'%', '%'+input+'%']);
    console.log('[SQL search] Selected ' + results.length + ' row(s) from reply.');
    return results;
}

async function readReplyInDM(input){
    const results = await query('SELECT * FROM reply WHERE input = ? LIMIT 1', [input]);
    return results[0];
}

async function createBackupChannel(guildId, channelId){
    const results = await query('INSERT INTO backup (guildId,channelId) VALUES (?, ?);', [guildId, channelId]);
    console.log('[SQL insert] Inserted ' + results.affectedRows + ' row(s) from backup.');
}

async function readBackupChannel(guildId){
    const results = await query('SELECT * FROM backup WHERE guildId = ? LIMIT 1', [guildId]);
    return results[0];
}

async function updateBackupChannel(guildId, channelId){
    await query('UPDATE backup SET channelId = ? WHERE guildId = ?', [channelId, guildId]);
}

async function deleteBackupChannel(guildId){
    await query('DELETE FROM backup WHERE guildId = ?', [guildId]);
}

async function createGulidRole(guildId, roleId){
    const results = await query('INSERT INTO guild_role (guildId,roleId) VALUES (?, ?);', [guildId, roleId]);
    console.log('[SQL insert] Inserted ' + results.affectedRows + ' row(s) from guild_role.');
}

async function readGuildRole(guildId){
    const results = await query('SELECT * FROM guild_role WHERE guildId = ?', [guildId]);
    console.log('[SQL search] Selected ' + results.length + ' row(s) from guild_role.');
    return results;
}

async function searchGuildRoleByRoleId(roleId){
    const results = await query('SELECT * FROM guild_role WHERE roleId = ? LIMIT 1', [roleId]);
    return results[0];
}

async function deleteGulidRole(guildId, roleId){
    const results = await query('DELETE FROM guild_role WHERE guildId = ? AND roleId = ?', [guildId, roleId]);
    return results.affectedRows;
}

module.exports = {
    createReply: createReply,
    readReply: readReply,
    updateReply: updateReply,
    deleteReply: deleteReply,
    searchReply: searchReply,
    readReplyInDM: readReplyInDM,
    createBackupChannel: createBackupChannel,
    updateBackupChannel: updateBackupChannel,
    readBackupChannel: readBackupChannel,
    deleteBackupChannel: deleteBackupChannel,
    createGulidRole: createGulidRole,
    readGuildRole: readGuildRole,
    deleteGulidRole: deleteGulidRole,
    searchGuildRoleByRoleId: searchGuildRoleByRoleId,
}
