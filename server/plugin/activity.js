'use strict';

// Calendar date in the process timezone (TZ=Asia/Taipei under Docker) as YYYY-MM-DD,
// so day boundaries don't depend on the MySQL server's timezone.
function localDay(date = new Date()){
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Count one guild message for /rank. Thread messages (including forum posts) count toward the parent channel.
// Only the per-channel daily count is stored, never message content.
function recordMessage(message){
    if(!message.guildId) return;
    const channelId = message.channel.isThread() ? message.channel.parentId : message.channelId;
    if(!channelId) return;
    // Required here so modules that only need localDay() don't load the database config.
    require('./mysql').incrementChannelActivity(message.guildId, channelId, localDay(message.createdAt))
        .catch(error => console.error('[activity]', error));
}

module.exports = {
    localDay: localDay,
    recordMessage: recordMessage,
}
