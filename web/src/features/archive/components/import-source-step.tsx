import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { formatBytes } from '@/lib/format';
import { IMPORT_FORMAT } from '@/lib/labels';
import type { ImportFormat } from '../types';
import type { ImportFlow } from '../use-import-flow';

const FORMATS = Object.keys(IMPORT_FORMAT) as ImportFormat[];
const ACCEPT: Record<ImportFormat, string> = { x_export: '.js,.json', csv: '.csv,.txt', paste: '' };

export function ImportSourceStep({ flow }: { flow: ImportFlow }) {
  return (
    <div className="grid gap-6">
      <RadioGroup value={flow.format} onValueChange={(v) => flow.setFormat(v as ImportFormat)} className="grid gap-2 sm:grid-cols-3" aria-label="Import format">
        {FORMATS.map((format) => (
          <FieldLabel key={format} htmlFor={`format-${format}`}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{IMPORT_FORMAT[format].title}</FieldTitle>
                <FieldDescription className="text-xs">{IMPORT_FORMAT[format].description}</FieldDescription>
              </FieldContent>
              <RadioGroupItem value={format} id={`format-${format}`} />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>

      {flow.format === 'paste' ? (
        <Field>
          <FieldLabel htmlFor="import-paste">Your posts</FieldLabel>
          <Textarea
            id="import-paste"
            value={flow.pasted}
            onChange={(e) => flow.setPasted(e.target.value)}
            className="max-h-64 min-h-40"
            placeholder={'First post.\n\nSecond post, after a blank line.'}
          />
        </Field>
      ) : (
        <Field>
          <FieldLabel htmlFor="import-file">{flow.format === 'x_export' ? 'tweets.js file' : 'CSV file'}</FieldLabel>
          <Input id="import-file" type="file" accept={ACCEPT[flow.format]} onChange={(e) => flow.setFile(e.target.files?.[0] ?? null)} />
          <FieldDescription>
            {flow.file ? `${flow.file.name}, ${formatBytes(flow.file.size)}` : 'You will see every row before anything is saved.'}
          </FieldDescription>
        </Field>
      )}
    </div>
  );
}
