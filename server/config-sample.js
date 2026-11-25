//rename this to config.js
const clientId = ""; //discord bot id
const token = ''; //discord bot token
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
    mysqlConnect:mysqlConnect,
    // Optional: category IDs ranked by /rank when no category is given (defaults to TVPC's categories)
    // rankCategoryIds: ['1004665762453143612', '811570519216226304'],
    // Optional: chat replies when Alice is mentioned. Off unless `provider` names a file in
    // server/plugin/chat/providers (see the README there). apiKey/model are passed to the provider.
    // chat: { provider: '', apiKey: '', model: '', dailyLimit: 100, cooldownSeconds: 20 },
}