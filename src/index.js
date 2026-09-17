import { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits, Events } from 'discord.js';
import { config } from './config.js';
import { getNextTicketNumber, saveTicket, getTicket, deleteTicket, updateTicketChannelId } from './utils/tickets.js';
import { addMapToIcedSpear, editMapInIcedSpear, addImagesToMap, removeImagesFromMap } from './utils/github.js';
import { createTranscript } from 'discord-html-transcripts';
import fs from 'fs';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

// Helper to build the main embed
function buildMainEmbed() {
  const embed = new EmbedBuilder()
    .setTitle('Submit a map')
    .setDescription('Use the buttons below to submit a map or report a map. If you submit a map, you agree that you have read all of the rules and systems on the "How to create a map" section on the website.')
    .setColor(0x5865F2)
    .setFooter({ text: 'FragMC Map Submission' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('submit_map').setLabel('Submit a map').setStyle(ButtonStyle.Primary).setEmoji('📤'),
    new ButtonBuilder().setCustomId('report_map').setLabel('Report a map').setStyle(ButtonStyle.Danger).setEmoji('🚩')
  );
  return { embeds: [embed], components: [row] };
}

async function ensureEmbed() {
  try {
    const channel = await client.channels.fetch(config.embedChannelId);
    if (!channel || !channel.isTextBased()) {
      console.warn('[Embed] EMBED_CHANNEL_ID not found or not text');
      return;
    }
    const messages = await channel.messages.fetch({ limit: 10 });
    const hasEmbed = messages.some(m => m.author.id === client.user.id && m.embeds.some(e => e.title === 'Submit a map'));
    if (!hasEmbed) {
      await channel.send(buildMainEmbed());
      console.log('[Embed] Posted Submit/Report embed to', config.embedChannelId);
    } else {
      console.log('[Embed] Already exists in', config.embedChannelId);
    }
  } catch (e) {
    console.error('[Embed] Failed:', e.message);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`[Ready] Logged in as ${client.user.tag}`);
  await ensureEmbed();
  // Ensure data dir exists
  fs.mkdirSync('./data', { recursive: true });
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Buttons: submit/report/close/delete/transcript/reopen
    if (interaction.isButton()) {
      const { customId } = interaction;

      if (customId === 'submit_map') {
        const modal = new ModalBuilder().setCustomId('modal_submit_map').setTitle('Submit a map');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('map_name').setLabel('Map name').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('map_description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('map_author').setLabel('Author (as you want it shown)').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('map_notes').setLabel('Any notes for reviewers').setStyle(TextInputStyle.Paragraph).setRequired(false)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('schematic_link').setLabel('Schematic link (dl.dropboxusercontent.com)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('https://www.dropboxusercontent.com/s/.../map.schem?dl=0'))
        );
        // Note: allow_remixing as separate select - for now add as extra text input in modal (discord modal max 5, so we use yes/no text)
        // We'll add it as a follow-up select after modal, or as part of schematic link modal we can ask in next step
        // For simplicity, add allow_remixing as a 5th field and make notes optional - we already have 5 fields, need to handle remixing via second modal or button
        // Instead, we will ask allow_remixing via a select after modal submit - store partial and ask
        return await interaction.showModal(modal);
      }

      if (customId === 'report_map') {
        const modal = new ModalBuilder().setCustomId('modal_report_map').setTitle('Report a map');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('map_id').setLabel('Map ID').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('report_author').setLabel('Map author').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('report_reason').setLabel('Reason for reporting').setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('report_notes').setLabel('Any notes').setStyle(TextInputStyle.Paragraph).setRequired(false)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('report_confirm').setLabel('Type: I am not a bot...').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('I am not a bot and if this is a false report I agree to the consequences'))
        );
        return await interaction.showModal(modal);
      }

      if (customId === 'close_ticket' || customId === 'reopen_ticket') {
        const isClose = customId === 'close_ticket';
        const ticket = getTicket(interaction.channelId);
        if (!ticket) {
          return await interaction.reply({ content: 'Ticket data not found', ephemeral: true });
        }
        const closedCategory = isClose ? config.closedTicketsCategoryId : config.openTicketsCategoryId;
        const newPrefix = ticket.type === 'map' ? (isClose ? 'map-closed-' : 'map-open-') : (isClose ? 'mapr-closed-' : 'mapr-open-');
        const newName = newPrefix + ticket.number;
        try {
          await interaction.channel.setParent(closedCategory);
          await interaction.channel.setName(newName);
          // Update permissions/buttons
          const row = buildTicketButtons(ticket.type, isClose ? 'closed' : 'open');
          const msg = await interaction.channel.messages.fetch(ticket.messageId).catch(() => null);
          if (msg) await msg.edit({ components: [row] });
          updateTicketChannelId(interaction.channelId, interaction.channelId); // keep same id, but update ticket status
          ticket.status = isClose ? 'closed' : 'open';
          saveTicket(interaction.channelId, ticket);
          await interaction.reply({ content: isClose ? `Ticket closed and moved to ${newName}` : `Ticket reopened as ${newName}` });
        } catch (e) {
          console.error(e);
          await interaction.reply({ content: 'Failed to move ticket: ' + e.message, ephemeral: true });
        }
        return;
      }

      if (customId === 'delete_ticket') {
        const ticket = getTicket(interaction.channelId);
        if (!ticket || ticket.status !== 'closed') {
          return await interaction.reply({ content: 'Delete only works once closed', ephemeral: true });
        }
        await interaction.reply({ content: 'Deleting ticket...' });
        deleteTicket(interaction.channelId);
        setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
        return;
      }

      if (customId === 'transcript_ticket') {
        const ticket = getTicket(interaction.channelId);
        if (!ticket || ticket.status !== 'closed') {
          return await interaction.reply({ content: 'Transcript only works once closed', ephemeral: true });
        }
        await interaction.deferReply();
        try {
          const transcript = await createTranscript(interaction.channel, {
            limit: -1,
            returnType: 'attachment',
            filename: `${interaction.channel.name}.html`,
            saveImages: true,
            poweredBy: false,
          });
          const transcriptsChannel = await client.channels.fetch(config.transcriptsChannelId);
          if (transcriptsChannel && transcriptsChannel.isTextBased()) {
            await transcriptsChannel.send({ content: `Transcript for ${interaction.channel.name}`, files: [transcript] });
            await interaction.editReply({ content: `Transcript sent to <#${config.transcriptsChannelId}>` });
          } else {
            await interaction.editReply({ content: 'Transcripts channel not found' });
          }
        } catch (e) {
          console.error(e);
          await interaction.editReply({ content: 'Failed to create transcript: ' + e.message });
        }
        return;
      }

      // Allow remixing select after submit modal
      if (customId.startsWith('allow_remixing_')) {
        const allow = customId === 'allow_remixing_yes';
        const pending = getTicket(`pending_${interaction.user.id}`);
        if (!pending) return await interaction.reply({ content: 'No pending submission', ephemeral: true });
        pending.allow_remixing = allow;
        // Now create ticket channel
        await createTicketChannel(interaction, pending, 'map');
        deleteTicket(`pending_${interaction.user.id}`);
        return;
      }
    }

    // Modal submits
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_submit_map') {
        const mapName = interaction.fields.getTextInputValue('map_name');
        const description = interaction.fields.getTextInputValue('map_description');
        const author = interaction.fields.getTextInputValue('map_author');
        const notes = interaction.fields.getTextInputValue('map_notes') || 'None';
        const schematicLink = interaction.fields.getTextInputValue('schematic_link');

        // Store pending and ask allow_remixing
        const pendingData = {
          name: mapName,
          description,
          author,
          notes,
          schematic_link: schematicLink,
          submitted_by: interaction.user.id,
          type: 'map',
        };
        saveTicket(`pending_${interaction.user.id}`, pendingData);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('allow_remixing_yes').setLabel('Allow remixing: Yes').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('allow_remixing_no').setLabel('Allow remixing: No').setStyle(ButtonStyle.Secondary)
        );
        return await interaction.reply({ content: `Thanks ${author}! Your map **${mapName}** is ready. Do you want to allow others to remix this map?`, components: [row], ephemeral: true });
      }

      if (interaction.customId === 'modal_report_map') {
        const mapId = interaction.fields.getTextInputValue('map_id');
        const author = interaction.fields.getTextInputValue('report_author');
        const reason = interaction.fields.getTextInputValue('report_reason');
        const notes = interaction.fields.getTextInputValue('report_notes') || 'None';
        const confirm = interaction.fields.getTextInputValue('report_confirm');

        const expected = 'I am not a bot and if this is a false report I agree to the consequences';
        if (confirm.trim() !== expected) {
          return await interaction.reply({ content: `Confirmation must be exactly: "${expected}"`, ephemeral: true });
        }

        const reportData = {
          map_id: mapId,
          author,
          reason,
          notes,
          confirmation: confirm,
          submitted_by: interaction.user.id,
          type: 'report',
        };
        await createTicketChannel(interaction, reportData, 'report');
        return;
      }
    }

    // Slash commands
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === 'map-submit') {
        // Must be in a ticket channel
        const ticket = getTicket(interaction.channelId);
        if (!ticket || ticket.type !== 'map') {
          return await interaction.reply({ content: 'This command only works in a map submission ticket (map-open-*)', ephemeral: true });
        }
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return await interaction.reply({ content: 'You need Manage Channels permission', ephemeral: true });
        }
        await interaction.deferReply();
        try {
          const schematicUrl = ticket.schematic_link;
          const allowRemixing = ticket.allow_remixing || false;
          const mapData = {
            id: ticket.number ? `map-${ticket.number}` : `map-${Date.now()}`,
            name: ticket.name,
            description: ticket.description,
            author: ticket.author,
            schematic_url: schematicUrl,
            allow_remixing: allowRemixing,
            submitted_by: ticket.submitted_by,
            ticket_id: interaction.channelId,
          };
          const newId = await addMapToIcedSpear(mapData, `Submit map ${mapData.name} via ticket ${interaction.channel.name}`);
          // Close ticket
          const closedCategory = config.closedTicketsCategoryId;
          await interaction.channel.setParent(closedCategory);
          await interaction.channel.setName(`map-closed-${ticket.number}`);
          ticket.status = 'closed';
          saveTicket(interaction.channelId, ticket);
          const viewerLink = `https://fragmc.github.io/maps/viewer.html?id=${newId}`;
          await interaction.editReply({ content: `✅ Map **${mapData.name}** submitted as \`${newId}\` and added to \`icedspear.json\`!\nSchematic: ${schematicUrl}\nAllow remixing: ${allowRemixing}\nViewer: ${viewerLink}\nTicket closed.` });
        } catch (e) {
          console.error(e);
          await interaction.editReply({ content: 'Failed to submit map: ' + e.message });
        }
        return;
      }

      if (commandName === 'map-edit') {
        const id = interaction.options.getString('id');
        const difficulty = interaction.options.getString('difficulty');
        const verified = interaction.options.getBoolean('verified');
        const verifiedNoCp = interaction.options.getBoolean('verified_no_cp');
        if (difficulty === null && verified === null && verifiedNoCp === null) {
          return await interaction.reply({ content: 'At least one of difficulty, verified, or verified_no_cp is required', ephemeral: true });
        }
        await interaction.deferReply();
        try {
          const updated = await editMapInIcedSpear(id, { difficulty: difficulty || undefined, verified: verified ?? undefined, verified_no_cp: verifiedNoCp ?? undefined });
          await interaction.editReply({ content: `✅ Updated map \`${id}\`: difficulty=${updated.difficulty} verified=${updated.verified} verified_no_cp=${updated.verified_no_cp}` });
        } catch (e) {
          await interaction.editReply({ content: 'Failed: ' + e.message });
        }
        return;
      }

      if (commandName === 'map-images') {
        const action = interaction.options.getString('action');
        const id = interaction.options.getString('id');
        const imageUrl = interaction.options.getString('image_url');
        const imageAttachment = interaction.options.getAttachment('image');
        await interaction.deferReply();
        try {
          let urls = [];
          if (imageAttachment) urls.push(imageAttachment.url);
          if (imageUrl) urls.push(...imageUrl.split(',').map(s => s.trim()).filter(Boolean));
          if (urls.length === 0) return await interaction.editReply({ content: 'Provide at least one image via attachment or URL' });
          if (action === 'add') {
            await addImagesToMap(id, urls);
            await interaction.editReply({ content: `✅ Added ${urls.length} image(s) to \`${id}\`` });
          } else {
            // For delete, need to select - we'll just remove the provided URLs
            await removeImagesFromMap(id, urls);
            await interaction.editReply({ content: `✅ Removed ${urls.length} image(s) from \`${id}\`` });
          }
        } catch (e) {
          await interaction.editReply({ content: 'Failed: ' + e.message });
        }
        return;
      }
    }
  } catch (e) {
    console.error('[Interaction] Error:', e);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'An error occurred', ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: 'An error occurred', ephemeral: true }).catch(() => {});
    }
  }
});

