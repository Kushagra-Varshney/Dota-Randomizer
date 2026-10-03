import { ATTR_INFO, HEROES, heroImages, type Attr } from '@dota-picker/core';
import { Ban, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ATTR_COLOR, cx } from '../lib/ui';
import { AttrDot, Modal } from './primitives';

const ATTRS: Attr[] = ['str', 'agi', 'int', 'all'];

/** Searchable hero grid for picking a set of heroes (bans). */
export function HeroPicker({
  open,
  onClose,
  title,
  selected,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [attr, setAttr] = useState<Attr | null>(null);
  const chosen = useMemo(() => new Set(selected), [selected]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = HEROES.filter(
      (h) => (!attr || h.attr === attr) && (!q || h.name.toLowerCase().includes(q) || h.key.includes(q.replace(/\s+/g, '_'))),
    );
    return ATTRS.map((a) => ({ attr: a, heroes: visible.filter((h) => h.attr === a) })).filter((g) => g.heroes.length);
  }, [query, attr]);

  const toggle = (id: number) => onChange(chosen.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      wide
      footer={
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">
            <span className="font-semibold text-ink">{selected.length}</span> banned
          </span>
          {selected.length > 0 && (
            <button onClick={() => onChange([])} className="text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline">
              Clear all
            </button>
          )}
          <button onClick={onClose} className="ml-auto rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg hover:bg-white">
            Done
          </button>
        </div>
      }
    >
      <div className="sticky -top-4 z-10 -mx-5 -mt-4 mb-3 flex flex-wrap items-center gap-2 border-b border-line bg-panel/95 px-5 py-3 backdrop-blur">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-bg/60 px-3 py-2 focus-within:border-line-2">
          <Search size={16} className="text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search heroes…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </label>
        <div className="flex gap-1">
          {ATTRS.map((a) => (
            <button
              key={a}
              onClick={() => setAttr(attr === a ? null : a)}
              aria-pressed={attr === a}
              className={cx(
                'flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors',
                attr === a ? 'border-line-2 bg-panel-2 text-ink' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              <AttrDot attr={a} />
              <span className="hidden sm:inline">{ATTR_INFO[a].short}</span>
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 && <p className="py-10 text-center text-sm text-muted">No heroes match "{query}"</p>}

      {groups.map((g) => (
        <section key={g.attr} className="mb-4">
          <h3
            className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.14em]"
            style={{ color: ATTR_COLOR[g.attr] }}
          >
            {ATTR_INFO[g.attr].label}
          </h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-1.5">
            {g.heroes.map((h) => {
              const banned = chosen.has(h.id);
              return (
                <button
                  key={h.id}
                  onClick={() => toggle(h.id)}
                  aria-pressed={banned}
                  title={h.name}
                  className={cx(
                    'group relative aspect-video overflow-hidden rounded-md ring-1 transition',
                    banned ? 'ring-2 ring-accent' : 'ring-line hover:ring-line-2',
                  )}
                >
                  <img
                    src={heroImages.portrait(h)}
                    alt=""
                    loading="lazy"
                    className={cx('size-full object-cover transition', banned ? 'grayscale brightness-50' : 'group-hover:scale-105')}
                  />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-1 pt-3 pb-0.5 text-[10px] font-semibold">
                    {h.name}
                  </span>
                  {banned && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Ban size={22} className="text-accent drop-shadow" strokeWidth={2.5} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </Modal>
  );
}
