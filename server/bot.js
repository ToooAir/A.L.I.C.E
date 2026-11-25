'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {Client, GatewayIntentBits, EmbedBuilder, ActivityType, Partials, Collection, Events, ChannelType, MessageFlags} = require('discord.js');
const {talk, replyInDM} = require('./plugin/talk');
const {readBackupChannel, readChatMemory, saveChatMemory} = require('./plugin/mysql');
const {isUnauthorizedEveryone} = require('./plugin/permission');
const {recordMessage} = require('./plugin/activity');
const {createChat, loadProvider} = require('./plugin/chat');
const config = require('./config');

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
client.login(config.token).catch(error => {
    // Exit non-zero so the process manager (pm2 / Docker restart policy) sees the failure and retries.
    console.error('[Login failed]', error);
    process.exit(1);
});

// 準備
client.once(Events.ClientReady, () => {
    client.user.setActivity({ type: ActivityType.Custom, name: 'custom', state: '⚔️ 輸入 / 使用指令' });
    console.log(`[Ready] Logged in as ${client.user.tag}!`);
});

client.commands = new Collection();

// LLM replies when Alice is mentioned; inactive until config.chat.provider is set.
const chat = createChat({
    provider: loadProvider(config.chat),
    botId: () => client.user.id,
    memory: {read: readChatMemory, save: saveChatMemory},
    dailyLimit: config.chat?.dailyLimit,
    cooldownSeconds: config.chat?.cooldownSeconds,
});

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
		const errorReply = { content:'在執行這個指令的時候發生了錯誤！若持續發生請聯絡管理員🥺', flags: MessageFlags.Ephemeral };
		try {
			if (interaction.replied || interaction.deferred) await interaction.followUp(errorReply);
			else await interaction.reply(errorReply);
		} catch (replyError) {
			console.error(replyError);
		}
	}
});

// 訊息觸發
client.on(Events.MessageCreate, async message => {

    if(message.author.bot) return;

    if(isUnauthorizedEveryone(message)){
        message.delete().catch(error => console.error('[@everyone filter]', error));
        return;
    }

    if(message.channel.type === ChannelType.DM){
        replyInDM(message);
        return;
    }

    recordMessage(message);

    try {
        if(await chat.handle(message)) return;
    } catch (error) {
        console.error('[chat]', error);
    }
    talk(message);
});

// 刪除訊息觸發
client.on(Events.MessageDelete, async message => {
    try {
        // DMs have no guild; uncached (partial) messages have no author/content to back up.
        if(!message.guild || message.partial || !message.author) return;
        // Alice's own messages (search results, backups, ...) aren't worth backing up.
        if(message.author.id === client.user.id) return;

        const result = await readBackupChannel(message.guild.id);
        if(result === undefined) return;

        const backupChannel = message.guild.channels.cache.get(result['channelId']);
        // Deleting something inside the backup channel itself shouldn't produce another backup.
        if(!backupChannel || message.channelId === backupChannel.id) return;

        const memberId = message.member?.id ?? message.author.id;

        const embed = new EmbedBuilder()
        .setColor('#FF2D2D')
        .setAuthor({name:message.author.tag, iconURL:message.author.avatarURL() ?? undefined})
        // Embed descriptions max out at 4096 characters; long (Nitro) messages are truncated.
        .setDescription(`🗑 <@!${memberId}>在<#${message.channel.id}>的訊息被刪除了\n${message.content}`.slice(0, 4096))
        .setTimestamp()
        .setFooter({text:'訊息ID：' + message.id});

        //保存刪除訊息的頻道
        await backupChannel.send({embeds:[embed]});
    } catch (error) {
        console.error('[messageDelete]', error);
    }
});

// Last-resort guard so one failed promise doesn't take the whole bot down.
process.on('unhandledRejection', error => {
    console.error('[unhandledRejection]', error);
});
