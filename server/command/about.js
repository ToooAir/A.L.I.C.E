const {SlashCommandBuilder } = require('discord.js');
const {aboutEmbed} = require('../plugin/embed/responseEmbed');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('about')
		.setDescription('愛麗絲的介紹'),

	async execute(interaction) {
		await interaction.reply({embeds:[aboutEmbed(Date.now() - interaction.createdAt)]});
	},
};