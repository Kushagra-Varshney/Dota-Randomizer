import { Cloud, Dices, HardDrive, History, Keyboard, KeyRound, LoaderCircle, Users } from 'lucide-react';
import { navigate, type Route } from '../lib/router';
import { useSquad } from '../lib/squad';
import { cx } from '../lib/ui';

const NAV: { route: Route; label: string; icon: typeof Dices }[] = [
  { route: 'draft', label: 'Draft', icon: Dices },
  { route: 'squad', label: 'Squad', icon: Users },
  { route: 'history', label: 'History', icon: History },
];

export function Header({ route, onShortcuts }: { route: Route; onShortcuts: () => void }) {
  const sync = useSquad((s) => s.sync);
  const pinRequired = useSquad((s) => s.pinRequired);
  const setPinPrompt = useSquad((s) => s.setPinPrompt);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:h-16 sm:px-6">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('draft');
          }}
          className="flex items-center gap-2.5"
        >
          <img src="/favicon.svg" alt="" className="size-8" />
          <span className="hidden font-display text-2xl font-bold uppercase leading-none tracking-wider min-[420px]:block">
            Dota <span className="text-accent-2">Picker</span>
          </span>
        </a>

        <nav className="ml-auto flex items-center gap-1 rounded-xl border border-line bg-panel/70 p-1 sm:ml-6">
          {NAV.map(({ route: r, label, icon: Icon }) => (
            <a
              key={r}
              href={r === 'draft' ? '/' : `/${r}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(r);
              }}
              aria-current={route === r ? 'page' : undefined}
              className={cx(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                route === r ? 'bg-panel-2 text-ink ring-1 ring-line-2' : 'text-muted hover:text-ink',
              )}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:ml-auto">
          <SyncBadge sync={sync} />
          {pinRequired && (
            <button
              onClick={() => setPinPrompt(true)}
              title="Enter squad PIN"
              aria-label="Enter squad PIN"
              className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-ink"
            >
              <KeyRound size={18} />
            </button>
          )}
          <button
            onClick={onShortcuts}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            className="hidden rounded-lg p-2 text-muted hover:bg-white/5 hover:text-ink md:block"
          >
            <Keyboard size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

function SyncBadge({ sync }: { sync: 'loading' | 'cloud' | 'local' }) {
  const info = {
    loading: { icon: LoaderCircle, label: 'Connecting', tip: 'Connecting to the squad server…', color: 'text-muted' },
    cloud: { icon: Cloud, label: 'Synced', tip: 'Squad and history are shared with everyone using this site', color: 'text-ok' },
    local: { icon: HardDrive, label: 'Local', tip: 'Server unreachable: squad and history are saved in this browser only', color: 'text-gold' },
  }[sync];
  const Icon = info.icon;
  return (
    <span
      title={info.tip}
      className={cx('flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold', info.color)}
    >
      <Icon size={15} className={sync === 'loading' ? 'animate-spin' : undefined} />
      <span className="hidden lg:inline">{info.label}</span>
    </span>
  );
}
