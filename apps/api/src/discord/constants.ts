import type {
  ButtonStyle,
  ComponentType,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
} from 'discord-api-types/v10';

// discord-api-types is a types-only dependency, so the few enum values we use are spelled out here.

export const Interaction = {
  Ping: 1 as InteractionType.Ping,
  ApplicationCommand: 2 as InteractionType.ApplicationCommand,
  MessageComponent: 3 as InteractionType.MessageComponent,
} as const;

export const Callback = {
  Pong: 1 as InteractionResponseType.Pong,
  ChannelMessage: 4 as InteractionResponseType.ChannelMessageWithSource,
  UpdateMessage: 7 as InteractionResponseType.UpdateMessage,
} as const;

export const Component = {
  ActionRow: 1 as ComponentType.ActionRow,
  Button: 2 as ComponentType.Button,
  StringSelect: 3 as ComponentType.StringSelect,
} as const;

export const Style = {
  Primary: 1 as ButtonStyle.Primary,
  Secondary: 2 as ButtonStyle.Secondary,
  Success: 3 as ButtonStyle.Success,
  Link: 5 as ButtonStyle.Link,
} as const;

export const EPHEMERAL = 64 as MessageFlags.Ephemeral;

/** Manage Server, and Administrator (which implies everything). */
export const MANAGE_GUILD = 0x20n;
export const ADMINISTRATOR = 0x8n;
