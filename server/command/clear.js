const {SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('clear')
		.setDescription('大規模訊息刪除')
        .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
        .setDMPermission(false)
        .addIntegerOption(option => option.setName('year').setDescription('西元年').setRequired(true))
        .addIntegerOption(option => option.setName('month').setDescription('月').setRequired(true))
        .addIntegerOption(option => option.setName('day').setDescription('日').setRequired(true))
        .addIntegerOption(option => option.setName('hour').setDescription('時(24小時制)').setRequired(true))
        .addIntegerOption(option => option.setName('minute').setDescription('分').setRequired(true)),

	async execute(interaction) {
        year = interaction.options.getInteger('year');
        month = interaction.options.getInteger('month');
        day = interaction.options.getInteger('day');
        hour = interaction.options.getInteger('hour');
        minute = interaction.options.getInteger('minute');

		var beforeTimeStamp = new Date(year,month-1,day,hour,minute).getTime();
        var now = Date.now();

        if(now-beforeTimeStamp<0){
            interaction.reply({content:'你學會了時空支配術要刪除未來訊息?', ephemeral: true });
        }else if(now-beforeTimeStamp>43200000){  
            interaction.reply({ content:'無法批次刪除超過12小時前的訊息', ephemeral: true });
        }else{
            var number = 0;
            var stop = false;
            do{
                await interaction.channel.messages.fetch({limit: 100})
                .then(messages => {
                    var checkmessage = [];
                    messages.forEach(message =>{
                        if(message.createdTimestamp>beforeTimeStamp){
                            checkmessage.push(message);
                            number++;
                        }else{
                            stop = true;
                        }
                    });
                    interaction.channel.bulkDelete(checkmessage);
                })
            }while(stop == false);
            await interaction.reply(`總共刪除了${number}則訊息`.toString());
        }
	},
};