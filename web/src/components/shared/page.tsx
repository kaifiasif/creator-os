import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The body of every screen: consistent padding, a container query for responsive grids, and the short staggered entrance. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('@container/main motion-enter flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6', className)}>{children}</div>;
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
