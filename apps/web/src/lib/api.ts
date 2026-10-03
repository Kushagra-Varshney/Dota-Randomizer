import type { Draft, Player } from '@dota-picker/core';
import { readJson, writeJson } from './storage';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const PIN_KEY = 'dp.pin';
export const getPin = (): string => readJson(PIN_KEY, '');
export const setPin = (pin: string): void => writeJson(PIN_KEY, pin);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-squad-pin': getPin(), ...init.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const put = (body: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(body) });

export const api = {
  health: () => request<{ ok: boolean; pinRequired: boolean }>('/health'),
  /** Checks a PIN without saving it, so a typo doesn't get stored. */
  checkPin: (pin: string) => request<{ ok: boolean }>('/pin', { method: 'POST', headers: { 'x-squad-pin': pin } }),
  players: () => request<Player[]>('/players'),
  savePlayer: (p: Player) => request<Player>(`/players/${p.id}`, put(p)),
  deletePlayer: (id: string) => request<void>(`/players/${id}`, { method: 'DELETE' }),
  drafts: () => request<Draft[]>('/drafts?limit=100'),
  saveDraft: (d: Draft) => request<Draft>(`/drafts/${d.id}`, put(d)),
  deleteDraft: (id: string) => request<void>(`/drafts/${id}`, { method: 'DELETE' }),
};
