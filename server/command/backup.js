const {SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');
const {createBackupChannel, readBackupChannel, updateBackupChannel, deleteBackupChannel} = require('../plugin/mysql');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('backup')
		.setDescription('伺服器刪除訊息備份')
        .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
        .setDMPermission(false)
        .addSubcommand(command => 
            command
            .setName('add')
            .setDescription('新增頻道來儲存備份訊息')
            .addChannelOption(option => option.setName('channel').setDescription('選擇頻道').setRequired(true)))
        .addSubcommand(command => 
            command
            .setName('delete')
            .setDescription('刪除頻道來關閉備份功能')),

	async execute(interaction) {
        const command = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        switch (command) {
            case 'add':
                channelId = interaction.options.getChannel('channel').id;

                readBackupChannel(guildId).then(
                    result => {
                        if(result != undefined){
                            updateBackupChannel(guildId, channelId)
                            .then(function(){
                                interaction.reply(`已成功將備份頻道更改成<#${channelId}>`);
                            })
                        }else{
                            createBackupChannel(guildId, channelId)
                            .then(function(){
                                interaction.reply(`成功將<#${channelId}>設定成訊息備份頻道`);
                            })
                        }
                    });
                break;

            case 'delete':

                deleteBackupChannel(guildId)
                .then(function(){
                    interaction.reply('已將備份頻道刪除，備份功能關閉');
                });
                break;
        }
	},
};