import { ClipboardPasteIcon, MicIcon, UploadIcon } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfig } from '@/features/settings/api';
import { AudioNotice } from './audio-notice';
import { PasteForm } from './paste-form';
import { canUpload } from './queue-item';
import { Recorder } from './recorder';
import { UploadTab } from './upload-tab';
import { useUploadQueue } from './use-upload-queue';

type CaptureTab = 'upload' | 'record' | 'paste';

const recordingTitle = () =>
  `Voice memo ${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date())}`;

/** Three ways in: files, a voice memo recorded here, or pasted text. */
export function CaptureSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  // held here, outside the sheet's content, so closing the sheet keeps the queue
  const queue = useUploadQueue();
  const [tab, setTab] = useState<CaptureTab>('upload');
  const config = useConfig();
  const audioSupported = config.data?.audio_supported ?? true;
  const waiting = queue.items.filter(canUpload).length;

  const addRecording = (file: File) => {
    void queue.add([file], recordingTitle());
    setTab('upload');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl lg:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>New capture</SheetTitle>
          <SheetDescription>Add what you recorded or wrote. Each claim is kept with your exact words, so every draft can point back to them.</SheetDescription>
        </SheetHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as CaptureTab)} className="min-h-0 flex-1 gap-4 overflow-y-auto p-4">
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="upload">
              <UploadIcon /> Upload files
              {waiting > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1 tabular-nums">
                  {waiting}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="record">
              <MicIcon /> Record
            </TabsTrigger>
            <TabsTrigger value="paste">
              <ClipboardPasteIcon /> Paste
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="grid content-start gap-4">
            {!audioSupported && <AudioNotice />}
            <UploadTab queue={queue} />
          </TabsContent>
          <TabsContent value="record" className="grid content-start gap-4">
            {!audioSupported && <AudioNotice />}
            <Recorder onRecorded={addRecording} />
          </TabsContent>
          <TabsContent value="paste">
            <PasteForm />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
