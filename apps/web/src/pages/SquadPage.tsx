import { getHero, heroImages, pickedHeroId, POSITION_INFO, POSITIONS, type Player, type Position } from '@dota-picker/core';
import { Ban, Check, Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { HeroPicker } from '../components/HeroPicker';
import { Avatar, Popover, PositionIcon } from '../components/primitives';
import { nextColor } from '../lib/players';
import { useSquad } from '../lib/squad';
import { cx, newId, PLAYER_COLORS, POSITION_STYLE } from '../lib/ui';

export function SquadPage() {
  const players = useSquad((s) => s.players);
  const sync = useSquad((s) => s.sync);

  return (
    <div className="mx-auto max-w-5xl pt-8">
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide">Squad</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        {sync === 'local'
          ? 'Saved in this browser only (the server is unreachable).'
          : 'Shared with everyone who opens this site.'}{' '}
        Set each friend's favourite roles (used when roles are on "Preferred") and heroes they never want.
      </p>

      <AddPlayer />

      {players.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-line py-14 text-center">
          <Users size={32} className="text-faint" />
          <p className="mt-3 font-semibold">No players yet</p>
          <p className="mt-1 text-sm text-muted">Add your friends above. Then tap who's playing on the Draft page.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {players.map((p) => (
            <PlayerCard key={p.id} player={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function AddPlayer() {
  const players = useSquad((s) => s.players);
  const savePlayer = useSquad((s) => s.savePlayer);
  const [name, setName] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        setName('');
        void savePlayer({ id: newId(), name: trimmed, color: nextColor(players), roles: [], bans: [], createdAt: Date.now() });
      }}
      className="mt-6 flex items-center gap-2 rounded-xl border border-line bg-panel p-1.5 pl-4 focus-within:border-line-2"
    >
      <UserPlus size={18} className="shrink-0 text-faint" />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={24}
        placeholder="Friend's name or Steam nickname"
        aria-label="New player name"
        className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-faint"
      />
      <button
        disabled={!name.trim()}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
      >
        Add player
      </button>
    </form>
  );
}

function PlayerCard({ player }: { player: Player }) {
  const savePlayer = useSquad((s) => s.savePlayer);
  const removePlayer = useSquad((s) => s.removePlayer);
  const drafts = useSquad((s) => s.drafts);
  const [name, setName] = useState(player.name);
  const [bansOpen, setBansOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => setName(player.name), [player.name]);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  const save = (patch: Partial<Player>) => void savePlayer({ ...player, ...patch });

  const recent = useMemo(
    () =>
      drafts
        .flatMap((d) => d.slots.filter((s) => s.playerId === player.id).map(pickedHeroId))
        .filter((id): id is number => id !== undefined)
        .slice(0, 8),
    [drafts, player.id],
  );

  const toggleRole = (p: Position) =>
    save({ roles: player.roles.includes(p) ? player.roles.filter((r) => r !== p) : [...player.roles, p] });

  return (
    <article className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-center gap-3">
        <Popover
          label="Player colour"
          trigger={({ toggle }) => (
            <button onClick={toggle} title="Change colour" className="rounded-full ring-offset-2 ring-offset-panel transition hover:ring-2 hover:ring-line-2">
              <Avatar name={player.name} color={player.color} size={40} />
            </button>
          )}
        >
          {(close) => (
            <div className="grid grid-cols-5 gap-1.5 p-1.5">
              {PLAYER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => (save({ color: c }), close())}
                  aria-label={`Colour ${c}`}
                  className="flex size-7 items-center justify-center rounded-full"
                  style={{ background: c }}
                >
                  {c === player.color && <Check size={14} className="text-black/80" strokeWidth={3} />}
                </button>
              ))}
            </div>
          )}
        </Popover>

        <label className="group flex min-w-0 flex-1 items-center gap-2">
          <input
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => (name.trim() && name.trim() !== player.name ? save({ name: name.trim() }) : setName(player.name))}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            aria-label="Player name"
            className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 font-display text-2xl font-bold uppercase tracking-wide outline-none hover:bg-white/5 focus:bg-white/5"
          />
          <Pencil size={14} className="shrink-0 text-faint opacity-0 transition group-hover:opacity-100" />
        </label>

        <button
          onClick={() => (confirming ? void removePlayer(player.id) : setConfirming(true))}
          className={cx(
            'flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition',
            confirming ? 'bg-accent text-white' : 'text-faint hover:bg-white/5 hover:text-accent',
          )}
          aria-label={confirming ? `Confirm removing ${player.name}` : `Remove ${player.name}`}
        >
          <Trash2 size={15} />
          {confirming && 'Remove?'}
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline gap-2">
          <span className="text-sm font-medium">Preferred roles</span>
          <span className="text-xs text-faint">{player.roles.length ? 'in order of preference' : 'none: happy anywhere'}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {POSITIONS.map((p) => {
            const rank = player.roles.indexOf(p);
            const on = rank !== -1;
            return (
              <button
                key={p}
                onClick={() => toggleRole(p)}
                aria-pressed={on}
                className={cx(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
                  on ? 'border-line-2 bg-panel-2 text-ink' : 'border-line text-muted hover:border-line-2 hover:text-ink',
                )}
                style={on ? { boxShadow: `inset 0 -2px 0 ${POSITION_STYLE[p].color}` } : undefined}
              >
                <PositionIcon position={p} size={14} />
                {POSITION_INFO[p].short}
                {on && (
                  <span
                    className="flex size-4 items-center justify-center rounded-full text-[10px] font-bold text-black"
                    style={{ background: POSITION_STYLE[p].color }}
                  >
                    {rank + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <div className="mb-1.5 text-sm font-medium">Never pick</div>
          <button
            onClick={() => setBansOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-xs font-semibold text-muted transition hover:border-line-2 hover:text-ink"
          >
            {player.bans.length ? (
              <>
                <HeroIcons ids={player.bans} max={6} />
                <span>{player.bans.length}</span>
              </>
            ) : (
              <>
                <Ban size={14} /> Add bans
              </>
            )}
          </button>
        </div>
        {recent.length > 0 && (
          <div>
            <div className="mb-1.5 text-sm font-medium">Recently drafted</div>
            <HeroIcons ids={recent} max={8} />
          </div>
        )}
      </div>

      <HeroPicker
        open={bansOpen}
        onClose={() => setBansOpen(false)}
        title={`${player.name} never picks`}
        selected={player.bans}
        onChange={(bans) => save({ bans })}
      />
    </article>
  );
}

function HeroIcons({ ids, max }: { ids: number[]; max: number }) {
  return (
    <span className="flex items-center gap-1">
      {ids.slice(0, max).map((id, i) => {
        const h = getHero(id);
        return h && <img key={`${id}-${i}`} src={heroImages.icon(h)} alt={h.name} title={h.name} className="size-6 rounded" />;
      })}
      {ids.length > max && <span className="text-xs text-faint">+{ids.length - max}</span>}
    </span>
  );
}
