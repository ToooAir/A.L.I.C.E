const {SlashCommandBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType} = require('discord.js');
const {checkAssignableRole} = require('../plugin/permission');
const {ensureMembersCached} = require('../tool');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('give-role-with-role')
		.setDescription('給予一個身分組的人另一個身分組')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .setContexts(InteractionContextType.Guild)
        .addRoleOption(option => option.setName('member-role').setDescription('接收的身分組').setRequired(true))
        .addRoleOption(option => option.setName('give-role').setDescription('要給出的身分組').setRequired(true)),

	async execute(interaction) {
        const memberRole = interaction.options.getRole('member-role');
        const giveRole = interaction.options.getRole('give-role');
        const error = await checkAssignableRole(interaction, giveRole);
        if(error){
            await interaction.reply({content: error, flags: MessageFlags.Ephemeral});
            return;
        }
        await interaction.deferReply({flags: MessageFlags.Ephemeral});
        // role.members only sees cached members; load everyone first so nobody is skipped.
        await ensureMembersCached(interaction.guild);
        await Promise.all(memberRole.members.map(member => member.roles.add(giveRole)));
        await interaction.editReply('給予成功');
	},
};