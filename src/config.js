import dotenv from 'dotenv';
dotenv.config();

export const config = {
  discordToken: process.env.DISCORD_TOKEN,
  guildId: process.env.GUILD_ID,
  embedChannelId: process.env.EMBED_CHANNEL_ID,
  openTicketsCategoryId: process.env.OPEN_TICKETS_CATEGORY_ID,
  closedTicketsCategoryId: process.env.CLOSED_TICKETS_CATEGORY_ID,
  transcriptsChannelId: process.env.TRANSCRIPTS_CHANNEL_ID,
  githubToken: process.env.GITHUB_TOKEN,
  githubOwner: process.env.GITHUB_OWNER || 'FragMC',
  githubRepo: process.env.GITHUB_REPO || 'fragmc.github.io',
  githubBranch: process.env.GITHUB_BRANCH || 'main',
  icedspearJsonPath: process.env.ICEDSPEAR_JSON_PATH || 'icedspear.json',
  dropboxAppKey: process.env.DROPBOX_APP_KEY,
  dropboxAppSecret: process.env.DROPBOX_APP_SECRET,
};

for (const [key, value] of Object.entries(config)) {
  if (!value && !key.startsWith('dropbox')) {
    console.warn(`[Config] Missing ${key}`);
  }
}
