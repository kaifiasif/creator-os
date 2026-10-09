import { ArchiveIcon, BookOpenIcon, ChartColumnIcon, FileTextIcon, InboxIcon, KeyboardIcon, PlusIcon, SettingsIcon, type LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { hrefOf, type Route } from '@/app/router';
import { openOverlay } from '@/app/ui-state';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { LogoMark } from '@/components/shared/logo-mark';
import { NavUser } from './nav-user';
import { useRuns } from '@/features/drafts/api';
import { useConfig } from '@/features/settings/api';

interface NavItem {
  title: string;
  route: Route;
  icon: LucideIcon;
  /** Which routes highlight this item. */
  matches: Route['name'][];
}

const NAV: NavItem[] = [
  { title: 'Inbox', route: { name: 'inbox' }, icon: InboxIcon, matches: ['inbox', 'source'] },
  { title: 'Drafts', route: { name: 'drafts' }, icon: FileTextIcon, matches: ['drafts', 'review'] },
  { title: 'Archive', route: { name: 'archive' }, icon: ArchiveIcon, matches: ['archive'] },
  { title: 'Results', route: { name: 'results' }, icon: ChartColumnIcon, matches: ['results'] },
];

const draftingLabel = (llm: string) => {
  if (llm === 'local') return 'Drafting with local rules';
  if (llm === 'anthropic') return 'Drafting with Claude';
  return llm.includes('groq') ? 'Drafting with Groq' : `Drafting with ${llm}`;
};

export function AppSidebar({ active, ...props }: ComponentProps<typeof Sidebar> & { active: Route['name'] }) {
  const runs = useRuns();
  const config = useConfig();
  const waiting = runs.data?.filter((r) => r.status === 'in_review').length ?? 0;

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="data-[slot=sidebar-menu-button]:p-1.5!">
              <a href={hrefOf({ name: 'inbox' })}>
                <LogoMark />
                <div className="grid leading-tight">
                  <span className="text-sm font-semibold">Creator OS</span>
                  <span className="text-xs text-muted-foreground">Your words, checked</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="New capture"
                  onClick={() => openOverlay('capture')}
                  className="bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                >
                  <PlusIcon />
                  <span>New capture</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={item.matches.includes(active)}>
                    <a href={hrefOf(item.route)}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                  {item.title === 'Drafts' && waiting > 0 && <SidebarMenuBadge>{waiting}</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild size="sm" isActive={active === 'settings'}>
                  <a href={hrefOf({ name: 'settings' })}>
                    <SettingsIcon />
                    <span>Settings</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton size="sm" onClick={() => openOverlay('shortcuts')}>
                  <KeyboardIcon />
                  <span>Keyboard shortcuts</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild size="sm">
                  <a href="/openapi.yaml" target="_blank" rel="noreferrer">
                    <BookOpenIcon />
                    <span>API reference</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
        <div className="rounded-md border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          {config.data ? (
            <>
              <div className="font-medium text-foreground">{draftingLabel(config.data.llm)}</div>
              <div>{config.data.audio_supported ? 'Audio transcription is on' : 'Text sources only for now'}</div>
            </>
          ) : (
            'Connecting…'
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
