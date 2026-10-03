import type { Attr, Position } from '@dota-picker/core';
import { Crosshair, HeartHandshake, Shield, Sword, Zap, type LucideIcon } from 'lucide-react';

export const POSITION_STYLE: Record<Position, { color: string; icon: LucideIcon }> = {
  1: { color: 'var(--color-pos1)', icon: Sword },
  2: { color: 'var(--color-pos2)', icon: Crosshair },
  3: { color: 'var(--color-pos3)', icon: Shield },
  4: { color: 'var(--color-pos4)', icon: Zap },
  5: { color: 'var(--color-pos5)', icon: HeartHandshake },
};

export const ATTR_COLOR: Record<Attr, string> = {
  str: 'var(--color-str)',
  agi: 'var(--color-agi)',
  int: 'var(--color-int)',
  all: 'var(--color-all)',
};

/** The classic in-game player slot colours. */
export const PLAYER_COLORS = [
  '#3375ff',
  '#66ffbf',
  '#bf00bf',
  '#f3f00b',
  '#ff6b00',
  '#fe86c2',
  '#a1b447',
  '#65d9f7',
  '#00a33a',
  '#a46900',
];

export const GUEST_COLOR = '#8b96a8';

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Copies text, falling back to execCommand where the Clipboard API is unavailable (plain http on LAN). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

const loaded = new Map<string, HTMLImageElement>();

/** Warms the browser cache so reveals never show a half-loaded image. */
export function preload(urls: string[]): void {
  for (const url of urls) {
    if (loaded.has(url)) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    loaded.set(url, img);
  }
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
