const mysql = require('mysql2');
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
    const results = await query('DELETE FROM reply WHERE guildId = ? AND input = ?', [guildId, input]);
    return results.affectedRows;
}

async function searchReply(input, guildId){
    // Escape LIKE wildcards so searching for "%" or "_" matches them literally.
    const pattern = '%' + input.replace(/[\\%_]/g, '\\$&') + '%';
    const results = await query('SELECT * FROM reply WHERE guildId = ? AND (input LIKE ? or output LIKE ?) ORDER BY id DESC', [guildId, pattern, pattern]);
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

async function createGuildRole(guildId, roleId){
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

async function deleteGuildRole(guildId, roleId){
    const results = await query('DELETE FROM guild_role WHERE guildId = ? AND roleId = ?', [guildId, roleId]);
    return results.affectedRows;
}

async function incrementChannelActivity(guildId, channelId, day){
    await query('INSERT INTO channel_activity (guildId, channelId, day, count) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE count = count + 1', [guildId, channelId, day]);
}

// Total messages per channel from `sinceDay` (YYYY-MM-DD, inclusive) to now.
async function readChannelActivity(guildId, sinceDay){
    return query('SELECT channelId, CAST(SUM(count) AS UNSIGNED) AS total FROM channel_activity WHERE guildId = ? AND day >= ? GROUP BY channelId', [guildId, sinceDay]);
}

// First day with any recorded activity (YYYY-MM-DD), or null if nothing has been recorded yet.
async function readActivityStartDay(guildId){
    const results = await query("SELECT DATE_FORMAT(MIN(day), '%Y-%m-%d') AS firstDay FROM channel_activity WHERE guildId = ?", [guildId]);
    return results[0].firstDay;
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
    createGuildRole: createGuildRole,
    readGuildRole: readGuildRole,
    deleteGuildRole: deleteGuildRole,
    searchGuildRoleByRoleId: searchGuildRoleByRoleId,
    incrementChannelActivity: incrementChannelActivity,
    readChannelActivity: readChannelActivity,
    readActivityStartDay: readActivityStartDay,
}
