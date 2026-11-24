'use strict';
const {PermissionFlagsBits} = require('discord.js');

/**
 * Check whether the invoking member may hand out `role`.
 * Mirrors Discord's own rule: you can only manage roles strictly below your highest role
 * (the guild owner is exempt). Also rejects roles the bot itself cannot assign.
 *
 * @returns {Promise<string|null>} An error message to show the user, or null if allowed.
 */
async function checkAssignableRole(interaction, role){
    const guild = interaction.guild;

    if(role.id === guild.id) return '無法給予 @everyone 身分組';
    if(role.managed) return '這是由整合服務（Bot / 加成）管理的身分組，無法手動給予';
    if(role.permissions.has('Administrator', true)) return '管理員權限的身分組是不被允許給其他人的';

    if(interaction.user.id !== guild.ownerId){
        const invoker = await guild.members.fetch(interaction.user.id);
        if(role.comparePositionTo(invoker.roles.highest) >= 0){
            return `你只能給予比你最高身分組（${invoker.roles.highest}）還低的身分組`;
        }
    }

    if(!role.editable) return '愛麗絲的身分組位階不夠或缺少管理身分組權限，無法給予這個身分組';

    return null;
}

/**
 * Whether a guild message contains "@everyone" typed by someone who is not allowed to mention everyone
 * in that channel. Checks the text rather than `message.mentions.everyone`, because Discord reports
 * no mention at all when the author lacks the permission — which is exactly the case we want to catch.
 */
function isUnauthorizedEveryone(message){
    if(!message.guild || !message.member) return false; // DMs: nothing to moderate (and can't delete)
    if(!message.content.includes('@everyone')) return false;
    return !message.member.permissionsIn(message.channel).has(PermissionFlagsBits.MentionEveryone);
}

module.exports = {
    checkAssignableRole: checkAssignableRole,
    isUnauthorizedEveryone: isUnauthorizedEveryone,
}
