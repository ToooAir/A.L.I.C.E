'use strict';
const request = require('request');
const csv = require('csv-string');

const {help,replyHelp,replyAdd,replyUpdate,replyDelete,aboutEmbed,guildEmbed} = require('./embed/responseEmbed');
const {createReply,readReply,updateReply,deleteReply, searchReply} = require('./mysql');
const prefixM = require('../config').prefix;
const {reactionEmbed} = require('./embed/reactionEmbed');


function prefix(msg) {
    const commandBody = msg.content.slice(prefixM.length);
    const args = commandBody.split(' ');
    const command = args.shift();

    switch(command.toLowerCase()){
        case 'help':
            msg.channel.send({embeds:[help()]});
            break;
        case 'reply':
            reply(msg, args);
            break;
        case 'clear':
	    clear(msg, args);
            break;
	case 'broadcast':
            broadcast(msg, args);
            break;
	case 'give':
            give(msg,args);
            break;
	case 'role':
            role(msg, args);
            break;
        case 'about':
            about(msg);
            break;
        case 'guild':
            guild(msg);
            break;
	case 'rank':
            channelRank(msg);
            break;
        default:
            msg.reply('這是我沒有聽過的神聖語呢');
    }
}

function reply(msg,args){
    if(args.length < 1){
        msg.reply({content:'連神聖語都念不好的孩子呢......', embeds:[replyHelp()]});
        return;
    }

    const action = args.shift();
    const input = args[0];
    

    switch(action.toLowerCase()){
        case 'add':
	    if(args.length < 2 || input === ''){
                msg.reply({content:'這個神聖語的參數不完整呢', embeds:[replyHelp()]});
                return;
            };

            const output = msg.content.split(`${action} ${input} `)[1];

            if(output.length > 1024){
                msg.reply('你的回覆內容超過1024個字, 麻煩刪減至1024個字內喔');
                return;
            };

            readReply(input).then(
                result => {
                    if(result != undefined){
                        updateReply(input,output)
                        .then(function(){
                            const embed = replyUpdate(input,output,msg.author);
                            msg.reply({embeds:[embed]});
                        })
                    }else{
                        createReply(input,output)
                        .then(function(){
                            const embed = replyAdd(input,output,msg.author);
                            msg.reply({embeds:[embed]});
                        })
                    }
                });
            break;

        case 'delete':
            deleteReply(input)
                .then(function(){
                    const embed = replyDelete(input,msg.author);
                    msg.reply({embeds:[embed]});
                });
            break;

        case 'search':
            searchReply(input).then(
                result =>{
                    reactionEmbed(msg,result);
                });
            break;
        default:
            msg.reply({content:'你的神聖語是不是念錯了?', embeds:[replyHelp()]});
    }

}

async function clear(msg,args){
    if(msg.channel.permissionsFor(msg.author).has('MANAGE_MESSAGES', true)){
        if(args.length != 5){
            msg.react('❔');
            msg.reply('請按照 [西元年] [月] [日] [時(24小時)] [分] 輸入');
	    return;
        }

        var beforeTimeStamp = new Date(args[0],args[1]-1,args[2],args[3],args[4]).getTime();
        var now = Date.now();

        if(now-beforeTimeStamp<0){
            msg.reply('你學會了時空支配術要刪除未來訊息?');
        }else if(now-beforeTimeStamp>43200000){
            msg.reply('無法批次刪除超過12小時前的訊息');
        }else{
            var number = 0;
            var stop = false;
            do{
                await msg.channel.messages.fetch({limit: 100})
                .then(messages => {
                    var checkmessage = [];
                    messages.forEach(message =>{
                        if(message.createdTimestamp>beforeTimeStamp){
                            checkmessage.push(message);
                            number++;
                        }else{
                            stop = true;
                        }
                    });
                    msg.channel.bulkDelete(checkmessage);
                })
            }while(stop == false);
            msg.reply(`總共刪除了${number}則訊息`.toString());
        }

    }else{
        msg.reply('你的權限很像不夠喔，要不要先去提升再回來? :up:');
    }

}

