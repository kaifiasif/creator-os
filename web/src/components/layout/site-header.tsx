import { MoonIcon, SearchIcon, SunIcon } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { openOverlay } from '@/app/ui-state';
import { useTheme } from '@/app/theme';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

export interface Crumb {
  label: string;
  href?: string;
}

export function SiteHeader({ crumbs, actions }: { crumbs: Crumb[]; actions?: ReactNode }) {
  const { resolved, setTheme } = useTheme();
  return (
    <header className="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {crumbs.map((crumb, i) => (
              <Fragment key={`${crumb.label}-${i}`}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem className="min-w-0">
                  {crumb.href && i < crumbs.length - 1 ? (
                    <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-2">
          {actions}
          <Button variant="outline" size="sm" className="hidden w-56 justify-between text-muted-foreground sm:flex" onClick={() => openOverlay('command')}>
            <span className="flex items-center gap-2">
              <SearchIcon /> Search
            </span>
            <Kbd>⌘K</Kbd>
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')} aria-label="Toggle dark mode">
            {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
          </Button>
        </div>
      </div>
    </header>
  );
}
