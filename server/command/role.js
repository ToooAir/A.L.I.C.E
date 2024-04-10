const {SlashCommandBuilder, PermissionFlagsBits  } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('give-role-with-role')
		.setDescription('給予一個身分組的人另一個身分組')
        .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
        .setDMPermission(false)
        .addRoleOption(option => option.setName('member-role').setDescription('接收的身分組').setRequired(true))
        .addRoleOption(option => option.setName('give-role').setDescription('要給出的身分組').setRequired(true)),

	async execute(interaction) {
        memberRole = interaction.options.getRole('member-role');
        giveRole = interaction.options.getRole('give-role');
        if(giveRole.permissions.has('Administrator', true)){
            await interaction.reply({content:'管理員權限的身分組是不被允許給其他人的', ephemeral: true});
        }
        else{
            await interaction.deferReply({ephemeral: true});
            await memberRole.members.forEach(member =>{member.roles.add(giveRole);});
            await interaction.editReply('給予成功');
        }
	},
};