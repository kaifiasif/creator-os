import { GaugeIcon } from 'lucide-react';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { plural } from '@/lib/format';
import type { FittedThreshold } from '../use-calibration-session';

export function CalibrationResult({ fitted }: { fitted: FittedThreshold | null }) {
  return (
    <Item variant="muted">
      <ItemMedia variant="icon">
        <GaugeIcon />
      </ItemMedia>
      <ItemContent>
        {fitted ? (
          <>
            <ItemTitle>
              Fitted threshold <span className="tabular-nums">{fitted.threshold.toFixed(2)}</span>
            </ItemTitle>
            <ItemDescription>
              F1 score <span className="tabular-nums">{fitted.f1.toFixed(2)}</span> against {plural(fitted.n, 'labelled pair')}. Closer to 1 means the check agrees with you more often.
            </ItemDescription>
          </>
        ) : (
          <>
            <ItemTitle>Using the default threshold</ItemTitle>
            <ItemDescription>Label at least one pair as the same angle and one as different, then fit the threshold.</ItemDescription>
          </>
        )}
      </ItemContent>
    </Item>
  );
}
