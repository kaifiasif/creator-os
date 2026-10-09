import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { DraftFormat } from '@/api/types';
import { DRAFT_FORMAT } from '@/lib/labels';

export function DraftOptions({ format, onFormat, memory, onMemory }: { format: DraftFormat; onFormat: (f: DraftFormat) => void; memory: boolean; onMemory: (on: boolean) => void }) {
  return (
    <div className="grid gap-4">
      <Field>
        <FieldLabel id="draft-format-label">Format</FieldLabel>
        <ToggleGroup type="single" variant="outline" value={format} onValueChange={(v) => v && onFormat(v as DraftFormat)} aria-labelledby="draft-format-label" className="w-fit">
          {(Object.keys(DRAFT_FORMAT) as DraftFormat[]).map((f) => (
            <ToggleGroupItem key={f} value={f} className="px-4">
              {DRAFT_FORMAT[f]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      <Field orientation="horizontal">
        <Switch id="draft-memory" checked={memory} onCheckedChange={onMemory} />
        <FieldContent>
          <FieldLabel htmlFor="draft-memory">Check against what you have posted</FieldLabel>
          <FieldDescription>Flags sentences that repeat your archive or an angle you retired.</FieldDescription>
        </FieldContent>
      </Field>
    </div>
  );
}
