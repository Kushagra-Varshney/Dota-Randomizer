import type { Position } from './types';

export const POSITION_INFO: Record<Position, { short: string; label: string; lane: string }> = {
  1: { short: 'Carry', label: 'Safe Lane Carry', lane: 'Safe lane' },
  2: { short: 'Mid', label: 'Midlaner', lane: 'Mid lane' },
  3: { short: 'Offlane', label: 'Offlaner', lane: 'Off lane' },
  4: { short: 'Soft Support', label: 'Roaming Support', lane: 'Off lane' },
  5: { short: 'Hard Support', label: 'Hard Support', lane: 'Safe lane' },
};

export const isPosition = (value: unknown): value is Position =>
  value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
