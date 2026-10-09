import type { SourceDetail } from '@/api/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SpeakerPicker } from './speaker-picker';
import { TranscriptView } from './transcript-view';
import { usePickSpeaker } from './use-pick-speaker';

export function MappingState({ source }: { source: SourceDetail }) {
  const speaker = usePickSpeaker(source.id);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Which speaker is you?</CardTitle>
          <CardDescription>Only your own words can be drafted as yours. Other speakers can still be quoted, with attribution.</CardDescription>
        </CardHeader>
        <CardContent>
          <SpeakerPicker source={source} onPick={speaker.pick} pending={speaker.pending} />
        </CardContent>
      </Card>
      <TranscriptView source={source} />
    </>
  );
}
