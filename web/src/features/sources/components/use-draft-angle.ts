import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { CreateRunInput } from '@/api/types';
import { navigate } from '@/app/router';
import { useCreateRun } from '@/features/drafts/api';

/** Starts a draft and opens it for review. */
export function useDraftAngle() {
  const createRun = useCreateRun();
  return {
    pending: createRun.isPending,
    draft: (input: CreateRunInput) =>
      createRun.mutate(input, {
        onSuccess: ({ run_id }) => navigate({ name: 'review', id: run_id }),
        onError: (e) => toast.error(errorMessage(e)),
      }),
  };
}
