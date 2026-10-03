import { COMBOS, MODES, THEMES, getMode, type ComboChoice, type DraftMode, type ThemeChoice } from '@dota-picker/core';
import { Dices, Layers, Palette, Shuffle, Sparkles, Swords, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSettings } from '../lib/settings';
import { cx } from '../lib/ui';
import { Panel } from './primitives';

export const MODE_ICON: Record<DraftMode, LucideIcon> = {
  standard: Swords,
  random: Dices,
  wombo: Sparkles,
  chaos: Shuffle,
  theme: Palette,
};

const SHORT: Record<DraftMode, string> = {
  standard: 'Standard',
  random: 'Random',
  wombo: 'Wombo',
  chaos: 'Off-Role',
  theme: 'Themed',
};

const count = (style: ComboChoice) => COMBOS.filter((c) => style === 'all' || c.style === style).length;

const COMBO_STYLES: { value: ComboChoice; label: string; hint: string; count: number }[] = [
  { value: 'all', label: 'Any combo', hint: 'Classics and memes mixed together.', count: count('all') },
  { value: 'classic', label: 'Classics', hint: 'Real teamfight combos that hold up in serious games.', count: count('classic') },
  { value: 'meme', label: '🤡 Memes', hint: 'Pub and Turbo shenanigans. Fun first, winning optional.', count: count('meme') },
];

function Chip({ active, onClick, title, children }: { active: boolean; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cx(
        'rounded-full border px-2.5 py-1 text-xs font-semibold transition',
        active ? 'border-accent/70 bg-accent/15 text-ink' : 'border-line text-muted hover:border-line-2 hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

export function ModePanel() {
  const mode = useSettings((s) => s.mode);
  const theme = useSettings((s) => s.theme);
  const set = useSettings((s) => s.set);
  const comboStyle = useSettings((s) => s.comboStyle);
  const activeTheme = THEMES.find((t) => t.id === theme);

  return (
    <Panel title="Draft mode" icon={<Layers size={16} />}>
      <div role="radiogroup" aria-label="Draft mode" className="grid grid-cols-5 gap-1.5">
        {MODES.map((m) => {
          const Icon = MODE_ICON[m.id];
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              role="radio"
              aria-checked={active}
              title={`${m.name}: ${m.blurb}`}
              onClick={() => set({ mode: m.id })}
              className={cx(
                'flex flex-col items-center gap-1.5 rounded-xl border px-1 pt-2.5 pb-2 transition',
                active
                  ? 'border-accent/70 bg-gradient-to-b from-accent/25 to-accent/5 text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]'
                  : 'border-line bg-bg/40 text-muted hover:border-line-2 hover:text-ink',
              )}
            >
              <Icon size={20} className={active ? 'text-accent-2' : undefined} />
              <span className="font-display text-[13px] font-semibold uppercase leading-none tracking-wide">{SHORT[m.id]}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-sm text-muted">
        <span className="font-semibold text-ink">{getMode(mode).name}.</span> {getMode(mode).blurb}.
      </p>

      {mode === 'wombo' && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex flex-wrap gap-1.5">
            {COMBO_STYLES.map((o) => (
              <Chip key={o.value} active={comboStyle === o.value} onClick={() => set({ comboStyle: o.value })} title={o.hint}>
                {o.label} <span className="text-faint">{o.count}</span>
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">{COMBO_STYLES.find((o) => o.value === comboStyle)?.hint}</p>
        </div>
      )}

      {mode === 'theme' && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex flex-wrap gap-1.5">
            {(['surprise', ...THEMES.map((t) => t.id)] as ThemeChoice[]).map((id) => {
              const t = THEMES.find((x) => x.id === id);
              return (
                <Chip key={id} active={theme === id} onClick={() => set({ theme: id })} title={t?.blurb ?? 'A random theme every draft'}>
                  {t?.name ?? '🎲 Surprise me'}
                </Chip>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-faint">{activeTheme?.blurb ?? 'A random theme every draft.'}</p>
        </div>
      )}
    </Panel>
  );
}
