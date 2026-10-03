import { useEffect } from 'react';
import { Board, displayOrder, SkipHint } from '../components/Board';
import { DraftButton, roll } from '../components/DraftButton';
import { ModePanel } from '../components/ModePanel';
import { RulesPanel } from '../components/RulesPanel';
import { StackPanel } from '../components/StackPanel';
import { copyForDiscord, rerollOne, saveCurrentDraft, shareDraft, toggleLock } from '../lib/actions';
import { useDraftStore } from '../lib/draftStore';

function useDraftHotkeys(onHelp: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) {
        // Esc leaves the text box so the shortcuts work again.
        if (e.key === 'Escape') target.blur();
        return;
      }
      if (document.querySelector('[data-modal]')) return;

      if (e.code === 'Space') {
        e.preventDefault();
        roll();
        return;
      }
      const digit = /^Digit([1-5])$/.exec(e.code)?.[1];
      if (digit) {
        const draft = useDraftStore.getState().draft;
        const index = draft ? displayOrder(draft)[Number(digit) - 1] : undefined;
        if (index !== undefined) {
          e.preventDefault();
          if (e.shiftKey) toggleLock(index);
          else rerollOne(index);
        }
        return;
      }
      switch (e.key) {
        case 'c':
        case 'C':
          void copyForDiscord();
          break;
        case 'l':
        case 'L':
          void shareDraft();
          break;
        case 's':
        case 'S':
          void saveCurrentDraft();
          break;
        case 'Escape':
          useDraftStore.getState().skipReveal();
          break;
        case '?':
          onHelp();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onHelp]);
}

export function DraftPage({ onHelp }: { onHelp: () => void }) {
  useDraftHotkeys(onHelp);
  // Coming back to this page shouldn't replay the last reveal.
  useEffect(() => () => useDraftStore.getState().skipReveal(), []);

  return (
    <div className="grid gap-5 pt-5 xl:grid-cols-[380px_minmax(0,1fr)] xl:gap-6 xl:pt-6">
      {/* On desktop the panels scroll and the draft button stays pinned underneath them. */}
      <aside className="xl:sticky xl:top-22 xl:flex xl:max-h-[calc(100dvh-104px)] xl:flex-col xl:self-start">
        <div className="scrollbar-thin space-y-3 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
          <StackPanel />
          <ModePanel />
          <RulesPanel />
        </div>
        <DraftButton className="mt-3 hidden shrink-0 xl:flex" />
      </aside>

      <section id="board" className="min-w-0 scroll-mt-20" aria-label="Draft result">
        <Board />
        <div className="mt-3 flex justify-end">
          <SkipHint />
        </div>
      </section>

      {/* Thumb-reachable draft button on phones and tablets. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/85 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md xl:hidden">
        <DraftButton />
      </div>
    </div>
  );
}
