const {SlashCommandBuilder } = require('discord.js');
const {replyHelp,replyAdd,replyUpdate,replyDelete} = require('../plugin/embed/responseEmbed');
const {reactionEmbed} = require('../plugin/embed/reactionEmbed');
const {createReply,readReply,updateReply,deleteReply, searchReply} = require('../plugin/mysql');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('reply')
		.setDescription('關鍵字回覆')
        .setDMPermission(false)
        .addSubcommand(command => 
            command
            .setName('add')
            .setDescription('新增關鍵字')
            .addStringOption(option => option.setName('input').setDescription('輸入一個字串').setRequired(true))
            .addStringOption(option => option.setName('output').setDescription('輸出一個字串').setRequired(true)))
        .addSubcommand(command => 
            command
            .setName('delete')
            .setDescription('刪除關鍵字')
            .addStringOption(option => option.setName('input').setDescription('輸入一個字串').setRequired(true)))
        .addSubcommand(command => 
            command
            .setName('search')
            .setDescription('搜尋關鍵字')
            .addStringOption(option => option.setName('input').setDescription('輸入一個字串')))
        .addSubcommand(command => 
            command
            .setName('help')
            .setDescription('關鍵字幫助')),

	async execute(interaction) {
        const command = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        switch (command) {
            case 'add':
                input = interaction.options.getString('input');
                output = interaction.options.getString('output');
                if(output.length > 1024){
                    interaction.reply({content:'你的回覆內容超過1024個字, 麻煩刪減至1024個字內喔', ephemeral: true});
                    return;
                };
                readReply(input, guildId).then(
                    result => {
                        if(result != undefined){
                            updateReply(input,output, guildId)
                            .then(function(){
                                const embed = replyUpdate(input,output,interaction.user);
                                interaction.reply({embeds:[embed]});
                            })
                        }else{
                            createReply(input,output, guildId)
                            .then(function(){
                                const embed = replyAdd(input,output,interaction.user);
                                interaction.reply({embeds:[embed]});
                            })
                        }
                    });
                break;

            case 'delete':
                input = interaction.options.getString('input');
                deleteReply(input, guildId)
                .then(function(){
                    const embed = replyDelete(input,interaction.user);
                    interaction.reply({embeds:[embed]});
                });
                break;

            case 'search':
                input = interaction.options.getString('input');
                if(input == null) input = '';
                searchReply(input, guildId).then(
                    result =>{
                        reactionEmbed(interaction,result);
                    });
                break;

            case 'help':
                interaction.reply({content:'連神聖語都念不好的孩子呢......', embeds:[replyHelp()]});
                break;
        }
	},
};