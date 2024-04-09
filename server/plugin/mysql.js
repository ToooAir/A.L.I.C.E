const mysql = require('mysql');
const {mysqlConnect} = require('../config');

const pool = mysql.createPool(mysqlConnect);


function createReply(input, output, guildId){
    return new Promise((resolve,reject) =>{
        pool.query('INSERT INTO reply (guildId, input, output) VALUES (?, ?, ?);', [guildId, input, output],
            function (err, results, fields) {
                if (err) throw err;
                console.log('[SQL insert] Inserted ' + results.affectedRows + ' row(s)  from reply..');
            }
        );
        resolve();
    });
    
};

function readReply(input, guildId){
    return new Promise((resolve, reject) => {
        pool.query('SELECT * FROM reply WHERE guildId = ? AND input = ? LIMIT 1', [guildId, input],
            function (err, results, fields) {
                if (err) throw err;
                resolve(results[0]);
            }
        );

    });
    
};

function updateReply(input, output, guildId){
    return new Promise((resolve,reject) => {
        pool.query('UPDATE reply SET output = ? WHERE guildId = ? AND input = ?', [output, guildId, input], 
            function (err, results, fields) {
                if (err) throw err;
            }
        );
        resolve();
    })
    
};

function deleteReply(input, guildId){
    return new Promise((resolve,reject) => {
        pool.query('DELETE FROM reply WHERE guildId = ? AND input = ?', [guildId, input], 
            function (err, results, fields) {
                if (err) throw err;
            }
        );
        resolve();
    })
    
};

function searchReply(input, guildId){
    return new Promise((resolve,reject) => {
        pool.query('SELECT * FROM reply WHERE guildId = ? AND (input LIKE ? or output LIKE ?) ORDER BY id DESC', [guildId,'%'+input+'%','%'+input+'%'],
            function (err, results, fields) {
                if (err) throw err;
                else console.log('[SQL search] Selected ' + results.length + ' row(s) from reply.');
                resolve(results);
            }
        );
    })

}

function readReplyInDM(input){
    return new Promise((resolve, reject) => {
        pool.query('SELECT * FROM reply WHERE input = ? LIMIT 1', [input],
            function (err, results, fields) {
                if (err) throw err;
                resolve(results[0]);
            }
        );

    });
}

function createBackupChannel(guildId, channelId){
    return new Promise((resolve, reject) => {
        pool.query('INSERT INTO backup (guildId,channelId) VALUES (?, ?);', [guildId, channelId],
            function (err, results, fields) {
                if (err) throw err;
                console.log('[SQL insert] Inserted ' + results.affectedRows + ' row(s) from backup.');
            }
        );
        resolve();
    });
}

function readBackupChannel(guildId){
    return new Promise((resolve, reject) => {
        pool.query('SELECT * FROM backup WHERE guildId = ? LIMIT 1', [guildId],
            function (err, results, fields) {
                if (err) throw err;
                resolve(results[0]);
            }
        );
    });
}

function updateBackupChannel(guildId, channelId){
    return new Promise((resolve,reject) => {
        pool.query('UPDATE backup SET channelId = ? WHERE guildId = ?', [channelId, guildId], 
            function (err, results, fields) {
                if (err) throw err;
            }
        );
        resolve();
    })
}

function deleteBackupChannel(guildId){
    return new Promise((resolve,reject) => {
        pool.query('DELETE FROM backup WHERE guildId = ?', [guildId], 
            function (err, results, fields) {
                if (err) throw err;
            }
        );
        resolve();
    })
}

function createGulidRole(guildId, roleId){
    return new Promise((resolve, reject) => {
        pool.query('INSERT INTO guild_role (guildId,roleId) VALUES (?, ?);', [guildId, roleId],
            function (err, results, fields) {
                if (err) throw err;
                console.log('[SQL insert] Inserted ' + results.affectedRows + ' row(s) from guild_role.');
            }
        );
        resolve();
    });
}

function readGuildRole(guildId){
    return new Promise((resolve, reject) => {
        pool.query('SELECT * FROM guild_role WHERE guildId = ?', [guildId],
            function (err, results, fields) {
                if (err) throw err;
                else console.log('[SQL search] Selected ' + results.length + ' row(s) from guild_role.');
                resolve(results);
            }
        );
    });
}

function searchGuildRoleByRoleId(roleId){
    return new Promise((resolve, reject) => {
        pool.query('SELECT * FROM guild_role WHERE roleId = ? LIMIT 1', [roleId],
            function (err, results, fields) {
                if (err) throw err;
                resolve(results[0]);
            }
        );
    });
}

function deleteGulidRole(guildId, roleId){
    return new Promise((resolve,reject) => {
        pool.query('DELETE FROM guild_role WHERE guildId = ? AND roleId = ?', [guildId, roleId], 
            function (err, results, fields) {
                if (err) throw err;
            }
        );
        resolve();
    })
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