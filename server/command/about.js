const {SlashCommandBuilder } = require('discord.js');
const {aboutEmbed} = require('../plugin/embed/responseEmbed');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('about')
		.setDescription('愛麗絲的介紹'),

	async execute(interaction) {
		const response = await interaction.reply({content:'正在計算指令延遲.......', withResponse: true});
		const msg = response.resource.message;
		let ping = msg.createdTimestamp - interaction.createdTimestamp
		await interaction.editReply({content:'', embeds:[aboutEmbed(ping)]});
	},
};