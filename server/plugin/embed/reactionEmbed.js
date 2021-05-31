'use strict';
const Discord = require('discord.js');

async function reactionEmbed(msg, result){

    const options = {
        limit: 30 * 1000,
        min: 0,
        max: Math.floor((result.length-1)/10),
        page: 0
    }
    const pages = [];

    var embed = searchEmbed();

    for(var i=0; i<result.length; i++){
        if(i%10 == 0 && i != 0){
            embed.setFooter('page'+ (Math.floor(i/10)) + "/" + (options.max+1))
            pages.push(embed);
            embed = searchEmbed();
        }

        embed.addField(result[i]['input'] , result[i]['output']);

        if(i+1 == result.length){
            embed.setFooter('page'+ (Math.floor(i/10)+1) + "/" + (options.max+1))
            pages.push(embed);
        }
    }

    const m = await msg.channel.send({ embed: pages[options.page] });

    await m.react('⬅');
    await m.react('➡');
    await m.react('🗑');
    
    const filter = (reaction, user) => {
        return ['⬅', '➡', '🗑'].includes(reaction.emoji.name) && user.id == msg.author.id;
    };

    awaitReactions(msg, m, options, filter, pages);
}

const awaitReactions = async (msg, m, options, filter, pages) => {
   
    m.awaitReactions(filter, { max: 1, time: options.limit, errors: ['time']})
    .then(async (collected) => {
        const reaction = collected.first();
        if (reaction.emoji.name === '⬅') {
            await removeReaction(m, msg, '⬅');
            
            if (options.page != options.min) {
                --options.page;
                await m.edit(pages[options.page]);
            }

            awaitReactions(msg, m, options, filter, pages);
        }
        else if (reaction.emoji.name === '➡') {
            await removeReaction(m, msg, '➡');
            
            if (options.page != options.max) {
                ++options.page;
                await m.edit(pages[options.page]);
            }

            awaitReactions(msg, m, options, filter, pages);
        }
        else if (reaction.emoji.name === '🗑') {
            return await m.delete();
        }
        else {
            awaitReactions(msg, m, options, filter, pages);
        };
    }).catch(() => {
        m.reactions.removeAll();
        m.react('🚫');
    });
}

const removeReaction = async (m, msg, emoji) => {
    try { m.reactions.cache.find(r => r.emoji.name == emoji).users.remove(msg.author); } catch(err) {};
}

function searchEmbed(){
    const embed = new Discord.MessageEmbed()
        .setColor('#7373B9')
        .setTitle('搜尋結果')
        .setDescription('這就是你們製造出來的罪孽')
        .setAuthor('愛麗絲','https://i.imgur.com/8hLIxzh.jpg')
        .setTimestamp()

    return embed;
}


module.exports = {
    reactionEmbed: reactionEmbed,
}