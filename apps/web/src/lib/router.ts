import { useSyncExternalStore } from 'react';

export type Route = 'draft' | 'squad' | 'history';

const PATHS: Record<Route, string> = { draft: '/', squad: '/squad', history: '/history' };

const toRoute = (path: string): Route =>
  path.startsWith('/squad') ? 'squad' : path.startsWith('/history') ? 'history' : 'draft';

const subscribe = (notify: () => void) => {
  window.addEventListener('popstate', notify);
  return () => window.removeEventListener('popstate', notify);
};

export function navigate(route: Route): void {
  if (toRoute(location.pathname) === route && !location.search) return;
  history.pushState(null, '', PATHS[route]);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0 });
}

export function useRoute(): Route {
  return toRoute(useSyncExternalStore(subscribe, () => location.pathname));
}
