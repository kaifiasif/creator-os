import { LibraryIcon, UploadIcon } from 'lucide-react';
import { useState } from 'react';
import { Screen } from '@/components/layout/screen';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page';
import { QueryView } from '@/components/shared/query-view';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useArchive } from './api';
import { ArchiveShuffle } from './components/archive-shuffle';
import { ArchiveStats } from './components/archive-stats';
import { CalibrationPanel } from './components/calibration-panel';
import { ImportDialog } from './components/import-dialog';
import { PiecesTable } from './components/pieces-table';

function Loading() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

export function ArchivePage() {
  const archive = useArchive();
  const [importing, setImporting] = useState(false);
  const importButton = (
    <Button onClick={() => setImporting(true)}>
      <UploadIcon /> Import posts
    </Button>
  );

  return (
    <Screen crumbs={[{ label: 'Archive' }]}>
      <PageHeader title="Archive" description="Your published posts. Drafts are checked against them for repeats and voice, never copied from them." actions={importButton} />
      <QueryView query={archive} loading={<Loading />}>
        {(data) => (
          <>
            <ArchiveStats archive={data} />
            {data.total === 0 ? (
              <EmptyState
                icon={LibraryIcon}
                title="No posts yet"
                description="Import at least 20 of your published posts. Every draft is checked against them."
                action={importButton}
              />
            ) : (
              <>
              <ArchiveShuffle archive={data} />
              <Tabs defaultValue="posts" className="gap-4">
                <TabsList>
                  <TabsTrigger value="posts">Posts</TabsTrigger>
                  <TabsTrigger value="calibration">Calibration</TabsTrigger>
                </TabsList>
                <TabsContent value="posts">
                  <PiecesTable pieces={data.pieces} />
                </TabsContent>
                <TabsContent value="calibration">
                  <CalibrationPanel />
                </TabsContent>
              </Tabs>
              </>
            )}
          </>
        )}
      </QueryView>
      <ImportDialog open={importing} onOpenChange={setImporting} />
    </Screen>
  );
}
