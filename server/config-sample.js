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
    // chat: {
    //     provider: 'mistral', apiKey: '', model: 'mistral-small-2603',
    //     requestsPerSecond: 1, tokensPerMinute: 20000,   // match the limits shown in the Mistral console
    //     dailyLimit: 300, cooldownSeconds: 20,   // 300/day used up daily ~ $9/month on mistral-small (2026-11 prices); set a spending cap in the Mistral console
    // },
}