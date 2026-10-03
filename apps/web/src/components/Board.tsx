import { getCombo, getHero, getMode, getTheme, POSITION_INFO, type Draft, type Position } from '@dota-picker/core';
import { BookmarkCheck, BookmarkPlus, ExternalLink, Info, Link2, MessageSquare, Palette, Sparkles, Trophy, X } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { copyForDiscord, saveCurrentDraft, shareDraft, slotKey } from '../lib/actions';
import { useDraftStore } from '../lib/draftStore';
import { useSettings } from '../lib/settings';
import { useSquad } from '../lib/squad';
import { cx, POSITION_STYLE } from '../lib/ui';
import { MODE_ICON } from './ModePanel';
import { PositionIcon } from './primitives';
import { SlotCard } from './SlotCard';

/** Slot indexes ordered by position, which is also the 1–5 hotkey order. */
export const displayOrder = (draft: Draft) =>
  draft.slots.map((_, i) => i).sort((a, b) => draft.slots[a]!.position - draft.slots[b]!.position);

const gridClass =
  'grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-[repeat(var(--n),minmax(0,300px))] lg:justify-center';

export function Board() {
  const draft = useDraftStore((s) => s.draft);
  if (!draft) return <EmptyBoard />;
  const order = displayOrder(draft);
  return (
    <div className="space-y-3">
      <DraftSummary draft={draft} />
      <div className={gridClass} style={{ '--n': draft.slots.length } as CSSProperties}>
        {order.map((i, k) => (
          <SlotCard key={slotKey(draft.slots[i]!)} draft={draft} index={i} order={k} hotkey={k + 1} />
        ))}
      </div>
      <ActionBar />
    </div>
  );
}

