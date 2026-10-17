// Slash command definitions for the Discord bot. Plain JS with no imports, so plain `node` can
// run register-commands.mjs. A test checks these choices still match the app (modes, limits).

/** Option types: 3 string, 4 integer. */
const STRING = 3;
const INTEGER = 4;

/** Servers only (context 0), installed to a server (integration type 0). */
const base = { type: 1, contexts: [0], integration_types: [0] };

export const MODE_CHOICES = [
  { name: 'Standard', value: 'standard' },
  { name: 'All Random', value: 'random' },
  { name: 'Wombo Combo', value: 'wombo' },
  { name: 'Off-Role', value: 'chaos' },
  { name: 'Themed', value: 'theme' },
];

export const LAYOUT_CHOICES = [
  { name: 'Compact list', value: 'compact' },
  { name: 'Hero cards', value: 'cards' },
];

export const COMMANDS = [
  {
    ...base,
    name: 'setup',
    description: 'Make this the draft channel and post the control panel',
    // Manage Server. The bot checks it again, since admins can override command permissions.
    default_member_permissions: '32',
    options: [
      { type: STRING, name: 'layout', description: 'How draft messages look', required: false, choices: LAYOUT_CHOICES },
    ],
  },
  {
    ...base,
    name: 'draft',
    description: 'Roll a new draft for the stack',
    options: [
      {
        type: STRING,
        name: 'mode',
        description: 'Draft mode (also becomes the server mode)',
        required: false,
        choices: MODE_CHOICES,
      },
    ],
  },
  {
    ...base,
    name: 'rules',
    description: 'Change the draft rules for this server',
    options: [
      {
        type: STRING,
        name: 'roles',
        description: 'Random positions, or lean on each player\'s preferred roles',
        required: false,
        choices: [
          { name: 'Random', value: 'random' },
          { name: 'Preferred', value: 'preferred' },
        ],
      },
      { type: INTEGER, name: 'choices', description: 'Heroes offered per player', required: false, min_value: 1, max_value: 3 },
      {
        type: INTEGER,
        name: 'avoid_recent',
        description: 'Steer away from heroes in the last N saved drafts (0 = off)',
        required: false,
        min_value: 0,
        max_value: 10,
      },
      {
        type: STRING,
        name: 'positions',
        description: 'Positions in play, e.g. 1235',
        required: false,
        min_length: 1,
        max_length: 9,
      },
    ],
  },
];
