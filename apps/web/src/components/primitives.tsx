import { ATTR_INFO, POSITION_INFO, type Attr, type Position } from '@dota-picker/core';
import { X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ATTR_COLOR, cx, POSITION_STYLE } from '../lib/ui';

export function Panel({
  title,
  icon,
  right,
  children,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('rounded-2xl border border-line bg-panel/80 p-4 backdrop-blur-sm', className)}>
      <header className="mb-3 flex items-center gap-2">
        {icon && <span className="text-muted">{icon}</span>}
        <h2 className="font-display text-[15px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</h2>
        {right && <div className="ml-auto">{right}</div>}
      </header>
      {children}
    </section>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-line bg-bg/60 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors',
            o.value === value ? 'bg-panel-2 text-ink shadow-sm ring-1 ring-line-2' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors',
        checked ? 'bg-accent' : 'bg-line-2',
      )}
    >
      <span className={cx('size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
    </button>
  );
}

export function PositionIcon({ position, size = 16, className }: { position: Position; size?: number; className?: string }) {
  const { icon: Icon, color } = POSITION_STYLE[position];
  return <Icon size={size} strokeWidth={2.25} style={{ color }} className={className} aria-hidden />;
}

export function PositionLabel({ position, compact }: { position: Position; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-display font-semibold uppercase tracking-wider">
      <PositionIcon position={position} size={15} />
      <span style={{ color: POSITION_STYLE[position].color }}>Pos {position}</span>
      {!compact && <span className="text-muted">· {POSITION_INFO[position].short}</span>}
    </span>
  );
}

export function AttrDot({ attr, className }: { attr: Attr; className?: string }) {
  return (
    <span
      title={ATTR_INFO[attr].label}
      className={cx('inline-block size-2.5 shrink-0 rotate-45 rounded-[2px]', className)}
      style={{ background: ATTR_COLOR[attr], boxShadow: `0 0 8px ${ATTR_COLOR[attr]}` }}
    />
  );
}

export function Avatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold uppercase text-black/80"
      style={{ width: size, height: size, background: color, fontSize: size * 0.48 }}
    >
      {name.trim().charAt(0) || '?'}
    </span>
  );
}

/** Click-to-open menu anchored under its trigger, closed by outside click or Escape. */
export function Popover({
  trigger,
  children,
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Rendered in a portal with fixed coordinates so scroll containers can't clip it.
  useLayoutEffect(() => {
    if (!open) return setPos(null);
    const a = anchor.current?.getBoundingClientRect();
    const m = menu.current?.getBoundingClientRect();
    if (!a || !m) return;
    const gap = 6;
    const left = Math.max(8, Math.min(a.left, innerWidth - m.width - 8));
    const below = a.bottom + gap;
    const top = below + m.height > innerHeight - 8 && a.top - gap - m.height > 8 ? a.top - gap - m.height : below;
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) =>
      anchor.current?.contains(t as Node) || menu.current?.contains(t as Node);
    const onDown = (e: PointerEvent) => !inside(e.target) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onScroll = (e: Event) => !inside(e.target) && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <div ref={anchor} className="min-w-0">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={label}
            style={pos ?? { top: 0, left: 0, visibility: 'hidden' }}
            className="fixed z-70 w-max min-w-44 animate-fade-up rounded-xl border border-line-2 bg-panel-2 p-1 shadow-2xl shadow-black/60"
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function MenuItem({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm whitespace-nowrap transition-colors',
        active ? 'bg-white/8 text-ink' : 'text-muted hover:bg-white/5 hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);
  if (!open) return null;
  // Portaled so blurred/sticky ancestors can't become the containing block.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" data-modal>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'relative flex max-h-[92dvh] w-full animate-fade-up flex-col rounded-t-2xl border border-line-2 bg-panel shadow-2xl sm:rounded-2xl',
          wide ? 'sm:max-w-4xl' : 'sm:max-w-md',
        )}
      >
        <header className="flex items-center gap-3 border-b border-line px-5 py-4">
          <h2 className="font-display text-xl font-semibold uppercase tracking-wider">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="ml-auto rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-ink">
            <X size={18} />
          </button>
        </header>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
