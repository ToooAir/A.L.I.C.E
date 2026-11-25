const {SlashCommandBuilder, MessageFlags, InteractionContextType} = require('discord.js');
const {readChatMemory, deleteChatMemory} = require('../plugin/mysql');

// Lets members see or clear what Alice remembers about them from chats. Replies are private.
module.exports = {
	data: new SlashCommandBuilder()
		.setName('chat')
		.setDescription('愛麗絲的聊天記憶')
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(command => command.setName('memory').setDescription('查看愛麗絲記得關於你的哪些事'))
		.addSubcommand(command => command.setName('forget').setDescription('讓愛麗絲忘記關於你的事')),

	async execute(interaction) {
		const {guildId} = interaction;
		const userId = interaction.user.id;

		switch (interaction.options.getSubcommand()) {
			case 'memory': {
				const notes = await readChatMemory(guildId, userId);
				const content = notes ? `愛麗絲記得的事：\n${notes}` : '愛麗絲目前還沒有關於你的記憶';
				await interaction.reply({content, flags: MessageFlags.Ephemeral});
				break;
			}
			case 'forget': {
				const removed = await deleteChatMemory(guildId, userId);
				const content = removed ? '已經忘記了。……雖然有點可惜。' : '愛麗絲本來就沒有關於你的記憶';
				await interaction.reply({content, flags: MessageFlags.Ephemeral});
				break;
			}
		}
	},
};
