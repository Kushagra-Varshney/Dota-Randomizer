// Checks every combo against Valve's official Dota 2 datafeed (it includes lettered patches like 7.41f):
//   BROKEN  - an ability the combo relies on is no longer in that hero's current kit.
//   CHANGED - an ability it relies on was changed in a patch released after the combo's verifiedPatch.
// Prints a markdown report. With `--out <file>` it also writes the report there, but only when
// something needs attention (the weekly GitHub workflow turns that file into an issue).
// Exit codes: 0 = all clear, 10 = needs attention, anything else = the check itself failed.
export const NEEDS_ATTENTION = 10;
import { writeFile } from 'node:fs/promises';
import { COMBOS } from '../src/combos.ts';
import { ABILITIES_PATCH } from '../src/data/hero-abilities.generated.ts';
import { BASE_HEROES } from '../src/data/heroes.generated.ts';

const VALVE = 'https://www.dota2.com/datafeed';

async function get(path) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${VALVE}/${path}${path.includes('?') ? '&' : '?'}language=english`);
    if (res.ok) return res.json();
    if (attempt === 3) throw new Error(`Valve datafeed ${path} responded ${res.status}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

const heroId = new Map(BASE_HEROES.map((h) => [h.key, h.id]));
const comboHeroes = [...new Set(COMBOS.flatMap((c) => c.heroes))];

const [{ patches }, abilityList, ...heroData] = await Promise.all([
  get('patchnoteslist'),
  get('abilitylist'),
  ...comboHeroes.map((key) => get(`herodata?hero_id=${heroId.get(key)}`)),
]);

const order = patches.map((p) => p.patch_number); // oldest first
const latest = order.at(-1);
const abilities = new Map(abilityList.result.data.itemabilities.map((a) => [a.id, a]));
const kits = new Map(
  comboHeroes.map((key, i) => [key, new Set(heroData[i].result.data.heroes[0].abilities.map((a) => a.name))]),
);
const displayName = (name) => [...abilities.values()].find((a) => a.name === name)?.name_english_loc || name;

// Patch notes for every patch newer than the oldest verifiedPatch, fetched once each.
const unknownPatch = COMBOS.filter((c) => !order.includes(c.verifiedPatch));
const oldest = Math.min(...COMBOS.filter((c) => order.includes(c.verifiedPatch)).map((c) => order.indexOf(c.verifiedPatch)));
const newer = Number.isFinite(oldest) ? order.slice(oldest + 1) : [];
const notes = new Map(await Promise.all(newer.map(async (v) => [v, await get(`patchnotes?version=${v}`)])));

/** ability name -> [patch, note text][] for one patch. */
function abilityNotes(version) {
  const out = new Map();
  for (const hero of notes.get(version)?.heroes ?? []) {
    for (const ability of hero.abilities ?? []) {
      const name = abilities.get(ability.ability_id)?.name;
      if (!name) continue;
      const text = (ability.ability_notes ?? []).map((n) => n.note).join(' ');
      if (text) out.set(name, [...(out.get(name) ?? []), text]);
    }
  }
  return out;
}
const notesByVersion = new Map(newer.map((v) => [v, abilityNotes(v)]));

const broken = [];
const changed = [];

for (const combo of COMBOS) {
  const missing = combo.abilities.filter((a) => !combo.heroes.some((h) => kits.get(h)?.has(a)));
  if (missing.length) broken.push({ combo, reason: `${missing.map((a) => `\`${a}\``).join(', ')} not in the current kit` });

  const since = order.indexOf(combo.verifiedPatch);
  if (since === -1) continue;
  const lines = [];
  for (const version of order.slice(since + 1)) {
    for (const ability of combo.abilities) {
      for (const text of notesByVersion.get(version)?.get(ability) ?? []) lines.push(`${version} · ${displayName(ability)}: ${text}`);
    }
  }
  if (lines.length) changed.push({ combo, lines });
}
for (const combo of unknownPatch) broken.push({ combo, reason: `verifiedPatch "${combo.verifiedPatch}" is not a known patch` });

const label = (c) => `**${c.name}** (\`${c.id}\`, verified on ${c.verifiedPatch})`;
const report = [`# Combo check against Dota 2 patch ${latest}`, ''];

if (broken.length) {
  report.push('## Broken', '');
  for (const { combo, reason } of broken) report.push(`- ${label(combo)}: ${reason}`);
  report.push('');
}
if (changed.length) {
  report.push('## Changed since last verified', '');
  for (const { combo, lines } of changed) {
    report.push(`- ${label(combo)}`);
    for (const line of lines) report.push(`  - ${line}`);
  }
  report.push('');
}
const staleSnapshot = latest !== ABILITIES_PATCH;
if (staleSnapshot) report.push(`The hero ability snapshot is from ${ABILITIES_PATCH}; run \`npm run heroes:sync\`.`, '');

const needsAttention = broken.length > 0 || changed.length > 0 || staleSnapshot;
if (needsAttention) {
  report.push(
    '## What to do',
    '',
    '1. For each combo above, check it still works in the current patch (Liquipedia hero pages, patch notes, a recent clip).',
    '2. In `packages/core/src/combos.ts`: fix `how`/`abilities` or delete the combo, then set `verifiedPatch` to the current patch.',
    '3. `npm run heroes:sync && npm test`, then deploy.',
  );
} else {
  report.push(`All ${COMBOS.length} combos are up to date for ${latest}.`);
}

const text = report.join('\n');
console.log(text);

const outIndex = process.argv.indexOf('--out');
if (outIndex !== -1 && needsAttention) await writeFile(process.argv[outIndex + 1], `${text}\n`);
process.exitCode = needsAttention ? NEEDS_ATTENTION : 0;
