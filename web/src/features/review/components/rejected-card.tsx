import { PencilIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { REJECT_REASON } from '@/lib/labels';
import type { Decision } from '../lib/types';

export function RejectedCard({ decision, onFix }: { decision: Decision; onFix?: () => void }) {
  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>Rejected</CardTitle>
        <CardDescription className="grid gap-1">
          {decision.reject_reason && <span className="text-foreground">{REJECT_REASON[decision.reject_reason]}.</span>}
          {decision.reject_note && <span>{decision.reject_note}</span>}
          {onFix && <span>You can still fix it and accept your version.</span>}
        </CardDescription>
        {onFix && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={onFix}>
              <PencilIcon /> Fix it anyway
            </Button>
          </CardAction>
        )}
      </CardHeader>
    </Card>
  );
}
