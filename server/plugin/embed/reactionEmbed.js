'use strict';
const {EmbedBuilder} = require('discord.js');

// Discord rejects an embed whose text adds up to more than 6000 characters, so a page holds
// at most 10 results and stops early once the next field would push it past the budget.
const FIELDS_PER_PAGE = 10;
const PAGE_CHAR_BUDGET = 5500; // leaves room for title, description and footer

function paginate(result){
    const pages = [];
    let current = [];
    let chars = 0;
    for(const row of result){
        const size = row['input'].length + row['output'].length;
        if(current.length > 0 && (current.length === FIELDS_PER_PAGE || chars + size > PAGE_CHAR_BUDGET)){
            pages.push(current);
            current = [];
            chars = 0;
        }
        current.push({name: row['input'], value: row['output']});
        chars += size;
    }
    if(current.length > 0) pages.push(current);
    return pages.map((fields, i) => searchEmbed().addFields(fields).setFooter({text:`page${i + 1}/${pages.length}`}));
}

async function reactionEmbed(interaction, result){
    const pages = paginate(result);
    const options = {
        limit: 30 * 1000,
        min: 0,
        max: pages.length - 1,
        page: 0
    }

    const m = await interaction.reply({ embeds:[pages[options.page]], fetchReply: true});

    await m.react('⬅');
    await m.react('➡');
    await m.react('🗑');
    
    const filter = (reaction, user) => {
        return ['⬅', '➡', '🗑'].includes(reaction.emoji.name) && user.id == interaction.user.id;
    };

    awaitReactions(interaction, m, options, filter, pages);
}

const awaitReactions = async (interaction, m, options, filter, pages) => {

    const reactionCollector = m.createReactionCollector({ filter, time: options.limit, dispose: true});
    reactionCollector.on('collect', async (reaction, user) => {
        if (reaction.emoji.name === '⬅') {
            await removeReaction(m, interaction, '⬅');
            if (options.page != options.min) {
                --options.page;
                await m.edit({embeds:[pages[options.page]]});
            }
        }
        else if (reaction.emoji.name === '➡') {
            await removeReaction(m, interaction, '➡');
            if (options.page != options.max) {
                ++options.page;
                await m.edit({embeds:[pages[options.page]]});
            }
        }
        else if (reaction.emoji.name === '🗑') {
            reactionCollector.stop('messageDelete');
            await m.delete();
        }
    });
    reactionCollector.on('end', (collected, reason) => {
        if(reason == 'time'){
            m.reactions.removeAll();
            m.react('🚫');
        }
    });

}

const removeReaction = async (m, interaction, emoji) => {
    try { m.reactions.cache.find(r => r.emoji.name == emoji).users.remove(interaction.user); } catch(err) {};
}

function searchEmbed(){
    const embed = new EmbedBuilder()
        .setColor('#7373B9')
        .setTitle('搜尋結果')
        .setDescription('這就是你們製造出來的罪孽')
        .setAuthor({name:'愛麗絲', iconURL:'https://i.imgur.com/8hLIxzh.jpg'})
        .setTimestamp()

    return embed;
}


module.exports = {
    reactionEmbed: reactionEmbed,
}