const {SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');
const {guildEmbed} = require('../plugin/embed/responseEmbed');
const {readGuildRole} = require('../plugin/mysql');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('guild')
		.setDescription('查看伺服器資訊')
		.setDMPermission(false),

	async execute(interaction) {
        const guildId = interaction.guildId;

		readGuildRole(guildId).then(
			async result =>{
				await interaction.reply({embeds:[await guildEmbed(interaction, result)]});
			});
	}
};