import { InfoIcon } from 'lucide-react';
import type { SourceDetail } from '@/api/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasteTranscriptDialog } from './paste-transcript-dialog';
import { SpeakerPicker } from './speaker-picker';
import { TranscriptView } from './transcript-view';
import { usePickSpeaker } from './use-pick-speaker';

export function NothingPostableState({ source }: { source: SourceDetail }) {
  const speaker = usePickSpeaker(source.id);
  const several = (source.speakers?.length ?? 0) > 1;
  return (
    <>
      <Alert>
        <InfoIcon />
        <AlertTitle>Nothing postable was found</AlertTitle>
        <AlertDescription>
          <p>
            {several
              ? `None of ${source.creator_speaker ? `${source.creator_speaker}’s` : 'your'} lines made a complete claim you could post. If the wrong speaker is marked as you, pick again below.`
              : 'There were no complete statements to draft from. If the transcript is wrong or incomplete, paste a better one.'}
          </p>
          <div className="mt-2">
            <PasteTranscriptDialog id={source.id} />
          </div>
        </AlertDescription>
      </Alert>
      {several && (
        <Card>
          <CardHeader>
            <CardTitle>Which speaker is you?</CardTitle>
            <CardDescription>Picking a different speaker finds claims again.</CardDescription>
          </CardHeader>
          <CardContent>
            <SpeakerPicker source={source} onPick={speaker.pick} pending={speaker.pending} />
          </CardContent>
        </Card>
      )}
      <TranscriptView source={source} />
    </>
  );
}
