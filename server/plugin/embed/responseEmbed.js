const {EmbedBuilder} = require('discord.js');
const prefixM = require('../../config').prefix;

function help(){
    const embed = new EmbedBuilder()
        .setColor('#46A3FF')
        .setTitle('神聖語指令')
        .setAuthor({name:'愛麗絲', iconURL:'https://i.imgur.com/8hLIxzh.jpg'})
        .setDescription('這是目前我所知道的神聖語')
        .addFields(
            {name:'自我介紹', value: prefixM + 'about'},
            {name:'群組人數', value: prefixM + 'guild'},
            {name:'回覆', value: prefixM + 'reply'},
            {name:'洗地', value: prefixM + 'clear'},
            {name:'給 一個人 身分組', value: prefixM + 'give'},
            {name:'給 一個身分 身分組', value: prefixM + 'role'},
            {name:'討論區水量排序(with CSV)', value: prefixM + 'rank'},
        )
        .setTimestamp()

    return embed;
}

function replyHelp(){
    const embed = new EmbedBuilder()
        .setColor('#FFDC35')
        .setTitle('reply相關指令')
        .setAuthor({name:'愛麗絲', iconURL:'https://i.imgur.com/8hLIxzh.jpg'})
        .setDescription('真受不了.....讓我來教你吧')
        .setThumbnail('https://i.imgur.com/pVYFvSs.jpg')
        .addFields(
            {name:'新增/修改回覆', value: prefixM + 'reply add [觸發關鍵字] [回覆內容]'},
            {name:'刪除回覆', value: prefixM + 'reply delete [觸發關鍵字]'},
            {name:'搜尋回覆', value: prefixM +'reply search [觸發關鍵字]'},
            {name:'隨機回覆內容', value: '將多個[回覆內容]用 ^ 來分開'},
            {name:'Tag 觸發訊息者', value: '在[回覆內容]裡加入 {m}'},
        )
        .setTimestamp()
        .setFooter({text:'愛麗絲的神聖語補習教室', iconURL:'https://i.imgur.com/8hLIxzh.jpg'});
    
    return embed;
}


function replyAdd(input,output,user){
    const embed = new EmbedBuilder()
        .setColor('#02DF82')
        .setTitle('回覆已新增')
        .setAuthor({name:'愛麗絲', iconURL:'https://i.imgur.com/8hLIxzh.jpg'})
        .setDescription('明明是騎士卻要講這些意義不明的話')
        .addFields(
            {name:'觸發關鍵字', value: input},
            {name:'回覆內容', value: output ,inline: true}
        )
        .setTimestamp()
        .setFooter({text:user.tag, iconURL:user.avatarURL()});
    
    return embed;
}

function replyUpdate(input,output,user){
    const embed = new EmbedBuilder()
        .setColor('#7D7DFF')
        .setTitle('回覆已修改')
        .setAuthor({name:'愛麗絲', iconURL:'https://i.imgur.com/8hLIxzh.jpg'})
        .setDescription('你們到底又想要我說些什麼......?')
        .addFields(
            {name:'觸發關鍵字', value: input},
            {name:'回覆內容', value: output ,inline: true}
        )
        .setTimestamp()
        .setFooter({text:user.tag, iconURL:user.avatarURL()});

    return embed;
}

function replyDelete(input,user){
    const embed = new EmbedBuilder()
        .setColor('#FF2D2D')
        .setTitle('回覆已刪除')
        .setAuthor({name:'愛麗絲', iconURL:'https://i.imgur.com/8hLIxzh.jpg'})
        .setDescription('奇怪的話又少了一句')
        .addFields(
            {name:'觸發關鍵字', value: input},
        )
        .setTimestamp()
        .setFooter({text:user.tag, iconURL:user.avatarURL()});

    return embed;
}

function aboutEmbed(ping){
    const embed = new EmbedBuilder()
        .setColor('#FFDC35')
        .setTitle('Alice·Synthesis·Thirty')
        .setAuthor({name:'愛麗絲', iconURL:'https://i.imgur.com/8hLIxzh.jpg'})
        .setDescription('聖托利亞市域統括，公理教會整合騎士\n愛麗絲·Synthesis·Thirty\n是來自UnderWorld的人工AI\n目前被綁架到這邊當你們的神聖語小老師。')
        .addField('ping', ping +' ms')

    return embed;
}

async function guildEmbed(msg){
    const guild = msg.guild;
    const owner = await guild.fetchOwner();
    const roles = await guild.roles.fetch();
    const members = await guild.members.fetch();
    const embed = new EmbedBuilder()
        .setColor('#FF79BC')
        .setTitle(guild.name)
        .setThumbnail(guild.iconURL())
        .setAuthor({name:owner.user.tag, iconURL:owner.user.avatarURL()})
        .addFields(
            {name:'人數', value: guild.memberCount.toString()},
            {name:'線上', value: members.filter(m => m.presence?.status === 'online').size.toString(), inline: true},
            {name:'閒置', value: members.filter(m => m.presence?.status === 'idle').size.toString(), inline: true},
            {name:'請勿打擾', value: members.filter(m => m.presence?.status === 'dnd').size.toString(), inline: true},
            {name:'會員', value: roles.get('785467770698465282').members.size.toString()},
            {name:'VTUBER', value: roles.get('785901109071839244').members.size.toString() ,inline: true},
            {name:'Vtuber準備中', value: roles.get('811930854401638411').members.size.toString() ,inline: true},
            {name:'Vtuber幕後', value: roles.get('811516908867551282').members.size.toString() ,inline: true},
        )

    return embed;
}


module.exports = {
    help: help,
    replyHelp: replyHelp,
    replyAdd: replyAdd,
    replyUpdate: replyUpdate,
    replyDelete: replyDelete,
    aboutEmbed: aboutEmbed,
    guildEmbed: guildEmbed
}