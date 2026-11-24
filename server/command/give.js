const {SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');
const {checkAssignableRole} = require('../plugin/permission');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('give-role')
		.setDescription('給予一個人身分組')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .setDMPermission(false)
        .addUserOption(option => option.setName('member').setDescription('選擇成員').setRequired(true))
        .addRoleOption(option => option.setName('role').setDescription('選擇身分組').setRequired(true)),

	async execute(interaction) {
        const member = interaction.options.getMember('member');
        const role = interaction.options.getRole('role');
        if(!member){
            await interaction.reply({content:'這個人不在伺服器裡', ephemeral: true});
            return;
        }
        const error = await checkAssignableRole(interaction, role);
        if(error){
            await interaction.reply({content: error, ephemeral: true});
            return;
        }
        await member.roles.add(role);
        await interaction.reply({content:'給予成功', ephemeral: true});
	},
};