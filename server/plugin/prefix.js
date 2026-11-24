'use strict';
const csv = require('csv-string');

const {help} = require('./embed/responseEmbed');
const config = require('../config');
const prefixM = config.prefix;

// Categories whose channels are ranked by *rank. Override with `rankCategoryIds` in config.js.
const RANK_CATEGORY_IDS = config.rankCategoryIds ?? ['1004665762453143612', '811570519216226304'];
// Lines per Discord message; keeps each message well under the 2000-character limit.
const RANK_LINES_PER_MESSAGE = 30;

function prefix(message) {
    const commandBody = message.content.slice(prefixM.length);
    const args = commandBody.split(' ');
    const command = args.shift();

    switch(command.toLowerCase()){
        case 'help':
            message.channel.send({embeds:[help()]}).catch(console.error);
            break;
        case 'rank':
            channelRank(message).catch(error => {
                console.error('[rank]', error);
                message.reply('排序的時候發生了錯誤，請再試一次看看').catch(console.error);
            });
            break;
        default:
            message.reply('已經將指令轉移至斜線命令，請嘗試 / 來叫出命令選單').catch(console.error);
    }
}

async function channelRank(message){
    if(!message.member.permissions.has('ManageChannels')){
        await message.reply('你的權限很像不夠喔，要不要先去提升再回來? :up:');
        return;
    }

    const file = message.attachments.first();
    if(!file){
        await message.react('❔');
        await message.reply('這個指令請搭配檔案上傳使用');
        return;
    }
    if(!/\.csv$/i.test(file.name)){
        await message.react('❔');
        await message.reply('請上傳正確的csv檔喔');
        return;
    }

    let body;
    try {
        const response = await fetch(file.url);
        if(!response.ok) throw new Error(`HTTP ${response.status}`);
        body = await response.text();
    } catch(error) {
        console.error('[rank] download failed', error);
        await message.reply('很像網路出了一點小差錯，請再試一次看看');
        return;
    }

    // CSV columns used: [0] date, [2] channel id, [5] total message count.
    // The header row and channels outside the ranked categories are skipped.
    const rows = csv.parse(body).filter(row => {
        if(!/^\d{17,20}$/.test(row[2] ?? '')) return false;
        const channel = message.guild.channels.cache.get(row[2]);
        return channel !== undefined && RANK_CATEGORY_IDS.includes(channel.parentId);
    });
    if(rows.length === 0){
        await message.reply('檔案裡沒有找到可以排序的討論區');
        return;
    }

    rows.sort((a, b) => Number(b[5]) - Number(a[5]));

    const header = `根據${rows[0][0].substring(0,10)}的總訊息數做討論區人氣排序:`;
    const lines = rows.map((row, i) => `第${i + 1}名 <#${row[2]}> : ${row[5]}`);
    for(let i = 0; i < lines.length; i += RANK_LINES_PER_MESSAGE){
        const chunk = lines.slice(i, i + RANK_LINES_PER_MESSAGE).join('\n');
        await message.channel.send(i === 0 ? `${header}\n${chunk}` : chunk);
    }
}

module.exports = {
    prefix: prefix,
}
