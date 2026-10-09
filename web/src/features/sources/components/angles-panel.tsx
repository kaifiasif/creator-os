import type { UseQueryResult } from '@tanstack/react-query';
import { PenLineIcon } from 'lucide-react';
import { useState } from 'react';
import type { Angle, Claim } from '@/api/types';
import { ErrorAlert } from '@/components/shared/query-view';
import { Button } from '@/components/ui/button';
import { RadioGroup } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useHotkey } from '@/hooks/use-hotkey';
import { AngleCard } from './angle-card';
import { CUSTOM, CustomAngleFields, CustomAngleOption, type CustomAngleValue } from './custom-angle';
import type { DraftFormat } from '@/api/types';
import { DraftOptions } from './draft-options';
import { useDraftAngle } from './use-draft-angle';

interface AnglesPanelProps {
  sourceId: string;
  angles: UseQueryResult<Angle[]>;
  /** The creator's own claims that are still usable as a lead. */
  leadClaims: Claim[];
  selection: string | null;
  onSelect: (selection: string) => void;
  custom: CustomAngleValue;
  onCustom: (value: CustomAngleValue) => void;
}

function AnglesSkeleton() {
  return (
    <div className="grid gap-3" aria-label="Loading angles">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-36 rounded-md" />
      ))}
    </div>
  );
}

/** Up to three proposed angles plus a custom one, then the draft options and the action. */
export function AnglesPanel({ sourceId, angles, leadClaims, selection, onSelect, custom, onCustom }: AnglesPanelProps) {
  const [format, setFormat] = useState<DraftFormat>('thread');
  const [memory, setMemory] = useState(true);
  const { draft, pending } = useDraftAngle();
  const list = angles.data ?? [];

  const pickNth = (n: number) => () => {
    const angle = list[n - 1];
    if (angle) onSelect(angle.id);
  };
  useHotkey('1', pickNth(1), { enabled: list.length >= 1 });
  useHotkey('2', pickNth(2), { enabled: list.length >= 2 });
  useHotkey('3', pickNth(3), { enabled: list.length >= 3 });

  const picked = list.find((a) => a.id === selection);
  const isCustom = selection === CUSTOM;
  const ready = Boolean(picked) || (isCustom && Boolean(custom.leadClaimId) && Boolean(custom.text.trim()));

  const submit = () => {
    const base = { source_item_id: sourceId, format, memory_enabled: memory };
    if (picked) draft({ ...base, angle_claim_ids: picked.claim_ids, angle_choice: 'picked' });
    else if (isCustom) draft({ ...base, angle_claim_ids: [custom.leadClaimId], angle_choice: 'custom', custom_angle: custom.text.trim() });
  };

  if (angles.isPending) return <AnglesSkeleton />;
  if (angles.isError) return <ErrorAlert error={angles.error} title="Angles could not load" onRetry={() => void angles.refetch()} />;

  return (
    <div className="grid gap-5">
      <p className="text-sm text-muted-foreground">
        {list.length
          ? 'Pick what leads. Each option shows the closest thing you have already posted. Press 1 to 3 to pick.'
          : 'No angles could be proposed for this source. Write your own instead.'}
      </p>
      <RadioGroup value={selection ?? ''} onValueChange={onSelect} aria-label="Angle to draft">
        {list.map((angle, i) => (
          <AngleCard key={angle.id} angle={angle} index={i} />
        ))}
        {leadClaims.length > 0 && <CustomAngleOption />}
      </RadioGroup>
      {isCustom && <CustomAngleFields claims={leadClaims} value={custom} onChange={onCustom} />}
      <DraftOptions format={format} onFormat={setFormat} memory={memory} onMemory={setMemory} />
      <Button onClick={submit} disabled={!ready || pending} className="w-full sm:w-fit">
        {pending ? <Spinner /> : <PenLineIcon />} Draft this angle
      </Button>
    </div>
  );
}
