'use strict';
const {random} = require('../tool');
const {readReply, readReplyInDM} = require('./mysql')

function talk(message){
    replyMessage(message);
    greeting(message);
    ihateyou(message);
    // reactMsg(message);
}

function replyInDM(message){
    const content = message.content;
    readReplyInDM(content).then(
        result => {
            if(result === undefined) return;
            var replyWord = result['output'].split('^');
            message.channel.send(random(replyWord).replace('{m}', message.author));
        }
    ).catch(console.error);
}

function replyMessage(message){
    const content = message.content;
    const guildId = message.guildId;
    readReply(content, guildId).then(
        result => {
            if(result === undefined) return;
            var replyWord = result['output'].split('^');
            message.channel.send(random(replyWord).replace('{m}', message.author));
        }
    ).catch(console.error);
}

function greeting(message) {
    const greet_word = [
        '找我嗎?',
        '我還在值勤請不要打擾我',
        '愛麗絲在這，怎麼嗎?'
    ];

    const content = message.content;

    if (content.match('嗨愛麗絲')) {
        message.channel.send(random(greet_word));
    };
}

function ihateyou(message) {
    const content = message.content;

    if (content.match('^我討厭你((.?|.{2,32})$)')) {
        message.react('🥺');
        message.channel.send('你說真的嗎? 但我很喜歡你喔!');

        setTimeout(() => {
            message.author.send('不然我來當你朋友吧?');
        }, 3000);

        console.log(`[Log] Sent a love to ${message.author.username}`);
    }
};

// 全自動反應
function reactMsg(message){
    const content = message.content;
    if(message.author.id == '337540973166854146'){
        message.react(message.guild.emojis.cache.get('806092971258413096'));
    }
    if(message.author.id == '798352324804083763'){
        message.react(message.guild.emojis.cache.get('799328266531110964'));
        message.react(message.guild.emojis.cache.get('803666487634165790'));
    }
    if(content.match('星[\\s\\S]*爆')){
        message.react(message.guild.emojis.cache.get('785714278052397078'));
    }
}


module.exports = {
    talk: talk,
    replyInDM: replyInDM,
}
