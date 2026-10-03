import { draftToText, getCombo, getHero, getMode, getTheme, heroImages, type Draft } from '@dota-picker/core';
import { ArrowRight, Copy, History, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MODE_ICON } from '../components/ModePanel';
import { PositionIcon } from '../components/primitives';
import { openDraft, shareUrl } from '../lib/actions';
import { navigate } from '../lib/router';
import { useSquad } from '../lib/squad';
import { toast } from '../lib/toast';
import { copyText, cx, timeAgo } from '../lib/ui';

export function HistoryPage() {
  const drafts = useSquad((s) => s.drafts);

  return (
    <div className="mx-auto max-w-5xl pt-8">
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide">History</h1>
      <p className="mt-1 text-sm text-muted">Drafts you saved. "Avoid repeats" uses these so nobody plays the same hero every night.</p>

      {drafts.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-line py-14 text-center">
          <History size={32} className="text-faint" />
          <p className="mt-3 font-semibold">No saved drafts yet</p>
          <p className="mt-1 text-sm text-muted">
            Hit <span className="font-semibold text-ink">Save to history</span> (or <kbd className="kbd">S</kbd>) once you lock in a lineup.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-2.5">
          {drafts.map((d) => (
            <HistoryRow key={d.id} draft={d} />
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryRow({ draft }: { draft: Draft }) {
  const removeDraft = useSquad((s) => s.removeDraft);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  const Icon = MODE_ICON[draft.mode];
  const extra = getCombo(draft.comboId)?.name ?? getTheme(draft.theme)?.name;
  const slots = [...draft.slots].sort((a, b) => a.position - b.position);

  return (
    <li className="rounded-2xl border border-line bg-panel p-3 sm:p-4">
      <div className="flex items-center gap-2 text-sm">
        <Icon size={15} className="text-muted" />
        <span className="font-display text-base font-semibold uppercase tracking-wider">{getMode(draft.mode).name}</span>
        {extra && <span className="hidden truncate text-muted sm:inline">· {extra}</span>}
        <span className="text-faint">· {timeAgo(draft.createdAt)}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={async () => {
              const ok = await copyText(draftToText(draft, shareUrl(draft)));
              if (ok) toast.success('Copied. Paste it in Discord');
            }}
            title="Copy for Discord"
            aria-label="Copy for Discord"
            className="rounded-lg p-2 text-faint hover:bg-white/5 hover:text-ink"
          >
            <Copy size={15} />
          </button>
          <button
            onClick={() => (confirming ? void removeDraft(draft.id) : setConfirming(true))}
            aria-label={confirming ? 'Confirm delete' : 'Delete draft'}
            className={cx(
              'flex items-center gap-1 rounded-lg p-2 text-xs font-semibold transition',
              confirming ? 'bg-accent text-white' : 'text-faint hover:bg-white/5 hover:text-accent',
            )}
          >
            <Trash2 size={15} />
            {confirming && 'Delete?'}
          </button>
          <button
            onClick={() => {
              openDraft(draft, { saved: true });
              navigate('draft');
            }}
            className="ml-1 flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-line-2 hover:text-ink"
          >
            Open <ArrowRight size={13} />
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-1.5 min-[480px]:grid-cols-2 md:grid-cols-5">
        {slots.map((s, i) => {
          const hero = getHero(s.heroes[s.pick ?? 0]!);
          return (
            <div key={i} className="flex min-w-0 items-center gap-2 rounded-lg bg-bg/50 p-1.5">
              {hero && <img src={heroImages.portrait(hero)} alt="" loading="lazy" className="aspect-video w-14 shrink-0 rounded object-cover" />}
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-xs text-muted">
                  <PositionIcon position={s.position} size={11} />
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate">{s.name}</span>
                </div>
                <div className="truncate text-sm font-semibold">
                  {s.pick === null && s.heroes.length > 1 ? `${s.heroes.length} options` : hero?.name}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </li>
  );
}
