import type { Claim } from '@/api/types';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field';
import { RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export const CUSTOM = 'custom';
export const CUSTOM_MAX = 500;

export interface CustomAngleValue {
  leadClaimId: string;
  text: string;
}

export function CustomAngleOption() {
  return (
    <FieldLabel htmlFor="angle-custom">
      <Field orientation="horizontal" className="items-start">
        <FieldContent>
          <FieldTitle>Write your own angle</FieldTitle>
          <FieldDescription>Pick the claim that leads and say how to frame it.</FieldDescription>
        </FieldContent>
        <RadioGroupItem value={CUSTOM} id="angle-custom" aria-label="Write your own angle" />
      </Field>
    </FieldLabel>
  );
}

/** Shown once the custom option is selected. */
export function CustomAngleFields({ claims, value, onChange }: { claims: Claim[]; value: CustomAngleValue; onChange: (value: CustomAngleValue) => void }) {
  return (
    <div className="grid gap-3 rounded-md border p-4">
      <Field>
        <FieldLabel htmlFor="custom-lead">Lead claim</FieldLabel>
        <Select value={value.leadClaimId} onValueChange={(leadClaimId) => onChange({ ...value, leadClaimId })}>
          <SelectTrigger id="custom-lead" className="w-full [&>span]:truncate">
            <SelectValue placeholder="Choose a claim" />
          </SelectTrigger>
          <SelectContent className="max-w-[min(36rem,90vw)]">
            {claims.map((claim) => (
              <SelectItem key={claim.id} value={claim.id}>
                <span className="truncate">{claim.text}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="custom-text">How to frame it</FieldLabel>
        <Textarea
          id="custom-text"
          value={value.text}
          maxLength={CUSTOM_MAX}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          placeholder="For example, lead with the cost of fluent but wrong sentences, end on the fix."
          className="min-h-20"
        />
        <FieldDescription>
          {value.text.length} of {CUSTOM_MAX} characters
        </FieldDescription>
      </Field>
    </div>
  );
}
