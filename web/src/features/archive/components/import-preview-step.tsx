import type { ArchivePreview } from '@/api/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ImportFlow } from '../use-import-flow';
import { ExcludedRowsTable } from './excluded-rows-table';
import { PreviewCounts } from './preview-counts';
import { PreviewRowsTable } from './preview-rows-table';

export function ImportPreviewStep({ flow, preview }: { flow: ImportFlow; preview: ArchivePreview }) {
  return (
    <div className="grid gap-4">
      <PreviewCounts counts={preview.counts} />
      <Tabs defaultValue="rows">
        <TabsList>
          <TabsTrigger value="rows">Posts {preview.counts.rows}</TabsTrigger>
          <TabsTrigger value="excluded">Left out {preview.counts.excluded}</TabsTrigger>
        </TabsList>
        <TabsContent value="rows">
          <PreviewRowsTable rows={preview.rows} selected={flow.selected} onToggle={flow.toggle} onToggleMany={flow.setMany} />
        </TabsContent>
        <TabsContent value="excluded">
          <ExcludedRowsTable rows={preview.excluded} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
