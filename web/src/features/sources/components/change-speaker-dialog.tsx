import { UserRoundCogIcon } from 'lucide-react';
import { useState } from 'react';
import type { SourceDetail } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SpeakerPicker } from './speaker-picker';
import { usePickSpeaker } from './use-pick-speaker';

/** Re-pick the creator's speaker. Only offered before any draft exists, as the server requires. */
export function ChangeSpeakerDialog({ source }: { source: SourceDetail }) {
  const [open, setOpen] = useState(false);
  const speaker = usePickSpeaker(source.id);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserRoundCogIcon /> Change speaker
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Which speaker is you?</DialogTitle>
          <DialogDescription>Picking a different speaker finds claims again. Angles are proposed fresh.</DialogDescription>
        </DialogHeader>
        <div className="@container/main">
          <SpeakerPicker
            source={source}
            pending={speaker.pending}
            onPick={(name) => {
              speaker.pick(name);
              setOpen(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
