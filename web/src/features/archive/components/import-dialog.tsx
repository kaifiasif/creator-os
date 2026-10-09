import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { plural } from '@/lib/format';
import { useImportFlow, type ImportFlow } from '../use-import-flow';
import { ImportPreviewStep } from './import-preview-step';
import { ImportResultStep } from './import-result-step';
import { ImportSourceStep } from './import-source-step';

const DESCRIPTION = {
  source: 'Pick where your posts come from. You will check every row before anything is saved.',
  preview: 'New posts are ticked. Untick anything that does not represent how you write today.',
  done: 'Drafts are now checked against these posts for repeats and voice.',
};

function RepliesSwitch({ flow }: { flow: ImportFlow }) {
  return (
    <div className="flex items-center gap-2">
      <Switch id="include-replies" checked={flow.includeReplies} onCheckedChange={flow.changeReplies} disabled={flow.previewing} />
      <Label htmlFor="include-replies" className="font-normal">
        Include replies
      </Label>
    </div>
  );
}

function Footer({ flow, onClose }: { flow: ImportFlow; onClose: () => void }) {
  if (flow.step === 'done') return <Button onClick={onClose}>Done</Button>;
  if (flow.step === 'source') {
    return (
      <>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => void flow.runPreview()} disabled={!flow.hasInput || flow.previewing}>
          {flow.previewing && <Spinner />} Preview posts
        </Button>
      </>
    );
  }
  const count = flow.selected.size;
  return (
    <>
      <Button variant="outline" onClick={flow.back} disabled={flow.importing}>
        Back
      </Button>
      <Button onClick={flow.runImport} disabled={!count || flow.importing || flow.previewing}>
        {flow.importing && <Spinner />} Import {plural(count, 'post')}
      </Button>
    </>
  );
}

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const flow = useImportFlow();
  const close = () => {
    onOpenChange(false);
    flow.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import posts</DialogTitle>
          <DialogDescription>{DESCRIPTION[flow.step]}</DialogDescription>
        </DialogHeader>
        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">
          {flow.step === 'source' && <ImportSourceStep flow={flow} />}
          {flow.step === 'preview' && flow.preview && <ImportPreviewStep key={flow.preview.counts.rows} flow={flow} preview={flow.preview} />}
          {flow.step === 'done' && flow.result && <ImportResultStep result={flow.result} />}
        </div>
        <DialogFooter className="items-center gap-3 sm:justify-between">
          {flow.step !== 'done' ? <RepliesSwitch flow={flow} /> : <span />}
          <div className="flex justify-end gap-2">
            <Footer flow={flow} onClose={close} />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
