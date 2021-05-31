'use strict';
const {messageValue, reply, replyInPM, random, isBot} = require('../tool');
const {readReply} = require('./mysql')

function talk(inMsg){
    replyMessage(inMsg);
    greeting(inMsg);
    ihateyou(inMsg);
    // reactMsg(inMsg);
}

function replyMessage(inMsg){
    let msg = messageValue(inMsg);

    readReply(msg).then(
        result => {
            if(result === undefined) return;
            var replyWord = result['output'].split('^');
            reply(inMsg, random(replyWord).replace('{m}', inMsg.author));
        }
    );
}

function greeting(inMsg) {
    const greet_word = [
        "找我嗎?",
        "我還在值勤請不要打擾我",
        "愛麗絲在這，怎麼嗎?"
    ];

    let msg = messageValue(inMsg);

    if (msg.match("嗨愛麗絲")) {
        reply(inMsg, random(greet_word));
    };
}

function ihateyou(inMsg) {
    let msg = messageValue(inMsg);

    if (msg.match("^我討厭你((.?|.{2,32})$)")) {
        reply(inMsg, "你說真的嗎? 但我很喜歡你喔!");

        setTimeout(() => {
            replyInPM(inMsg, "不然我來當你朋友吧?")
        }, 3000);

        console.log(`Sent a love to ${inMsg.author.username}`);
    }
};

function reactMsg(inMsg){
    let msg = messageValue(inMsg);
    if(inMsg.author.id == '337540973166854146'){
        inMsg.react(inMsg.guild.emojis.cache.get("806092971258413096"));
    }
    if(inMsg.author.id == '798352324804083763'){
        inMsg.react(inMsg.guild.emojis.cache.get("799328266531110964"));
        inMsg.react(inMsg.guild.emojis.cache.get("803666487634165790"));
    }
    if(msg.match('星[\\s\\S]*爆')){
        inMsg.react(inMsg.guild.emojis.cache.get("785714278052397078"));
    }
}


module.exports = {
    talk: talk,
}
