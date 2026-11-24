const {SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('clear')
		.setDescription('大規模訊息刪除')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false)
        .addIntegerOption(option => option.setName('year').setDescription('西元年').setRequired(true))
        .addIntegerOption(option => option.setName('month').setDescription('月').setRequired(true))
        .addIntegerOption(option => option.setName('day').setDescription('日').setRequired(true))
        .addIntegerOption(option => option.setName('hour').setDescription('時(24小時制)').setRequired(true))
        .addIntegerOption(option => option.setName('minute').setDescription('分').setRequired(true)),

	async execute(interaction) {
        const year = interaction.options.getInteger('year');
        const month = interaction.options.getInteger('month');
        const day = interaction.options.getInteger('day');
        const hour = interaction.options.getInteger('hour');
        const minute = interaction.options.getInteger('minute');

		var before = new Date(year,month-1,day,hour,minute).getTime();
        var now = interaction.createdTimestamp;

        if(now-before<0){
            await interaction.reply({content:'你學會了時空支配術要刪除未來訊息?', ephemeral: true });
        }else if(now-before>43200000){  
            await interaction.reply({ content:'無法批次刪除超過12小時前的訊息', ephemeral: true });
        }else{
            let number = 0;
            let cursor;  // page backwards with `before` so each batch is a new set of messages
            await interaction.reply({ content:'清掃🧹開始', fetchReply: true});
            while(true){
                const messages = await interaction.channel.messages.fetch({limit: 100, before: cursor});
                if(messages.size == 0) break;

                // Skip messages newer than the command (e.g. the reply above); stop once older than `before`.
                const inRange = messages.filter(m => m.createdTimestamp > before && m.createdTimestamp < now);
                if(inRange.size > 0){
                    await interaction.channel.bulkDelete(inRange);
                    number += inRange.size;
                }

                const reachedOlder = messages.some(m => m.createdTimestamp <= before);
                if(reachedOlder || messages.size < 100) break;
                cursor = messages.lastKey();
            }
            await interaction.editReply({ content:`總共刪除了${number}則訊息`});
        }
	},
};