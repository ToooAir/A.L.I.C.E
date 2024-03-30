'use strict';
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType, Partials} = require('discord.js');
const {talk} = require('./plugin/talk');
const {prefix} = require('./plugin/prefix');
const config = require('./config');
const prefixM = require('./config').prefix;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});


// 登入
client.login(config.key);

// 準備
client.on('ready', () => {
    client.user.setActivity(`[${prefixM}help] 基礎神聖語`, { type: ActivityType.Playing });
    console.log(`[Ready] Logged in as ${client.user.tag}!`);
});



// 訊息觸發
client.on('messageCreate',async msg => {

    if(msg.author.bot) return;

    if(msg.content.includes("@everyone")){
        msg.delete();
        return;
    }

    if(msg.channel.type == 1){
	// 檢查為DMChannel
        talk(msg);
        return;
    }

    if(msg.content.startsWith(prefixM)){
        prefix(msg);
    }else{
        talk(msg);
    }
    return;

});

// 刪除訊息觸發
client.on('messageDelete', msg => {

    if(msg.content != ''){
        
        var memberId = '';
        if(msg.member != null && msg.member.hasOwnProperty('id')){
            memberId = msg.member.id;
        }else{
            memberId = msg.author.id;
        }
        

        const embed = new EmbedBuilder()
        .setColor('#FF2D2D')
        .setAuthor({name:msg.author.tag, iconURL:msg.author.avatarURL()})
        .setDescription(`🗑 <@!${memberId}>在<#${msg.channel.id}>的訊息被刪除了\n${msg.content}`)
	    .setTimestamp()

        if(msg != null && msg.hasOwnProperty('id')){
            embed.setFooter({text:'訊息ID：' +  msg.id});
        }
        

        //保存刪除訊息的頻道
        msg.guild.channels.cache.get('831071520348569620').send({embeds:[embed]});

    }
    
});

//反應訊息觸發(未完成)
//可Fetch之前的訊息
client.on("messageReactionAdd", async function(messageReaction, user){

    if (messageReaction.message.partial) await messageReaction.message.fetch();
  
    if(messageReaction.message.content === "Message"){
        if(user.bot){return}
        messageReaction.message.reply("It works.")
    }
    
});

