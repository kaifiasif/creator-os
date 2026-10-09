import type { ReactNode } from 'react';
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

/** The dashboard's headline number: a label, the value, an optional badge and a one-line footnote. */
export function StatCard({ label, value, badge, footnote }: { label: string; value: ReactNode; badge?: ReactNode; footnote?: ReactNode }) {
  return (
    <Card className="@container/card gap-4 bg-gradient-to-t from-primary/5 to-card shadow-xs dark:bg-card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
        {badge && <CardAction>{badge}</CardAction>}
      </CardHeader>
      {footnote && <CardFooter className="text-sm text-muted-foreground">{footnote}</CardFooter>}
    </Card>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">{children}</div>;
}
