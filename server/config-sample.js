//rename this to config.js
const token = ""; //discord bot token
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
    key: token,
    prefix: prefix,
    mysqlConnect:mysqlConnect
}