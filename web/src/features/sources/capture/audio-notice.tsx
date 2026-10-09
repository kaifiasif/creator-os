import { InfoIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/** The server has no transcription key: audio is kept, but someone has to paste its transcript. */
export function AudioNotice() {
  return (
    <Alert>
      <InfoIcon />
      <AlertTitle>Audio will not be transcribed</AlertTitle>
      <AlertDescription>
        The server has no transcription key, so audio is stored but not read. After uploading, open the source and paste its transcript. Text files work as usual.
      </AlertDescription>
    </Alert>
  );
}
