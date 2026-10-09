import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import { useSourceActions } from '../api';

/** Marks one speaker as the creator; claims are then found again. */
export function usePickSpeaker(id: string) {
  const { setSpeaker } = useSourceActions(id);
  return {
    pending: setSpeaker.isPending,
    pick: (speaker: string) =>
      setSpeaker.mutate(speaker, {
        onSuccess: () => toast.success(`Marked ${speaker} as you`, { description: 'Finding your claims now.' }),
        onError: (e) => toast.error(errorMessage(e)),
      }),
  };
}
