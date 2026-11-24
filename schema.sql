-- A.L.I.C.E database schema (structure only, exported from production on 2026-11-24).
-- Usage: mysql -u <user> -p <database> < schema.sql

-- Keyword replies. `input` lookups are case-insensitive (utf8mb4_unicode_520_ci).
CREATE TABLE IF NOT EXISTS `reply` (
  `id` int NOT NULL AUTO_INCREMENT,
  `input` varchar(256) COLLATE utf8mb4_unicode_520_ci NOT NULL,
  `output` varchar(1024) COLLATE utf8mb4_unicode_520_ci NOT NULL,
  `guildId` varchar(27) COLLATE utf8mb4_unicode_520_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `input_2` (`input`,`guildId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

-- Channel that receives deleted-message backups, one per guild.
CREATE TABLE IF NOT EXISTS `backup` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guildId` varchar(27) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channelId` varchar(27) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`guildId`),
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Roles whose member counts are shown by /guild.
CREATE TABLE IF NOT EXISTS `guild_role` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guildId` varchar(27) COLLATE utf8mb4_unicode_ci NOT NULL,
  `roleId` varchar(27) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roleId` (`roleId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
