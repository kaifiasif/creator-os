import { BubbleMenu } from '@/components/shared/motion/bubble-menu';
import { lazy, Suspense, type CSSProperties } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { CaptureSheet } from '@/features/sources/capture/capture-sheet';
import { InboxPage } from '@/features/sources/inbox-page';
import { NotFoundPage } from '@/components/layout/not-found-page';
import { startLeader, useHotkey } from '@/hooks/use-hotkey';
import { CommandMenu } from './command-menu';
import { navigate, useRoute, type Route } from './router';
import { ShortcutsDialog } from './shortcuts-dialog';
import { closeOverlay, openOverlay, useOverlay } from './ui-state';

// The inbox is the landing screen, so it ships in the main bundle; every other screen loads on first visit.
const SourcePage = lazy(() => import('@/features/sources/source-page').then((m) => ({ default: m.SourcePage })));
const DraftsPage = lazy(() => import('@/features/drafts/drafts-page').then((m) => ({ default: m.DraftsPage })));
const ReviewPage = lazy(() => import('@/features/review/review-page').then((m) => ({ default: m.ReviewPage })));
const ArchivePage = lazy(() => import('@/features/archive/archive-page').then((m) => ({ default: m.ArchivePage })));
const ResultsPage = lazy(() => import('@/features/results/results-page').then((m) => ({ default: m.ResultsPage })));
const SettingsPage = lazy(() => import('@/features/settings/settings-page').then((m) => ({ default: m.SettingsPage })));

function CurrentScreen({ route }: { route: Route }) {
  switch (route.name) {
    case 'inbox':
      return <InboxPage />;
    case 'source':
      return <SourcePage id={route.id} key={route.id} />;
    case 'drafts':
      return <DraftsPage />;
    case 'review':
      return <ReviewPage id={route.id} key={route.id} />;
    case 'archive':
      return <ArchivePage />;
    case 'results':
      return <ResultsPage />;
    case 'settings':
      return <SettingsPage />;
    case 'missing':
      return <NotFoundPage />;
  }
}

/** ⌘K, C, ?, and the two-key "G then I/D/A/R" jumps. */
function useGlobalShortcuts() {
  useHotkey('k', (e) => {
    e.preventDefault();
    openOverlay('command');
  }, { mod: true });
  useHotkey('c', () => openOverlay('capture'));
  useHotkey('?', () => openOverlay('shortcuts'));
  useHotkey('g', startLeader);
  useHotkey('i', () => navigate({ name: 'inbox' }), { leader: true });
  useHotkey('d', () => navigate({ name: 'drafts' }), { leader: true });
  useHotkey('a', () => navigate({ name: 'archive' }), { leader: true });
  useHotkey('r', () => navigate({ name: 'results' }), { leader: true });
}

export function App() {
  const route = useRoute();
  const overlay = useOverlay();
  useGlobalShortcuts();
  const toggle = (name: NonNullable<typeof overlay>) => (open: boolean) => (open ? openOverlay(name) : closeOverlay());

  return (
    <SidebarProvider style={{ '--sidebar-width': 'calc(var(--spacing) * 64)', '--header-height': 'calc(var(--spacing) * 12)' } as CSSProperties}>
      <AppSidebar variant="inset" active={route.name} />
      <SidebarInset className="min-w-0">
        <Suspense fallback={null}>
          <CurrentScreen route={route} />
        </Suspense>
      </SidebarInset>
      <CaptureSheet open={overlay === 'capture'} onOpenChange={toggle('capture')} />
      <CommandMenu open={overlay === 'command'} onOpenChange={toggle('command')} />
      <ShortcutsDialog open={overlay === 'shortcuts'} onOpenChange={toggle('shortcuts')} />
      <BubbleMenu />
    </SidebarProvider>
  );
}
