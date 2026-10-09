import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { AcceptanceOpen } from '@/api/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { CONDITION } from '@/lib/labels';
import { toPercent } from '../format-rate';

const config = {
  gate: { label: CONDITION.gate.label, color: 'var(--chart-3)' },
  context_only: { label: CONDITION.context_only.label, color: 'var(--chart-1)' },
} satisfies ChartConfig;

const percentRow = (value: unknown, name: unknown) => (
  <div className="flex w-full items-center justify-between gap-4">
    <span className="text-muted-foreground">{config[name as keyof typeof config]?.label ?? String(name)}</span>
    <span className="font-mono font-medium tabular-nums">{String(value)}%</span>
  </div>
);

export function AcceptanceChart({ weeks }: { weeks: AcceptanceOpen['by_week'] }) {
  const data = weeks.map((w) => ({ week: w.week.replace(/^\d{4}-W/, 'Week '), gate: toPercent(w.gate), context_only: toPercent(w.context_only) }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Acceptance by week</CardTitle>
        <CardDescription>Share of drafts you accepted with a light edit, with checks shown and without.</CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {data.length ? (
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} width={48} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={percentRow} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="gate" fill="var(--color-gate)" radius={4} maxBarSize={48} isAnimationActive={false} />
              <Bar dataKey="context_only" fill="var(--color-context_only)" radius={4} maxBarSize={48} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">The chart fills in once you decide on drafts.</p>
        )}
      </CardContent>
    </Card>
  );
}
