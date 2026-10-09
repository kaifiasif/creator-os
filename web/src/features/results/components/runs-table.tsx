import { hrefOf } from '@/app/router';
import type { RejectReason } from '@/api/types';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, plural } from '@/lib/format';
import { OUTCOME, REJECT_REASON } from '@/lib/labels';
import { CONDITION, DECISION_KIND } from '@/lib/labels';
import type { RunRow } from '../types';
import { ExportCsvButton } from './export-csv-button';

const decisionText = (row: RunRow) =>
  row.decision === 'reject' && row.reject_reason ? `${DECISION_KIND.reject}: ${REJECT_REASON[row.reject_reason as RejectReason] ?? row.reject_reason}` : DECISION_KIND[row.decision];

const HEADINGS = ['Date', 'Checks', 'Memory', 'First decision', 'Edit ratio', 'Time to decide', 'Flags', 'Overrides', 'Outcome'];

export function RunsTable({ rows }: { rows: RunRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Every run</CardTitle>
        <CardDescription>{plural(rows.length, 'decided run')}. Open one to see the draft and your decision.</CardDescription>
        <CardAction>
          <ExportCsvButton />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                {HEADINGS.map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.run_id}>
                  <TableCell>
                    <a className="font-medium underline-offset-4 hover:underline" href={hrefOf({ name: 'review', id: row.run_id })}>
                      {formatDate(row.created_at)}
                    </a>
                  </TableCell>
                  <TableCell>{CONDITION[row.condition].label}</TableCell>
                  <TableCell>{row.memory_enabled ? 'On' : 'Off'}</TableCell>
                  <TableCell>{decisionText(row)}</TableCell>
                  <TableCell className="tabular-nums">{row.edit_ratio === null ? '' : row.edit_ratio.toFixed(2)}</TableCell>
                  <TableCell className="tabular-nums">{row.time_to_decision_s === null ? '' : `${row.time_to_decision_s} s`}</TableCell>
                  <TableCell className="tabular-nums">{row.flags_shown}</TableCell>
                  <TableCell className="tabular-nums">{row.overrides}</TableCell>
                  <TableCell>{OUTCOME[row.outcome] ?? row.outcome}</TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={HEADINGS.length} className="h-20 text-center text-muted-foreground">
                    No decided runs yet. Decide on a draft and it shows up here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
