const {SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, InteractionContextType} = require('discord.js');
const {readChannelActivity, readActivityStartDay} = require('../plugin/mysql');
const {localDay} = require('../plugin/activity');
const config = require('../config');

// Categories ranked when no category option is given. Override with `rankCategoryIds` in config.js.
const RANK_CATEGORY_IDS = config.rankCategoryIds ?? ['1004665762453143612', '811570519216226304'];
const DEFAULT_DAYS = 7;
const MAX_DAYS = 90;
// Lines per Discord message; keeps each message well under the 2000-character limit.
const LINES_PER_MESSAGE = 30;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rank')
		.setDescription('依最近的訊息數排序分類底下的頻道')
		.setContexts(InteractionContextType.Guild)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
		.addIntegerOption(option => option.setName('days').setDescription(`統計最近幾天（預設 ${DEFAULT_DAYS}）`)
			.setMinValue(1).setMaxValue(MAX_DAYS))
		.addChannelOption(option => option.setName('category').setDescription('要排序的分類（預設使用設定檔中的分類）')
			.addChannelTypes(ChannelType.GuildCategory)),

	async execute(interaction) {
		const days = interaction.options.getInteger('days') ?? DEFAULT_DAYS;
		const category = interaction.options.getChannel('category');
		const categoryIds = category ? [category.id] : RANK_CATEGORY_IDS;

		const channels = interaction.guild.channels.cache
			.filter(channel => !channel.isThread() && categoryIds.includes(channel.parentId));
		if(channels.size === 0){
			await interaction.reply({content:'這個分類底下沒有頻道可以排序', flags: MessageFlags.Ephemeral});
			return;
		}

		await interaction.deferReply();

		// "Last N days" includes today.
		const start = new Date();
		start.setDate(start.getDate() - (days - 1));
		const sinceDay = localDay(start);

		const [rows, firstDay] = await Promise.all([
			readChannelActivity(interaction.guildId, sinceDay),
			readActivityStartDay(interaction.guildId),
		]);
		const counts = new Map(rows.map(row => [row.channelId, Number(row.total)]));

		// Channels with no messages are kept (count 0) so quiet ones show up at the bottom.
		const ranked = [...channels.values()]
			.map(channel => ({channel, total: counts.get(channel.id) ?? 0}))
			.sort((a, b) => b.total - a.total || a.channel.rawPosition - b.channel.rawPosition);

		let header = `最近 ${days} 天（${sinceDay} 起）各頻道的訊息數：`;
		if(firstDay === null){
			header += '\n⚠️ 目前還沒有累積任何資料，愛麗絲會從現在開始計算';
		}else if(firstDay > sinceDay){
			header += `\n⚠️ 資料從 ${firstDay} 開始累積，更早的訊息沒有計算到`;
		}

		const lines = ranked.map((item, i) => `第${i + 1}名 <#${item.channel.id}> : ${item.total}`);
		for(let i = 0; i < lines.length; i += LINES_PER_MESSAGE){
			const chunk = lines.slice(i, i + LINES_PER_MESSAGE).join('\n');
			const payload = {content: i === 0 ? `${header}\n${chunk}` : chunk, allowedMentions:{parse:[]}};
			if(i === 0) await interaction.editReply(payload);
			else await interaction.followUp(payload);
		}
	}
};