function broadcast(msg,args){
    if(args.length < 2){
	msg.react('❔');
        return;
    }

    if(msg.member.permissions.has("VIEW_AUDIT_LOG")){
        const channel = args[0];
        const broadcastMsg = msg.content.split(channel+' ')[1];

        if (broadcastMsg !== "" && channel.match(/(?:^<#)(\d+)(?:>$)/)) {
            const InChannel = msg.guild.channels.cache.get(channel.match(/(?:^<#)(\d+)(?:>$)/)[1]); 
            if(InChannel){
                InChannel.send(broadcastMsg);
		msg.react('✅');
            }else{
                msg.reply('找不到你輸入的頻道喔!');
            }

        }else{
            msg.reply('神聖語唸成這樣子你是要做什麼啦?');
        }
        
    }else{
        msg.reply('你的權限很像不夠喔，要不要先去提升再回來? :up:');
    }

}

function give(msg,args){
    if(args.length < 2){
        msg.react('❔');
        return;
    }


    if(msg.member.permissions.has("MANAGE_MESSAGES")){
        var memberArgs = args[0].match(/(?:^<@!)(\d+)(?:>$)/);
        var giveRoleArgs = args[1].match(/(?:^<@&)(\d+)(?:>$)/);

        if(memberArgs && giveRoleArgs){
            var member = msg.guild.members.cache.get(memberArgs[1]);
            var giveRole = msg.guild.roles.cache.get(giveRoleArgs[1]);

            if(member && giveRole){
                if(giveRole.permissions.has('ADMINISTRATOR', true)){
                    msg.reply('管理員權限的身分組是不被允許給其他人的');
                }else{
                    member.roles.add(giveRole);
                    msg.react('✅');
                }

            }else{
                msg.reply('找不到你輸入的身分組喔!');
            }

        }else{
            msg.reply('你輸入的格式有錯誤，請檢查一下');
        }

    }else{
        msg.reply('你的權限很像不夠喔，要不要先去提升再回來? :up:');
    }

}

function role(msg,args){
    if(args.length < 2){
	msg.react('❔');
        return;
    }


    if(msg.member.permissions.has("MANAGE_ROLES")){
        var memberRoleArgs = args[0].match(/(?:^<@&)(\d+)(?:>$)/);
        var giveRoleArgs = args[1].match(/(?:^<@&)(\d+)(?:>$)/);

        if(memberRoleArgs && giveRoleArgs){
            var memberRole = msg.guild.roles.cache.get(memberRoleArgs[1]);
            var giveRole = msg.guild.roles.cache.get(giveRoleArgs[1]);

            if(memberRole && giveRole){
		if(giveRole.permissions.has('ADMINISTRATOR', true)){
                    msg.reply('管理員權限的身分組是不被允許給其他人的');
                }else{
                    memberRole.members.forEach(member =>{
                        member.roles.add(giveRole);
                    });
                    msg.react('✅');
                }

            }else{
                msg.reply('找不到你輸入的身分組喔!');
            }

        }else{
            msg.reply('你輸入的格式有錯誤，請檢查一下');
        }

    }else{
        msg.reply('你的權限很像不夠喔，要不要先去提升再回來? :up:');
    }
    
}

function channelRank(msg){
    if(msg.member.permissions.has("MANAGE_CHANNELS")){
        if(msg.attachments.size < 1){
            msg.react('❔');
            msg.reply('這個指令請搭配檔案上傳使用');
            return;
        }
        else if(!msg.attachments.first().name.match(/\w+\.csv/)){
            msg.react('❔');
            msg.reply('請上傳正確的csv檔喔');
            return;
        }

        request.get(msg.attachments.first().url,async function (error, response, body) {
            if (!error && response.statusCode == 200) {
                const parse = csv.parse(body);
                var childChannel = [];

                await parse.forEach(channel =>{
                    if(channel[2].match(/\d{18}/)){
                        var getChannel = msg.guild.channels.cache.get(channel[2]);
                        if(getChannel.parentId == '811570519216226304' 
                        || getChannel.parentId == '834359296183238716' 
                        || getChannel.parentId == '851355842367717376'
                        || getChannel.parentId == '870598474817749002'){
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
                        msg.channel.send(sendMessage);
                        sendMessage = ``;
                    }
                });

                msg.channel.send(sendMessage);
            }else{
                msg.reply('很像網路出了一點小差錯，請再試一次看看');
            }
        });

    }else{
        msg.reply('你的權限很像不夠喔，要不要先去提升再回來? :up:');
    }

}

function about(msg){
    msg.channel.send({embeds:[aboutEmbed(Date.now() - msg.createdAt)]});
}

async function guild(msg){
    msg.channel.send({embeds:[await guildEmbed(msg)]});
}

module.exports = {
    prefix: prefix,
}
