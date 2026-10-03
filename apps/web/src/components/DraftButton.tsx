import { Dices } from 'lucide-react';
import { rollDraft } from '../lib/actions';
import { useDraftStore } from '../lib/draftStore';
import { useSettings } from '../lib/settings';
import { useSquad } from '../lib/squad';
import { cx } from '../lib/ui';

/** Rolls, then on narrow screens scrolls the result into view. */
export function roll() {
  (document.activeElement as HTMLElement | null)?.blur?.();
  rollDraft();
  if (!matchMedia('(min-width: 1280px)').matches) {
    requestAnimationFrame(() => document.getElementById('board')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
}

export function DraftButton({ className }: { className?: string }) {
  const selected = useSettings((s) => s.selected);
  const guests = useSettings((s) => s.guests);
  const players = useSquad((s) => s.players);
  const hasLocks = useDraftStore((s) => !!s.draft?.slots.some((slot) => slot.locked));
  const size = selected.filter((id) => players.some((p) => p.id === id)).length + guests;

  return (
    <button
      onClick={roll}
      disabled={size === 0}
      className={cx(
        'group relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-gradient-to-b from-accent-2 to-accent font-display text-2xl font-bold uppercase tracking-[0.16em] text-white shadow-[0_10px_30px_-10px_rgb(229_72_58/0.8),inset_0_1px_0_rgb(255_255_255/0.25)] transition hover:brightness-110 active:translate-y-px disabled:opacity-40 disabled:shadow-none',
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <Dices size={24} className="transition-transform duration-300 group-hover:rotate-[20deg] group-active:rotate-[90deg]" />
      {hasLocks ? 'Reroll' : 'Draft'}
      <kbd className="kbd hidden border-white/25 bg-black/15 text-white/80 lg:inline-flex">Space</kbd>
    </button>
  );
}
