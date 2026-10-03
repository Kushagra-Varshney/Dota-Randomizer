import { CircleCheck, CircleX, Info, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { api, ApiError, setPin } from '../lib/api';
import { useSquad } from '../lib/squad';
import { toast, useToasts } from '../lib/toast';
import { cx } from '../lib/ui';
import { Modal } from './primitives';

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-60 flex flex-col items-center gap-2 px-4 xl:bottom-6"
    >
      {toasts.map((t) => {
        const Icon = t.tone === 'success' ? CircleCheck : t.tone === 'error' ? CircleX : Info;
        return (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className="pointer-events-auto flex max-w-md animate-fade-up items-center gap-2.5 rounded-xl border border-line-2 bg-panel-2/95 px-4 py-2.5 text-sm font-medium shadow-2xl shadow-black/50 backdrop-blur"
          >
            <Icon
              size={18}
              className={cx(t.tone === 'success' ? 'text-ok' : t.tone === 'error' ? 'text-accent' : 'text-int')}
            />
            {t.message}
          </button>
        );
      })}
    </div>
  );
}

export function PinDialog() {
  const open = useSquad((s) => s.pinPrompt);
  const setPinPrompt = useSquad((s) => s.setPinPrompt);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const pin = value.trim();
    try {
      await api.checkPin(pin);
      setPin(pin);
      toast.success('Unlocked. You can edit the squad now');
      setPinPrompt(false);
      setValue('');
    } catch (err) {
      toast.error(err instanceof ApiError && (err.status === 401 || err.status === 429) ? err.message : "Couldn't check the PIN");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => setPinPrompt(false)} title="Squad PIN">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <p className="text-sm text-muted">
          This squad is protected. Enter the PIN once on this device to add players and save drafts.
        </p>
        <label className="flex items-center gap-2 rounded-lg border border-line bg-bg/60 px-3 py-2.5 focus-within:border-line-2">
          <KeyRound size={16} className="text-faint" />
          <input
            autoFocus
            type="password"
            autoComplete="current-password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="PIN or passphrase"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </label>
        <button
          disabled={!value.trim() || busy}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </Modal>
  );
}

const SHORTCUTS: [string[], string][] = [
  [['Space'], 'Draft / reroll unlocked cards'],
  [['1', '–', '5'], 'Reroll that card'],
  [['Shift', '1', '–', '5'], 'Lock / unlock that card'],
  [['C'], 'Copy for Discord'],
  [['L'], 'Copy share link'],
  [['S'], 'Save to history'],
  [['Esc'], 'Skip the reveal animation'],
  [['?'], 'Show this help'],
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Shortcuts">
      <ul className="divide-y divide-line">
        {SHORTCUTS.map(([keys, label]) => (
          <li key={label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <span className="text-muted">{label}</span>
            <span className="flex items-center gap-1">
              {keys.map((k, i) => (k === '–' ? <span key={i} className="text-faint">–</span> : <kbd key={i} className="kbd">{k}</kbd>))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
