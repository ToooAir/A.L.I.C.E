const {SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');
const {checkAssignableRole} = require('../plugin/permission');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('give-role-with-role')
		.setDescription('給予一個身分組的人另一個身分組')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .setDMPermission(false)
        .addRoleOption(option => option.setName('member-role').setDescription('接收的身分組').setRequired(true))
        .addRoleOption(option => option.setName('give-role').setDescription('要給出的身分組').setRequired(true)),

	async execute(interaction) {
        const memberRole = interaction.options.getRole('member-role');
        const giveRole = interaction.options.getRole('give-role');
        const error = await checkAssignableRole(interaction, giveRole);
        if(error){
            await interaction.reply({content: error, ephemeral: true});
            return;
        }
        await interaction.deferReply({ephemeral: true});
        await Promise.all(memberRole.members.map(member => member.roles.add(giveRole)));
        await interaction.editReply('給予成功');
	},
};