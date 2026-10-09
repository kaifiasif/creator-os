import type { SourceKind } from '@/api/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SOURCE_KIND } from '@/lib/labels';
import { cn } from '@/lib/utils';

const KINDS = Object.keys(SOURCE_KIND) as SourceKind[];

export function KindSelect({ id, value, onChange, disabled, className }: { id: string; value: SourceKind; onChange: (kind: SourceKind) => void; disabled?: boolean; className?: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SourceKind)} disabled={disabled}>
      <SelectTrigger id={id} className={cn('w-36', className)} aria-label="Kind">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {KINDS.map((kind) => (
          <SelectItem key={kind} value={kind}>
            {SOURCE_KIND[kind]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Required for calls: the server refuses a call without it. */
export function ConsentField({ id, checked, onChange, disabled }: { id: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <Field orientation="horizontal" data-disabled={disabled}>
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} disabled={disabled} aria-required />
      <FieldContent>
        <FieldLabel htmlFor={id} className="font-normal">
          Everyone on this call agreed to be recorded and processed
        </FieldLabel>
        <FieldDescription className="text-xs">Required for calls. The recording is sent to third-party services for transcription.</FieldDescription>
      </FieldContent>
    </Field>
  );
}
