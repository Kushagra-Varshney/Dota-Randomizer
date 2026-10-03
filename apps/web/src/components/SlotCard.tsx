import {
  ATTR_INFO,
  getCombo,
  getHero,
  heroImages,
  POSITION_INFO,
  POSITIONS,
  type Draft,
  type Hero,
} from '@dota-picker/core';
import { ChevronDown, Dices, Lock, LockOpen, Sparkles, Undo2 } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { choosePick, moveToPosition, rerollOne, toggleLock } from '../lib/actions';
import { useDraftStore } from '../lib/draftStore';
import { reelFrames } from '../lib/reel';
import { ATTR_COLOR, cx, POSITION_STYLE } from '../lib/ui';
import { AttrDot, MenuItem, Popover, PositionIcon } from './primitives';

const REEL_FRAMES = 14;

export function SlotCard({ draft, index, order, hotkey }: { draft: Draft; index: number; order: number; hotkey: number }) {
  const slot = draft.slots[index]!;
  const reveal = useDraftStore((s) => s.reveal);
  const finishSpin = useDraftStore((s) => s.finishSpin);
  const spinning = reveal.slots.includes(index);

  const choosing = slot.pick === null && slot.heroes.length > 1;
  const heroId = slot.heroes[slot.pick ?? 0]!;
  const hero = getHero(heroId);
  const combo = getCombo(draft.comboId);
  const inCombo = !!hero && !!combo?.heroes.includes(hero.key);
  const offRole = !!hero && !hero.positions.includes(slot.position);
  const posColor = POSITION_STYLE[slot.position].color;

  return (
    <article
      className={cx(
        'group/card relative grid grid-cols-[42%_minmax(0,1fr)] rounded-xl border bg-panel transition-[border-color,box-shadow] sm:grid-cols-1',
        slot.locked ? 'border-gold/70 shadow-[0_0_24px_-6px_rgb(233_180_76/0.45)]' : 'border-line hover:border-line-2',
      )}
    >
      <div className="absolute inset-x-0 top-0 z-10 h-0.5 rounded-t-xl" style={{ background: posColor }} />

      {/* Position + player */}
      <header className="col-start-2 flex min-w-0 flex-col gap-1 px-3 pt-2.5 sm:col-start-1 sm:border-b sm:border-line sm:pb-2.5">
        <div className="flex min-w-0 items-center gap-1">
          <Popover
            label="Change position"
            trigger={({ toggle }) => (
              <button
                onClick={toggle}
                className="-ml-1 flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 font-display text-[13px] font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/5"
                title="Swap position"
              >
                <PositionIcon position={slot.position} size={14} className="shrink-0" />
                <span style={{ color: posColor }}>Pos {slot.position}</span>
                <span className="min-w-0 truncate text-muted">{POSITION_INFO[slot.position].short}</span>
                <ChevronDown size={12} className="shrink-0 text-faint" />
              </button>
            )}
          >
            {(close) =>
              POSITIONS.map((p) => {
                const holder = draft.slots.find((s) => s.position === p);
                return (
                  <MenuItem key={p} active={p === slot.position} onClick={() => (moveToPosition(index, p), close())}>
                    <PositionIcon position={p} />
                    <span>
                      Pos {p} <span className="text-faint">· {POSITION_INFO[p].short}</span>
                    </span>
                    {holder && holder !== slot && <span className="ml-auto text-xs text-faint">swap {holder.name}</span>}
                  </MenuItem>
                );
              })
            }
          </Popover>
          <span className="kbd ml-auto hidden lg:inline-flex" title={`Press ${hotkey} to reroll`}>
            {hotkey}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: slot.color, boxShadow: `0 0 10px ${slot.color}` }} />
          <span className="truncate text-[15px] font-semibold">{slot.name}</span>
        </div>
      </header>

      {/* Art */}
      <div className="relative col-start-1 row-span-3 row-start-1 min-h-[112px] overflow-hidden rounded-l-[11px] bg-bg sm:row-span-1 sm:row-start-2 sm:aspect-[16/10] sm:min-h-0 sm:rounded-none">
        {spinning ? (
          <Reel finalId={heroId} order={order} onDone={() => finishSpin(index, reveal.token)} />
        ) : choosing ? (
          <ChoiceList heroes={slot.heroes.map(getHero).filter((h): h is Hero => !!h)} onPick={(k) => choosePick(index, k)} />
        ) : (
          hero && <HeroArt key={heroId} hero={hero} />
        )}
        {slot.locked && !spinning && (
          <span className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-gold backdrop-blur">
            <Lock size={12} />
          </span>
        )}
      </div>

      {/* Hero info */}
      <div className="col-start-2 min-w-0 px-3 pt-1.5 pb-2 sm:col-start-1 sm:pt-2.5">
        {spinning ? (
          <div className="space-y-1.5 py-0.5">
            <div className="h-5 w-3/4 animate-pulse rounded bg-white/8" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
          </div>
        ) : choosing ? (
          <div>
            <div className="font-display text-lg font-semibold uppercase leading-tight tracking-wide text-gold">Pick one</div>
            <div className="text-xs text-muted">{slot.heroes.length} options, tap a hero</div>
          </div>
        ) : (
          hero && (
            <div className="animate-fade-up">
              <div className="flex items-start gap-1">
                <h3 className="min-w-0 flex-1 truncate font-display text-xl font-bold uppercase leading-tight tracking-wide">
                  {hero.name}
                </h3>
                {slot.heroes.length > 1 && (
                  <button
                    onClick={() => choosePick(index, null)}
                    title="Choose again"
                    aria-label="Choose a different option"
                    className="mt-0.5 rounded p-0.5 text-faint hover:bg-white/5 hover:text-ink"
                  >
                    <Undo2 size={14} />
                  </button>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <AttrDot attr={hero.attr} />
                  {ATTR_INFO[hero.attr].short} · {hero.attack}
                </span>
                {inCombo && (
                  <span className="flex items-center gap-1 rounded bg-gold/15 px-1.5 py-px font-semibold text-gold">
                    <Sparkles size={11} /> Combo
                  </span>
                )}
                {offRole && (
                  <span
                    title={`Usually played: ${hero.positions.map((p) => `Pos ${p}`).join(', ')}`}
                    className="rounded bg-pos3/15 px-1.5 py-px font-semibold text-pos3"
                  >
                    Off-role
                  </span>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {/* Actions */}
      <div className="col-start-2 mt-auto grid grid-cols-2 overflow-hidden rounded-br-[11px] border-t border-line sm:col-start-1 sm:rounded-b-[11px]">
        <button
          onClick={() => toggleLock(index)}
          aria-pressed={!!slot.locked}
          title={`${slot.locked ? 'Unlock' : 'Lock'} (Shift+${hotkey})`}
          className={cx(
            'flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors',
            slot.locked ? 'bg-gold/10 text-gold' : 'text-muted hover:bg-white/5 hover:text-ink',
          )}
        >
          {slot.locked ? <Lock size={14} /> : <LockOpen size={14} />}
          {slot.locked ? 'Locked' : 'Lock'}
        </button>
        <button
          onClick={() => rerollOne(index)}
          disabled={slot.locked}
          title={`Reroll (${hotkey})`}
          className="group/reroll flex items-center justify-center gap-1.5 border-l border-line py-2 text-xs font-semibold text-muted transition-colors hover:bg-white/5 hover:text-ink disabled:pointer-events-none disabled:opacity-35"
        >
          <Dices size={14} className="transition-transform group-hover/reroll:rotate-90" />
          Reroll
        </button>
      </div>
    </article>
  );
}

/**
 * Transparent hero cut-out on an attribute-tinted backdrop. Until the cut-out has
 * loaded, the portrait the reel landed on (already cached) stands in for it.
 */
function HeroArt({ hero }: { hero: Hero }) {
  const [loaded, setLoaded] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    if (img.current?.complete && img.current.naturalWidth) setLoaded(true);
  }, []);
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(110% 95% at 50% 115%, color-mix(in srgb, ${ATTR_COLOR[hero.attr]} 55%, transparent), transparent 70%), linear-gradient(180deg, #171d29, #0b0e14)`,
      }}
    >
      <img
        src={heroImages.portrait(hero)}
        alt=""
        draggable={false}
        className={cx('absolute inset-0 size-full object-cover transition-opacity duration-300', loaded && 'opacity-0')}
      />
      <img
        ref={img}
        src={heroImages.crop(hero)}
        alt={hero.name}
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={cx('absolute inset-0 size-full object-contain object-bottom', loaded ? 'animate-pop' : 'opacity-0')}
      />
      <div className="pointer-events-none absolute inset-0 animate-flash bg-[radial-gradient(circle_at_50%_70%,rgb(255_255_255/0.85),transparent_65%)] opacity-0" />
    </div>
  );
}

/** Slot-machine strip of portraits that decelerates onto the drafted hero. */
function Reel({ finalId, order, onDone }: { finalId: number; order: number; onDone: () => void }) {
  const strip = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const frames = useMemo(() => [...reelFrames(finalId, REEL_FRAMES), finalId], [finalId]);

  useLayoutEffect(() => {
    const el = strip.current;
    if (!el) return;
    const shift = ((frames.length - 1) / frames.length) * 100;
    const animation = el.animate([{ transform: 'translateY(0)' }, { transform: `translateY(-${shift}%)` }], {
      duration: 800 + order * 220,
      easing: 'cubic-bezier(0.12, 0.8, 0.25, 1)',
      fill: 'forwards',
    });
    animation.onfinish = () => done.current();
    return () => animation.cancel();
  }, [frames, order]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <div ref={strip} className="absolute inset-x-0 top-0 will-change-transform" style={{ height: `${frames.length * 100}%` }}>
        {frames.map((id, i) => {
          const h = getHero(id);
          return (
            h && (
              <img
                key={i}
                src={heroImages.portrait(h)}
                alt=""
                draggable={false}
                className="block w-full object-cover blur-[0.5px]"
                style={{ height: `${100 / frames.length}%` }}
              />
            )
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0/0.75),transparent_30%,transparent_70%,rgb(0_0_0/0.75))]" />
    </div>
  );
}

function ChoiceList({ heroes, onPick }: { heroes: Hero[]; onPick: (index: number) => void }) {
  return (
    <div className="absolute inset-0 flex flex-col gap-px bg-line">
      {heroes.map((h, k) => (
        <button
          key={h.id}
          onClick={() => onPick(k)}
          className="group/choice relative flex-1 overflow-hidden bg-bg text-left"
          style={{ animationDelay: `${k * 60}ms` }}
        >
          <img
            src={heroImages.portrait(h)}
            alt=""
            className="absolute inset-0 size-full object-cover object-[50%_30%] opacity-75 transition duration-300 group-hover/choice:scale-105 group-hover/choice:opacity-100"
          />
          <span className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/45 to-transparent" />
          <span className="relative flex h-full items-center gap-2 px-3">
            <AttrDot attr={h.attr} />
            <span className="truncate font-display text-base font-semibold uppercase tracking-wide drop-shadow">{h.name}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
