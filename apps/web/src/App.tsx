import { decodeDraft } from '@dota-picker/core';
import { useCallback, useEffect, useState } from 'react';
import { Header } from './components/Header';
import { PinDialog, ShortcutsDialog, Toaster } from './components/Overlays';
import { openDraft } from './lib/actions';
import { warmReel } from './lib/reel';
import { useRoute } from './lib/router';
import { useSquad } from './lib/squad';
import { toast } from './lib/toast';
import { newId } from './lib/ui';
import { DraftPage } from './pages/DraftPage';
import { HistoryPage } from './pages/HistoryPage';
import { SquadPage } from './pages/SquadPage';

function openSharedDraftFromUrl() {
  const code = new URLSearchParams(location.search).get('d');
  if (!code) return;
  const draft = decodeDraft(code);
  if (draft) openDraft({ ...draft, id: newId(), createdAt: Date.now() }, { shared: true });
  else toast.error('That share link looks broken');
}

export function App() {
  const route = useRoute();
  const [help, setHelp] = useState(false);
  const openHelp = useCallback(() => setHelp(true), []);

  useEffect(() => {
    void useSquad.getState().init();
    openSharedDraftFromUrl();
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 400));
    idle(() => warmReel());
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header route={route} onShortcuts={openHelp} />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-32 sm:px-6 xl:pb-12">
        {route === 'draft' && <DraftPage onHelp={openHelp} />}
        {route === 'squad' && <SquadPage />}
        {route === 'history' && <HistoryPage />}
      </main>
      <Toaster />
      <PinDialog />
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
