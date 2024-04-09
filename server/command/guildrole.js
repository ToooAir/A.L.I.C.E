const {SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');
const {createGulidRole, deleteGulidRole, searchGuildRoleByRoleId} = require('../plugin/mysql');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('guild-role')
		.setDescription('伺服器資訊')
		.setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
        .addSubcommand(command => 
            command
            .setName('add')
            .setDescription('增加guild內的人統計身分組')
            .addRoleOption(option => option.setName('role').setDescription('選擇身分組').setRequired(true)))
		.addSubcommand(command => 
			command
			.setName('delete')
			.setDescription('刪除guild內的人統計身分組')
			.addRoleOption(option => option.setName('role').setDescription('選擇身分組').setRequired(true))),

	async execute(interaction) {
		const command = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

		switch (command) {
            case 'add':
                roleId = interaction.options.getRole('role').id;

                searchGuildRoleByRoleId(roleId).then(
                    result => {
                        if(result != undefined){
							interaction.reply(`<@&${roleId}>之前已經加入過了`);
                        }else{
                            createGulidRole(guildId, roleId)
                            .then(function(){
                                interaction.reply(`成功將<@&${roleId}>加入至guild`);
                            })
                        }
                    });
                break;

            case 'delete':
				roleId = interaction.options.getRole('role').id;

                deleteGulidRole(guildId)
                .then(function(){
                    interaction.reply(`已將<@&${roleId}>從guild中移除`);
                });
                break;
        }
	},
};