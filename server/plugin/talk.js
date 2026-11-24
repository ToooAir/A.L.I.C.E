'use strict';
const {random} = require('../tool');
const {readReply, readReplyInDM} = require('./mysql');

function talk(message){
    replyMessage(message);
    greeting(message);
    ihateyou(message);
}

// Send a keyword reply: `output` may hold several answers separated by ^ (one is picked at random),
// and every {m} is replaced with a mention of the author.
async function sendKeywordReply(message, result){
    if(result === undefined) return;
    const answers = result['output'].split('^');
    await message.channel.send(random(answers).replaceAll('{m}', message.author.toString()));
}

function replyInDM(message){
    readReplyInDM(message.content)
        .then(result => sendKeywordReply(message, result))
        .catch(console.error);
}

function replyMessage(message){
    readReply(message.content, message.guildId)
        .then(result => sendKeywordReply(message, result))
        .catch(console.error);
}

function greeting(message) {
    const greetWords = [
        '找我嗎?',
        '我還在值勤請不要打擾我',
        '愛麗絲在這，怎麼嗎?'
    ];

    if (message.content.includes('嗨愛麗絲')) {
        message.channel.send(random(greetWords)).catch(console.error);
    }
}

function ihateyou(message) {
    if (/^我討厭你((.?|.{2,32})$)/.test(message.content)) {
        message.react('🥺').catch(console.error);
        message.channel.send('你說真的嗎? 但我很喜歡你喔!').catch(console.error);

        setTimeout(() => {
            // Fails if the user has DMs closed; that's fine.
            message.author.send('不然我來當你朋友吧?').catch(console.error);
        }, 3000);

        console.log(`[Log] Sent a love to ${message.author.username}`);
    }
}

module.exports = {
    talk: talk,
    replyInDM: replyInDM,
}
