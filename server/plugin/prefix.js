'use strict';
const {help} = require('./embed/responseEmbed');
const config = require('../config');
const prefixM = config.prefix;

function prefix(message) {
    const commandBody = message.content.slice(prefixM.length);
    const args = commandBody.split(' ');
    const command = args.shift();

    switch(command.toLowerCase()){
        case 'help':
            message.channel.send({embeds:[help()]}).catch(console.error);
            break;
        case 'rank':
            message.reply('討論區排序已經改成 /rank 斜線指令，不需要再上傳 CSV 了').catch(console.error);
            break;
        default:
            message.reply('已經將指令轉移至斜線命令，請嘗試 / 來叫出命令選單').catch(console.error);
    }
}

module.exports = {
    prefix: prefix,
}
