const {SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('give-role')
		.setDescription('給予一個人身分組')
        .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
        .setDMPermission(false)
        .addUserOption(option => option.setName('member').setDescription('選擇成員').setRequired(true))
        .addRoleOption(option => option.setName('role').setDescription('選擇身分組').setRequired(true)),

	async execute(interaction) {
        member = interaction.options.getUser('member');
        role = interaction.options.getRole('role');
        if(role.permissions.has('Administrator', true)){
            await interaction.reply({content:'管理員權限的身分組是不被允許給其他人的', ephemeral: true});
        }
        else{
            await interaction.guild.members.cache.get(member.id).roles.add(role);
            await interaction.reply({content:'給予成功', ephemeral: true});
        }
	},
};