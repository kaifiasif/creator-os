import type { ReactNode } from 'react';
import { Page } from '@/components/shared/page';
import { SiteHeader, type Crumb } from './site-header';

/** One screen: its breadcrumb header and its body. Every page renders exactly one. */
export function Screen({ crumbs, actions, children, bare = false }: { crumbs: Crumb[]; actions?: ReactNode; children: ReactNode; bare?: boolean }) {
  return (
    <>
      <SiteHeader crumbs={crumbs} actions={actions} />
      {bare ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : <Page>{children}</Page>}
    </>
  );
}
