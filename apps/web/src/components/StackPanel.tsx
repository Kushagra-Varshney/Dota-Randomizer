import { MAX_STACK, POSITION_INFO, POSITIONS, type Player, type Position } from '@dota-picker/core';
import { Pin, Plus, UserPlus, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { guestName } from '../lib/actions';
import { nextColor } from '../lib/players';
import { useSettings } from '../lib/settings';
import { useSquad } from '../lib/squad';
import { cx, GUEST_COLOR, newId } from '../lib/ui';
import { Avatar, MenuItem, Panel, Popover, PositionIcon } from './primitives';

export function StackPanel() {
  const players = useSquad((s) => s.players);
  const sync = useSquad((s) => s.sync);
  const selected = useSettings((s) => s.selected);
  const guests = useSettings((s) => s.guests);
  const togglePlayer = useSettings((s) => s.togglePlayer);
  const setStackSize = useSettings((s) => s.setStackSize);
  const set = useSettings((s) => s.set);

  // Forget selections of players that were removed from the squad.
  useEffect(() => {
    if (sync === 'loading') return;
    const ids = new Set(players.map((p) => p.id));
    if (selected.some((id) => !ids.has(id))) set({ selected: selected.filter((id) => ids.has(id)) });
  }, [players, selected, sync, set]);

  const chosen = selected.filter((id) => players.some((p) => p.id === id));
  const size = chosen.length + guests;
  const full = size >= MAX_STACK;

  return (
    <Panel
      title="Who's playing"
      icon={<Users size={16} />}
      right={
        <span className="font-display text-sm font-semibold uppercase tracking-wider text-muted">
          {size === 0 ? 'Nobody yet' : size === 1 ? 'Solo' : (
            <>
              <span className="text-lg text-ink">{size}</span>-stack
            </>
          )}
        </span>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {players.map((p) => (
          <PlayerChip
            key={p.id}
            player={p}
            selected={chosen.includes(p.id)}
            disabled={full && guests === 0 && !chosen.includes(p.id)}
            onToggle={() => togglePlayer(p.id)}
          />
        ))}
        {Array.from({ length: guests }, (_, i) => (
          <GuestChip key={i} name={guestName(i + 1)} onRemove={() => setStackSize(size - 1)} />
        ))}
        <button
          onClick={() => setStackSize(size + 1)}
          disabled={full}
          className="flex items-center gap-1 rounded-full border border-dashed border-line-2 px-3 py-1 text-sm font-medium text-muted transition hover:border-muted hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus size={14} /> Guest
        </button>
      </div>

      <QuickAdd onAdded={(id) => !full && togglePlayer(id)} empty={players.length === 0} />

      <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
        <span className="text-xs font-medium text-muted">Stack size</span>
        <div className="flex flex-1 gap-1" role="radiogroup" aria-label="Stack size">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={size === n}
              onClick={() => setStackSize(n)}
              title={n > chosen.length ? `Fill with ${n - chosen.length} guest${n - chosen.length > 1 ? 's' : ''}` : undefined}
              className={cx(
                'h-8 flex-1 rounded-md border font-display text-base font-semibold transition-colors',
                size === n ? 'border-accent/70 bg-accent/15 text-ink' : 'border-line text-muted hover:border-line-2 hover:text-ink',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function RoleLock({ slotKey }: { slotKey: string }) {
  const fixed = useSettings((s) => s.fixedRoles[slotKey]);
  const setFixedRole = useSettings((s) => s.setFixedRole);
  return (
    <Popover
      label="Lock position"
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          title={fixed ? `Always ${POSITION_INFO[fixed].short}` : 'Lock a position'}
          aria-label="Lock a position"
          className={cx(
            'flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full px-1 transition',
            fixed ? 'bg-black/40' : 'text-faint hover:bg-black/30 hover:text-ink',
          )}
        >
          {fixed ? (
            <>
              <PositionIcon position={fixed} size={13} />
              <span className="font-display text-xs font-bold">{fixed}</span>
            </>
          ) : (
            <Pin size={12} />
          )}
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuItem active={!fixed} onClick={() => (setFixedRole(slotKey, null), close())}>
            <span className="w-4" /> Any position
          </MenuItem>
          {POSITIONS.map((p: Position) => (
            <MenuItem key={p} active={fixed === p} onClick={() => (setFixedRole(slotKey, p), close())}>
              <PositionIcon position={p} />
              Pos {p} <span className="text-faint">· {POSITION_INFO[p].short}</span>
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}

function PlayerChip({
  player,
  selected,
  disabled,
  onToggle,
}: {
  player: Player;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cx(
        'flex items-center rounded-full border p-0.5 pr-1 transition',
        selected ? '' : 'border-line bg-bg/40',
        disabled && 'opacity-40',
      )}
      style={selected ? { borderColor: player.color, background: `color-mix(in srgb, ${player.color} 16%, transparent)` } : undefined}
    >
      <button
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={selected}
        className={cx('flex items-center gap-1.5 rounded-full pr-1.5 text-sm font-semibold', !selected && 'text-muted hover:text-ink')}
      >
        <span className={cx('transition', !selected && 'grayscale')}>
          <Avatar name={player.name} color={player.color} size={24} />
        </span>
        {player.name}
      </button>
      {selected && <RoleLock slotKey={player.id} />}
    </div>
  );
}

function GuestChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div className="flex items-center rounded-full border border-line-2 bg-white/5 p-0.5 pr-1">
      <span className="flex items-center gap-1.5 pr-1.5 text-sm font-semibold text-muted">
        <Avatar name="?" color={GUEST_COLOR} size={24} />
        {name}
      </span>
      <RoleLock slotKey={`guest:${name}`} />
      <button onClick={onRemove} aria-label={`Remove ${name}`} className="rounded-full p-1 text-faint hover:bg-black/30 hover:text-ink">
        <X size={12} />
      </button>
    </div>
  );
}

function QuickAdd({ onAdded, empty }: { onAdded: (id: string) => void; empty: boolean }) {
  const [name, setName] = useState('');
  const players = useSquad((s) => s.players);
  const savePlayer = useSquad((s) => s.savePlayer);

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = newId();
    setName('');
    if (await savePlayer({ id, name: trimmed, color: nextColor(players), roles: [], bans: [], createdAt: Date.now() })) onAdded(id);
  };

  return (
    <div className="mt-3">
      {empty && (
        <p className="mb-2 text-sm text-muted">
          Add your friends once. They're saved for every session, with their favourite roles.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
        className="flex items-center gap-2 rounded-lg border border-line bg-bg/50 py-1 pr-1 pl-3 focus-within:border-line-2"
      >
        <UserPlus size={15} className="shrink-0 text-faint" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder="Add a player…"
          aria-label="New player name"
          className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-faint"
        />
        <button
          disabled={!name.trim()}
          className="rounded-md bg-panel-2 px-3 py-1 text-xs font-semibold text-ink ring-1 ring-line-2 transition hover:bg-white/10 disabled:opacity-40"
        >
          Add
        </button>
      </form>
    </div>
  );
}