function buildTicketButtons(type, status) {
  const isOpen = status === 'open';
  const closeBtn = new ButtonBuilder().setCustomId(isOpen ? 'close_ticket' : 'reopen_ticket').setLabel(isOpen ? 'Close' : 'Reopen').setStyle(isOpen ? ButtonStyle.Success : ButtonStyle.Primary).setEmoji(isOpen ? '🔒' : '🔓');
  const deleteBtn = new ButtonBuilder().setCustomId('delete_ticket').setLabel('Delete').setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(isOpen);
  const transcriptBtn = new ButtonBuilder().setCustomId('transcript_ticket').setLabel('Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📄').setDisabled(isOpen);
  return new ActionRowBuilder().addComponents(closeBtn, deleteBtn, transcriptBtn);
}

async function createTicketChannel(interaction, data, type) {
  const isMap = type === 'map';
  const number = getNextTicketNumber(isMap ? 'map' : 'report');
  const channelName = isMap ? `map-open-${number}` : `mapr-open-${number}`;
  const guild = interaction.guild;
  const parentId = config.openTicketsCategoryId;

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: parentId,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
      // Allow admins/mods - you should set this to your reviewer role ID
      // For now, allow ManageChannels
    ],
  });

  // Build embed with all info reviewers need
  const embed = new EmbedBuilder()
    .setTitle(isMap ? `Map Submission - ${data.name}` : `Map Report - ${data.map_id}`)
    .setColor(isMap ? 0x00FF00 : 0xFF0000)
    .setTimestamp()
    .setFooter({ text: `Ticket ${channelName} | Submitted by ${interaction.user.tag}` });

  if (isMap) {
    embed.addFields(
      { name: 'Map Name', value: data.name, inline: true },
      { name: 'Author', value: data.author, inline: true },
      { name: 'Allow Remixing', value: data.allow_remixing ? 'Yes' : 'No', inline: true },
      { name: 'Description', value: data.description || 'None' },
      { name: 'Notes', value: data.notes || 'None' },
      { name: 'Schematic Link', value: data.schematic_link },
      { name: 'Submitted By', value: `<@${data.submitted_by}>` },
      { name: 'Viewer', value: `[Open in Web Viewer](https://fragmc.github.io/maps/viewer.html?schematic=${encodeURIComponent(data.schematic_link)})` }
    );
  } else {
    embed.addFields(
      { name: 'Map ID', value: data.map_id, inline: true },
      { name: 'Map Author', value: data.author, inline: true },
      { name: 'Reason', value: data.reason },
      { name: 'Notes', value: data.notes || 'None' },
      { name: 'Confirmation', value: data.confirmation },
      { name: 'Reported By', value: `<@${data.submitted_by}>` },
      { name: 'Viewer', value: `[View Map](https://fragmc.github.io/maps/viewer.html?id=${encodeURIComponent(data.map_id)})` }
    );
  }

  const row = buildTicketButtons(isMap ? 'map' : 'report', 'open');
  const viewerRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Open in Web Viewer').setStyle(ButtonStyle.Link).setURL(isMap ? `https://fragmc.github.io/maps/viewer.html?schematic=${encodeURIComponent(data.schematic_link)}` : `https://fragmc.github.io/maps/viewer.html?id=${encodeURIComponent(data.map_id)}`)
  );

  const msg = await channel.send({ content: isMap ? `New map submission from <@${interaction.user.id}>` : `New report from <@${interaction.user.id}>`, embeds: [embed], components: [row, viewerRow] });

  // Save ticket
  const ticketData = isMap ? {
    number,
    type: 'map',
    name: data.name,
    description: data.description,
    author: data.author,
    notes: data.notes,
    schematic_link: data.schematic_link,
    allow_remixing: data.allow_remixing,
    submitted_by: data.submitted_by,
    status: 'open',
    messageId: msg.id,
    channelId: channel.id,
  } : {
    number,
    type: 'report',
    map_id: data.map_id,
    author: data.author,
    reason: data.reason,
    notes: data.notes,
    confirmation: data.confirmation,
    submitted_by: data.submitted_by,
    status: 'open',
    messageId: msg.id,
    channelId: channel.id,
  };
  saveTicket(channel.id, ticketData);

  if (interaction.replied) {
    await interaction.followUp({ content: `Ticket created: <#${channel.id}>`, ephemeral: true });
  } else {
    await interaction.reply({ content: `Ticket created: <#${channel.id}>`, ephemeral: true });
  }
}

client.login(config.discordToken);
