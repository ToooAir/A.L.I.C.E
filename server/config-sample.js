//rename this to config.js
const clientId = ""; //discord bot id
const token = ''; //discord bot token
const prefix = '*';
const mysqlConnect =
{
    host: '',
    user: '',
    password: '',
    database: '',
    port: 3306,
    connectionLimit : 10
};

module.exports = {
    clientId: clientId,
    token: token,
    prefix: prefix,
    mysqlConnect:mysqlConnect,
    // Optional: category IDs whose channels are ranked by *rank (defaults to TVPC's categories)
    // rankCategoryIds: ['1004665762453143612', '811570519216226304'],
}