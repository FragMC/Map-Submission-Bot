# FragMC Map Submission Bot

Dedicated Discord bot for FragMC map submissions and reports. Separate from IcedSpear game server (Node.js vs Java, easier to update independently).

## Features

- **Dedicated bot, separate from game server** (different tech, easier to update independently)
- Posts a **"Submit a map / Report a map"** embed in a configurable channel (`EMBED_CHANNEL_ID`)
- **Submit** opens a form (name, description, author, notes, schematic link, allow remixing) and creates a ticket channel `map-open-0001`
- **Report** opens a form (map ID, author, reason, notes) plus "I am not a bot" confirmation, in `mapr-open-0001`
- Ticket channels have **Close** (moves to closed category `map-closed-0001`, can be reopened), **Delete**, and **Transcript** (sends HTML log to transcripts channel) — Delete and Transcript only work after Close
- Categories and channels are all configurable via `.env`, not hardcoded
- Staff commands inside a ticket:
  - `/map-submit` — pulls submitted info and adds map to `fragmc.github.io/icedspear.json` via `GITHUB_TOKEN`
  - `/map-edit` — sets difficulty, verified, verified_no_cp
  - `/map-images` — attaches screenshots to a map listing

## Config via .env

```
DISCORD_TOKEN=
GUILD_ID=
EMBED_CHANNEL_ID=
OPEN_TICKETS_CATEGORY_ID=
CLOSED_TICKETS_CATEGORY_ID=
TRANSCRIPTS_CHANNEL_ID=
GITHUB_TOKEN=
GITHUB_OWNER=FragMC
GITHUB_REPO=fragmc.github.io
GITHUB_BRANCH=main
ICEDSPEAR_JSON_PATH=icedspear.json
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
```

## Docker

```bash
docker-compose up --build -d
```

## Viewer Link

Each ticket includes a **"Open in Web Viewer"** button linking to `https://fragmc.github.io/maps/viewer.html?schematic=<url>` or `?id=<mapId>` so admins can verify without opening Minecraft. See `fragmc.github.io/maps/viewer.html`.

## Commands Deployment

```bash
npm run deploy-commands
# Requires DISCORD_CLIENT_ID and DISCORD_TOKEN in .env
```