function Banner({
  tone,
  icon,
  title,
  children,
  footer,
}: {
  tone: 'gold' | 'accent';
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className={cx(
        'flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl border px-4 py-2.5',
        tone === 'gold' ? 'border-gold/30 bg-gradient-to-r from-gold/12 to-transparent' : 'border-accent/30 bg-gradient-to-r from-accent/12 to-transparent',
      )}
    >
      <span className={tone === 'gold' ? 'text-gold' : 'text-accent-2'}>{icon}</span>
      <span
        className={cx(
          'font-display text-lg font-bold uppercase tracking-wider',
          tone === 'gold' ? 'text-gold' : 'text-accent-2',
        )}
      >
        {title}
      </span>
      {children && <span className="text-sm text-muted">{children}</span>}
      {footer && <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">{footer}</div>}
    </div>
  );
}

function DraftSummary({ draft }: { draft: Draft }) {
  const shared = useDraftStore((s) => s.shared);
  const mode = getMode(draft.mode);
  const ModeIcon = MODE_ICON[draft.mode];
  const combo = getCombo(draft.comboId);
  const theme = getTheme(draft.theme);
  const keys = new Set(draft.slots.flatMap((s) => s.heroes).map((id) => getHero(id)?.key));
  const broken = combo && !combo.heroes.every((k) => keys.has(k));

  return (
    <div className="space-y-2">
      {shared && (
        <div className="flex items-center gap-2 rounded-xl border border-int/30 bg-int/10 px-4 py-2 text-sm">
          <Link2 size={16} className="shrink-0 text-int" />
          <span>
            <span className="font-semibold">Shared draft.</span> <span className="text-muted">Someone sent you this lineup.</span>
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 text-sm text-muted">
        <ModeIcon size={15} />
        <span className="font-display text-base font-semibold uppercase tracking-wider text-ink">{mode.name}</span>
        <span className="text-faint">·</span>
        <span>{draft.slots.length === 1 ? 'Solo' : `${draft.slots.length}-stack`}</span>
      </div>
      {combo && (
        <Banner
          tone="gold"
          icon={<Sparkles size={18} />}
          title={combo.name}
          footer={
            <>
              {combo.style === 'meme' && <span className="rounded bg-pos4/15 px-1.5 py-px font-semibold text-pos4">🤡 Meme combo</span>}
              {combo.note && (
                <span className="flex items-center gap-1 text-pos1">
                  <Info size={12} /> {combo.note}
                </span>
              )}
              {combo.moment && (
                <span className="flex items-center gap-1 text-gold/90">
                  <Trophy size={12} /> {combo.moment}
                </span>
              )}
              <span className="ml-auto flex items-center gap-3 text-faint">
                <span title="Every ability in this combo was checked against this patch">Checked on {combo.verifiedPatch}</span>
                {combo.source && (
                  <a
                    href={combo.source}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 underline-offset-2 hover:text-ink hover:underline"
                  >
                    Source <ExternalLink size={11} />
                  </a>
                )}
              </span>
            </>
          }
        >
          {broken ? 'Combo broken by a reroll. Draft again to get one back.' : combo.how}
        </Banner>
      )}
      {draft.mode === 'wombo' && !combo && (
        <Banner tone="gold" icon={<Sparkles size={18} />} title="Teamfight squad">
          No combo fits this stack, so everyone got big teamfight heroes.
        </Banner>
      )}
      {theme && (
        <Banner tone="accent" icon={<Palette size={18} />} title={theme.name}>
          {theme.blurb}
        </Banner>
      )}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  hotkey,
  onClick,
  disabled,
  primary,
}: {
  icon: ReactNode;
  label: string;
  hotkey: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={`${label} (${hotkey})`}
      className={cx(
        'flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition disabled:pointer-events-none',
        primary
          ? 'border-[#5865f2]/60 bg-[#5865f2]/20 text-ink hover:bg-[#5865f2]/30'
          : 'border-line bg-panel text-muted hover:border-line-2 hover:text-ink',
        disabled && 'opacity-60',
      )}
    >
      {icon}
      {label}
      <kbd className="kbd hidden lg:inline-flex">{hotkey}</kbd>
    </button>
  );
}

function ActionBar() {
  const saved = useDraftStore((s) => s.saved);
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <ActionButton primary icon={<MessageSquare size={16} />} label="Copy for Discord" hotkey="C" onClick={() => void copyForDiscord()} />
      <ActionButton icon={<Link2 size={16} />} label="Share link" hotkey="L" onClick={() => void shareDraft()} />
      <ActionButton
        icon={saved ? <BookmarkCheck size={16} className="text-ok" /> : <BookmarkPlus size={16} />}
        label={saved ? 'Saved' : 'Save to history'}
        hotkey="S"
        disabled={saved}
        onClick={() => void saveCurrentDraft()}
      />
      <span className="ml-auto hidden items-center gap-1.5 text-xs text-faint xl:flex">
        <kbd className="kbd">⇧</kbd>+<kbd className="kbd">1–5</kbd> lock
        <span className="mx-1">·</span>
        <kbd className="kbd">?</kbd> all shortcuts
      </span>
    </div>
  );
}

function EmptyBoard() {
  const selected = useSettings((s) => s.selected);
  const guests = useSettings((s) => s.guests);
  const players = useSquad((s) => s.players);
  const size = selected.filter((id) => players.some((p) => p.id === id)).length + guests;
  const ghosts: Position[] = ([1, 2, 3, 4, 5] as Position[]).slice(0, size || 5);

  return (
    <div className="flex flex-col items-center pt-6 xl:pt-10">
      <h2 className="font-display text-4xl font-bold uppercase tracking-wide sm:text-5xl">Ready to roll?</h2>
      <p className="mt-2 max-w-md text-center text-sm text-muted">
        {size === 0 ? "Tap who's playing (or set a stack size), pick a mode, then draft." : 'Pick a mode, then draft.'}
        <span className="hidden lg:inline">
          {' '}
          Or just press <kbd className="kbd">Space</kbd>.
        </span>
      </p>
      <div
        className={cx(gridClass, 'pointer-events-none mt-8 w-full select-none opacity-60')}
        style={{ '--n': ghosts.length } as CSSProperties}
        aria-hidden
      >
        {ghosts.map((p) => (
          <div
            key={p}
            className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-panel/30 sm:aspect-[3/4] sm:min-h-0"
            style={{ borderTopColor: POSITION_STYLE[p].color }}
          >
            <PositionIcon position={p} size={26} className="opacity-60" />
            <span className="font-display text-sm font-semibold uppercase tracking-wider text-faint">{POSITION_INFO[p].short}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkipHint() {
  const spinning = useDraftStore((s) => s.reveal.slots.length > 0);
  const skip = useDraftStore((s) => s.skipReveal);
  if (!spinning) return null;
  return (
    <button onClick={skip} className="hidden items-center gap-1 text-xs text-faint hover:text-ink lg:flex">
      <X size={12} /> Skip animation <kbd className="kbd">Esc</kbd>
    </button>
  );
}
