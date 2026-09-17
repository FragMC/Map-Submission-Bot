import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from './config.js';

const commands = [
  new SlashCommandBuilder()
    .setName('map-submit')
    .setDescription('Submit the map from this ticket to the website (admin only)')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('map-edit')
    .setDescription('Edit map difficulty/verified status')
    .addStringOption(o => o.setName('id').setDescription('Map ID').setRequired(true))
    .addStringOption(o => o.setName('difficulty').setDescription('Difficulty (e.g. Easy, Medium, Hard)').setRequired(false))
    .addBooleanOption(o => o.setName('verified').setDescription('Verified').setRequired(false))
    .addBooleanOption(o => o.setName('verified_no_cp').setDescription('Verified No Checkpoints').setRequired(false))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('map-images')
    .setDescription('Add or delete images for a map')
    .addStringOption(o => o.setName('action').setDescription('add or delete').setRequired(true).addChoices({ name: 'add', value: 'add' }, { name: 'delete', value: 'delete' }))
    .addStringOption(o => o.setName('id').setDescription('Map ID').setRequired(true))
    .addStringOption(o => o.setName('image_url').setDescription('Image URL (for add via URL)').setRequired(false))
    .addAttachmentOption(o => o.setName('image').setDescription('Image file (for add via upload)').setRequired(false))
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(config.discordToken);
const clientId = process.env.DISCORD_CLIENT_ID;

if (!clientId) {
  console.error('Set DISCORD_CLIENT_ID in .env to register commands');
  process.exit(1);
}

try {
  console.log(`Registering ${commands.length} slash commands to guild ${config.guildId}...`);
  await rest.put(Routes.applicationGuildCommands(clientId, config.guildId), { body: commands });
  console.log(`Successfully registered ${commands.length} commands`);
} catch (e) {
  console.error('Failed to register commands:', e);
  process.exit(1);
}
