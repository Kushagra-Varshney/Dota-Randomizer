import { getHero, heroImages, POSITION_INFO, POSITIONS } from '@dota-picker/core';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useSettings } from '../lib/settings';
import { cx, POSITION_STYLE } from '../lib/ui';
import { HeroPicker } from './HeroPicker';
import { Panel, PositionIcon, Segmented, Switch } from './primitives';

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs leading-snug text-faint">{hint}</div>}
      </div>
      <div className="w-[56%] shrink-0">{children}</div>
    </div>
  );
}

export function RulesPanel() {
  const s = useSettings();
  const [bansOpen, setBansOpen] = useState(false);

  const summary = [
    s.roles === 'preferred' ? 'Preferred roles' : 'Random roles',
    s.choices === 1 ? '1 hero each' : `Pick from ${s.choices}`,
    s.positions.length === 5 ? 'All positions' : `Pos ${[...s.positions].sort().join(', ')}`,
    s.bans.length ? `${s.bans.length} banned` : null,
    s.avoidRecent ? 'No repeats' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const togglePosition = (p: (typeof POSITIONS)[number]) => {
    const next = s.positions.includes(p) ? s.positions.filter((x) => x !== p) : [...s.positions, p];
    if (next.length) s.set({ positions: next });
  };

  return (
    <Panel
      title="Rules"
      icon={<SlidersHorizontal size={16} />}
      right={
        <button
          onClick={() => s.set({ rulesOpen: !s.rulesOpen })}
          aria-expanded={s.rulesOpen}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-muted hover:text-ink"
        >
          {s.rulesOpen ? 'Hide' : 'Edit'}
          <ChevronDown size={14} className={cx('transition-transform', s.rulesOpen && 'rotate-180')} />
        </button>
      }
    >
      {!s.rulesOpen ? (
        <button onClick={() => s.set({ rulesOpen: true })} className="text-left text-sm text-muted hover:text-ink">
          {summary}
        </button>
      ) : (
        <div className="space-y-3.5">
          <Row label="Roles" hint="Preferred uses each player's squad roles">
            <Segmented
              label="Role assignment"
              value={s.roles}
              onChange={(roles) => s.set({ roles })}
              options={[
                { value: 'random', label: 'Random' },
                { value: 'preferred', label: 'Preferred' },
              ]}
            />
          </Row>

          <Row label="Heroes each" hint="2–3 lets everyone pick one">
            <Segmented
              label="Hero choices per player"
              value={s.choices}
              onChange={(choices) => s.set({ choices })}
              options={[1, 2, 3].map((n) => ({ value: n, label: n }))}
            />
          </Row>

          <Row label="Positions" hint="Which roles can be handed out">
            <div className="flex gap-1">
              {POSITIONS.map((p) => {
                const on = s.positions.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePosition(p)}
                    aria-pressed={on}
                    title={`Pos ${p} · ${POSITION_INFO[p].short}`}
                    className={cx(
                      'flex h-8 flex-1 items-center justify-center rounded-md border transition',
                      on ? 'border-line-2 bg-panel-2' : 'border-line opacity-35 grayscale hover:opacity-70',
                    )}
                    style={on ? { boxShadow: `inset 0 -2px 0 ${POSITION_STYLE[p].color}` } : undefined}
                  >
                    <PositionIcon position={p} size={15} />
                  </button>
                );
              })}
            </div>
          </Row>

          <Row label="Avoid repeats" hint="Skip heroes from recent saved drafts">
            <Segmented
              label="Avoid recently played heroes"
              value={s.avoidRecent}
              onChange={(avoidRecent) => s.set({ avoidRecent })}
              options={[
                { value: 0, label: 'Off' },
                { value: 3, label: 'Last 3', title: 'Last 3 saved drafts' },
                { value: 10, label: 'Last 10', title: 'Last 10 saved drafts' },
              ]}
            />
          </Row>

          <Row label="Banned heroes" hint="Nobody gets these">
            <button
              onClick={() => setBansOpen(true)}
              className="flex h-8 w-full items-center gap-1.5 rounded-lg border border-line bg-bg/60 px-2 text-xs font-semibold text-muted transition hover:border-line-2 hover:text-ink"
            >
              {s.bans.length === 0 ? (
                <span className="px-0.5">None. Add bans</span>
              ) : (
                <>
                  <span className="flex -space-x-1.5">
                    {s.bans.slice(0, 4).map((id) => {
                      const h = getHero(id);
                      return h && <img key={id} src={heroImages.icon(h)} alt={h.name} className="size-5 rounded-full bg-panel ring-2 ring-bg" />;
                    })}
                  </span>
                  <span>{s.bans.length} banned</span>
                </>
              )}
            </button>
          </Row>

          <Row label="Reveal animation">
            <div className="flex justify-end">
              <Switch label="Reveal animation" checked={s.animate} onChange={(animate) => s.set({ animate })} />
            </div>
          </Row>
        </div>
      )}
      <HeroPicker
        open={bansOpen}
        onClose={() => setBansOpen(false)}
        title="Banned heroes"
        selected={s.bans}
        onChange={(bans) => s.set({ bans })}
      />
    </Panel>
  );
}
