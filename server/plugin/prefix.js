'use strict';
const request = require('request');
const csv = require('csv-string');

const {help} = require('./embed/responseEmbed');
const prefixM = require('../config').prefix;


function prefix(message) {
    let commandBody = message.content.slice(prefixM.length);
    let args = commandBody.split(' ');
    let command = args.shift();

    switch(command.toLowerCase()){
        case 'help':
            message.channel.send({embeds:[help()]});
            break;
	    case 'rank':
            channelRank(message);
            break;
        default:
            message.reply('已經將指令轉移至斜線命令，請嘗試 / 來叫出命令選單');
    }
}

function channelRank(message){
    if(message.member.permissions.has('ManageChannels')){
        if(message.attachments.size < 1){
            message.react('❔');
            message.reply('這個指令請搭配檔案上傳使用');
            return;
        }
        else if(!message.attachments.first().name.match(/\w+\.csv/)){
            message.react('❔');
            message.reply('請上傳正確的csv檔喔');
            return;
        }

        request.get(message.attachments.first().url,async function (error, response, body) {
            if (!error && response.statusCode == 200) {
                let parse = csv.parse(body);
                var childChannel = [];

                await parse.forEach(channel =>{
                    if(channel[2].match(/\d{18}/)){
                        var getChannel = message.guild.channels.cache.get(channel[2]);
                        if(getChannel.parentId == '1004665762453143612' 
                        || getChannel.parentId == '811570519216226304' ){
                            childChannel.push(channel);
                        }
                    }
                });

                childChannel.sort((a,b) => b[5] - a[5]);

                let count = 1;
                var sendMessage = `根據${childChannel[0][0].substring(0,10)}的總訊息數做討論區人氣排序:\n`;
                childChannel.forEach(async channel =>{
                    sendMessage += `第${count}名 <#${channel[2]}> : ${channel[5]}\n`;
                    count += 1;
                    if(count%30 == 0){
                        message.channel.send(sendMessage);
                        sendMessage = ``;
                    }
                });

                message.channel.send(sendMessage);
            }else{
                message.reply('很像網路出了一點小差錯，請再試一次看看');
            }
        });

    }else{
        message.reply('你的權限很像不夠喔，要不要先去提升再回來? :up:');
    }

}

module.exports = {
    prefix: prefix,
}
