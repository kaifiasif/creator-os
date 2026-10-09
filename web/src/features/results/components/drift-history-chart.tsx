import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { DriftPoint } from '../types';

const config = {
  homogeneity_ratio: { label: 'Your outputs', color: 'var(--chart-2)' },
  archive_p90: { label: 'Archive 90th percentile', color: 'var(--chart-5)' },
} satisfies ChartConfig;

export function DriftHistoryChart({ history }: { history: DriftPoint[] }) {
  const data = [...history].reverse().map((h) => ({ ...h, week: h.week.replace(/^\d{4}-W/, 'Week ') }));
  return (
    <ChartContainer config={config} className="aspect-auto h-40 w-full">
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={52} domain={[0, 'auto']} tickFormatter={(v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(2))} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Line dataKey="homogeneity_ratio" stroke="var(--color-homogeneity_ratio)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        <Line dataKey="archive_p90" stroke="var(--color-archive_p90)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  );
}
