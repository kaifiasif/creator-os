import { ArchiveIcon, ChartColumnIcon, FileTextIcon, InboxIcon, PlusIcon, SettingsIcon } from 'lucide-react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { useRuns } from '@/features/drafts/api';
import { useSources } from '@/features/sources/api';
import { RUN_STATUS, SOURCE_STATUS } from '@/lib/labels';
import { navigate, type Route } from './router';
import { openOverlay } from './ui-state';

const PAGES: { label: string; route: Route; icon: typeof InboxIcon }[] = [
  { label: 'Inbox', route: { name: 'inbox' }, icon: InboxIcon },
  { label: 'Drafts', route: { name: 'drafts' }, icon: FileTextIcon },
  { label: 'Archive', route: { name: 'archive' }, icon: ArchiveIcon },
  { label: 'Results', route: { name: 'results' }, icon: ChartColumnIcon },
  { label: 'Settings', route: { name: 'settings' }, icon: SettingsIcon },
];

export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const sources = useSources();
  const runs = useRuns();
  const go = (route: Route) => {
    onOpenChange(false);
    navigate(route);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search Creator OS" description="Jump to a page, a source or a draft">
      <CommandInput placeholder="Search sources, drafts and pages" />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => openOverlay('capture')}>
            <PlusIcon /> New capture
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Pages">
          {PAGES.map((page) => (
            <CommandItem key={page.label} onSelect={() => go(page.route)}>
              <page.icon /> {page.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {Boolean(sources.data?.length) && <CommandSeparator />}
        {Boolean(sources.data?.length) && (
          <CommandGroup heading="Sources">
            {sources.data?.slice(0, 20).map((s) => (
              <CommandItem key={s.id} value={`source ${s.title} ${s.id}`} onSelect={() => go({ name: 'source', id: s.id })}>
                <InboxIcon />
                <span className="truncate">{s.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">{SOURCE_STATUS[s.status].label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {Boolean(runs.data?.length) && (
          <CommandGroup heading="Drafts">
            {runs.data?.slice(0, 20).map((r) => (
              <CommandItem key={r.id} value={`draft ${r.source_title} ${r.id}`} onSelect={() => go({ name: 'review', id: r.id })}>
                <FileTextIcon />
                <span className="truncate">{r.source_title}</span>
                <span className="ml-auto text-xs text-muted-foreground">{RUN_STATUS[r.status].label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
