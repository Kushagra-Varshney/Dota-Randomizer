import { MODES, THEMES, getMode, type DraftMode, type ThemeChoice } from '@dota-picker/core';
import { Dices, Layers, Palette, Shuffle, Sparkles, Swords, type LucideIcon } from 'lucide-react';
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

export function ModePanel() {
  const mode = useSettings((s) => s.mode);
  const theme = useSettings((s) => s.theme);
  const set = useSettings((s) => s.set);
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

      {mode === 'theme' && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex flex-wrap gap-1.5">
            {(['surprise', ...THEMES.map((t) => t.id)] as ThemeChoice[]).map((id) => {
              const t = THEMES.find((x) => x.id === id);
              return (
                <button
                  key={id}
                  onClick={() => set({ theme: id })}
                  aria-pressed={theme === id}
                  title={t?.blurb ?? 'A random theme every draft'}
                  className={cx(
                    'rounded-full border px-2.5 py-1 text-xs font-semibold transition',
                    theme === id ? 'border-accent/70 bg-accent/15 text-ink' : 'border-line text-muted hover:border-line-2 hover:text-ink',
                  )}
                >
                  {t?.name ?? '🎲 Surprise me'}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-faint">{activeTheme?.blurb ?? 'A random theme every draft.'}</p>
        </div>
      )}
    </Panel>
  );
}
