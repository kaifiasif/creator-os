import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RECOMMENDATION } from '@/lib/labels';

const KINDS = ['accept', 'edit', 'reject'] as const;

/** Rows are what the agent predicted, columns what you decided first. The diagonal is agreement. */
export function ConfusionTable({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead>Predicted</TableHead>
            {KINDS.map((k) => (
              <TableHead key={k} className="text-right">
                You: {RECOMMENDATION[k]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {KINDS.map((predicted) => (
            <TableRow key={predicted}>
              <TableCell className="font-medium">{RECOMMENDATION[predicted]}</TableCell>
              {KINDS.map((actual) => (
                <TableCell key={actual} className={predicted === actual ? 'text-right font-semibold tabular-nums' : 'text-right text-muted-foreground tabular-nums'}>
                  {counts[`${predicted}->${actual}`] ?? 0}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
