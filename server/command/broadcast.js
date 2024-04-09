const {SlashCommandBuilder, PermissionFlagsBits  } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('broadcast')
		.setDescription('使用機器人廣播訊息')
        .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
        .setDMPermission(false)
        .addChannelOption(option => option.setName('channel').setDescription('選擇頻道').setRequired(true))
        .addStringOption(option => option.setName('message').setDescription('輸入訊息').setRequired(true)),

	async execute(interaction) {
        Inchannel = interaction.options.getChannel('channel');
        message = interaction.options.getString('message');
        await Inchannel.send(message);
		await interaction.reply({content:'廣播完成', ephemeral: true})
	},
};