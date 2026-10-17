// Registers the slash commands with Discord: `npm run discord:register` (reads apps/api/.dev.vars).
// With DISCORD_DEV_GUILD_ID set, registers to that one server, where changes show up instantly.
// `-- --clear` removes the commands from that target instead.
import { COMMANDS } from './commands.mjs';

const { DISCORD_APPLICATION_ID: appId, DISCORD_BOT_TOKEN: token, DISCORD_DEV_GUILD_ID: guildId } = process.env;
if (!appId || !token) {
  console.error('Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN in apps/api/.dev.vars first.');
  process.exit(1);
}

const clear = process.argv.includes('--clear');
const url = `https://discord.com/api/v10/applications/${appId}${guildId ? `/guilds/${guildId}` : ''}/commands`;
const res = await fetch(url, {
  method: 'PUT',
  headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(clear ? [] : COMMANDS),
});
if (!res.ok) {
  console.error(`Discord answered ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const saved = await res.json();
const target = guildId ? `server ${guildId}` : 'global';
console.log(clear ? `Cleared ${target} commands.` : `Registered ${saved.map((c) => `/${c.name}`).join(', ')} (${target}).`);
