module.exports = {
	/**
	 * Array Get Random
	 *
	 * @link https://stackoverflow.com/a/24137301
	 * @param {Object} list Object that has many items in it.
	 * @return {any} Return any Random Element from a List
	 */
	random: (list) => {
		return list[Math.floor((Math.random() * list.length))];
	},

	// Fetch the full member list once; afterwards the GuildMembers intent keeps the cache current.
	ensureMembersCached: async (guild) => {
		if (guild.members.cache.size < guild.memberCount) await guild.members.fetch();
	},
}