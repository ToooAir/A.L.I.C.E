const fs = require('node:fs');
const path = require('node:path');
'use strict';
const {Client, GatewayIntentBits, EmbedBuilder, ActivityType, Partials, Collection, Events} = require('discord.js');
const {talk, replyInDM} = require('./plugin/talk');
const {readBackupChannel} = require('./plugin/mysql');
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
client.login(config.token);

// 準備
client.on('ready', () => {
    client.user.setActivity(`[${prefixM}help] 基礎神聖語`, { type: ActivityType.Playing });
    console.log(`[Ready] Logged in as ${client.user.tag}!`);
    require('./regCommand.js');
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'command');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}


client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content:'在執行這個指令的時候發生了錯誤！若持續發生請聯絡管理員🥺', ephemeral: true });
	}
});

// 訊息觸發
client.on('messageCreate',async message => {

    if(message.author.bot) return;

    // if(message.content.includes('@everyone')){
    //     message.delete();
    //     return;
    // }

    if(message.channel.type == 1){
        replyInDM(message);
        return;
    }
    if(message.content.startsWith(prefixM)){
        prefix(message);
    }else{
        talk(message);
    }
    return;

});

// 刪除訊息觸發
client.on('messageDelete', message => {
    readBackupChannel(message.guild.id).then(
        result => {
            if(result === undefined) return;
            if(message == null) return;

            var channelId = result['channelId'];
            var memberId = '';
            if(message.member != null && message.member.hasOwnProperty('id')){
                memberId = message.member.id;
            }else{
                memberId = message.author.id;
            }

            const embed = new EmbedBuilder()
            .setColor('#FF2D2D')
            .setAuthor({name:message.author.tag, iconURL:message.author.avatarURL()})
            .setDescription(`🗑 <@!${memberId}>在<#${message.channel.id}>的訊息被刪除了\n${message.content}`)
            .setTimestamp()
            if(message != null && message.hasOwnProperty('id')){
                embed.setFooter({text:'訊息ID：' +  message.id});
            }

            //保存刪除訊息的頻道
            message.guild.channels.cache.get(channelId).send({embeds:[embed]});
        }
    );
});

//反應訊息觸發
//可Fetch之前的訊息
client.on('messageReactionAdd', async function(messageReaction, user){

    if (messageReaction.message.partial) await messageReaction.message.fetch();
  
    if(messageReaction.message.content === 'Message'){
        if(user.bot){return}
        messageReaction.message.reply('It works.')
    }
    
});

