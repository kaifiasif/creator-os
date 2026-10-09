import { useSyncExternalStore } from 'react';

/** Hash routes keep the server's SPA fallback trivial and every screen deep-linkable. */
export type Route =
  | { name: 'inbox' }
  | { name: 'source'; id: string }
  | { name: 'drafts' }
  | { name: 'review'; id: string }
  | { name: 'archive' }
  | { name: 'results' }
  | { name: 'settings' }
  | { name: 'missing' };

const PATTERNS: [RegExp, (m: RegExpMatchArray) => Route][] = [
  [/^\/sources\/([\w-]+)$/, (m) => ({ name: 'source', id: m[1] })],
  [/^\/drafts\/([\w-]+)$/, (m) => ({ name: 'review', id: m[1] })],
  [/^\/drafts$/, () => ({ name: 'drafts' })],
  [/^\/archive$/, () => ({ name: 'archive' })],
  [/^\/results$/, () => ({ name: 'results' })],
  [/^\/settings$/, () => ({ name: 'settings' })],
  [/^\/?$/, () => ({ name: 'inbox' })],
];

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  for (const [pattern, build] of PATTERNS) {
    const match = path.match(pattern);
    if (match) return build(match);
  }
  return { name: 'missing' };
}

export function pathOf(route: Route): string {
  switch (route.name) {
    case 'inbox':
      return '/';
    case 'source':
      return `/sources/${route.id}`;
    case 'drafts':
      return '/drafts';
    case 'review':
      return `/drafts/${route.id}`;
    default:
      return `/${route.name}`;
  }
}

export const hrefOf = (route: Route) => `#${pathOf(route)}`;
export const navigate = (route: Route) => {
  location.hash = pathOf(route);
};

const subscribe = (onChange: () => void) => {
  addEventListener('hashchange', onChange);
  return () => removeEventListener('hashchange', onChange);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  return parseRoute(hash);
}
