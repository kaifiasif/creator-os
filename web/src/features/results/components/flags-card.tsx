import type { AcceptanceOpen } from '@/api/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PROBLEM } from '@/lib/labels';
import { MetricList } from './metric-list';

export function FlagsCard({ flags }: { flags: AcceptanceOpen['flags'] }) {
  return (
    <Card className="@3xl/main:col-span-2">
      <CardHeader>
        <CardTitle>Flags</CardTitle>
        <CardDescription>Sentences the checks stopped on drafts with checks shown, and what you did about them.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <MetricList
          rows={[
            { label: 'Shown', value: flags.shown },
            { label: 'Led to an edit', value: flags.led_to_edit },
            { label: 'Overridden', value: flags.overridden },
          ]}
        />
        <div className="grid gap-2">
          <h3 className="text-sm font-medium">Override log</h3>
          {flags.override_log.length ? (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>Sentence</TableHead>
                    <TableHead>Your reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flags.override_log.map((o, i) => (
                    <TableRow key={`${o.run_id}-${i}`}>
                      <TableCell className="max-w-0 align-top whitespace-normal">
                        <p className="line-clamp-3">{o.sentence}</p>
                        {o.flag && <p className="mt-1 text-xs text-muted-foreground">{PROBLEM[o.flag]?.label ?? o.flag}</p>}
                      </TableCell>
                      <TableCell className="max-w-0 align-top whitespace-normal text-muted-foreground">{o.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No flags overridden yet. Each one you keep shows up here with your reason.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
