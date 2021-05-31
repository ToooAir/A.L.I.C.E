'use strict';
const Discord = require('discord.js');
const client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
const {talk} = require('./plugin/talk');
const {prefix} = require('./plugin/prefix');
const config = require('./config');
const prefixM = require('./config').prefix;


// 登入
client.login(config.key);

// 準備
client.on('ready', () => {
    client.user.setActivity(`[${prefixM}help] 基礎神聖語`, { type: 'PLAYING' });
    console.log(`Logged in as ${client.user.tag}!`);
});



// 訊息觸發
client.on('message', msg => {

    if(msg.author.bot || msg.channel.type == 'dm') return;

    if(msg.content.startsWith(prefixM)){
        prefix(msg);
    }else{
        talk(msg);
    }

});

// 刪除訊息觸發
client.on('messageDelete', msg => {

    if(msg.content != ''){
        const embed = new Discord.MessageEmbed()
        .setColor('#FF2D2D')
        .setAuthor(msg.author.tag, msg.author.avatarURL())
        .setDescription(`🗑 <@!${msg.member.id}>在<#${msg.channel.id}>的訊息被刪除了\n${msg.content}`)
	    .setTimestamp()
        .setFooter('訊息ID：' +  msg.id);

        //保存刪除訊息的頻道
        msg.guild.channels.cache.get('831071520348569620').send(embed);

    }
    
});

//反應訊息觸發(未完成)
//可Fetch之前的訊息
client.on("messageReactionAdd", async function(messageReaction, user){

    if (messageReaction.message.partial) await messageReaction.message.fetch();

    console.log(messageReaction);
  
    if(messageReaction.message.content === "Message"){
        if(user.bot){return}
        messageReaction.message.reply("It works.")
    }
    
});

