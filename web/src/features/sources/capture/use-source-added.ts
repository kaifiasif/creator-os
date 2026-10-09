import { toast } from 'sonner';
import { navigate } from '@/app/router';
import { closeOverlay } from '@/app/ui-state';
import { plural } from '@/lib/format';
import { useInvalidateSource } from '../api';

/** What happens after sources are added: refresh the inbox, confirm, and offer to open a single one. */
export function useSourceAdded() {
  const invalidate = useInvalidateSource();
  return (ids: string[]) => {
    if (!ids.length) return;
    invalidate();
    if (ids.length > 1) {
      toast.success(`${plural(ids.length, 'source')} added to your inbox`, { description: 'Each one is being processed now.' });
      return;
    }
    const [id] = ids;
    toast.success('Added to your inbox', {
      description: 'It is being processed now.',
      action: {
        label: 'Open',
        onClick: () => {
          closeOverlay();
          navigate({ name: 'source', id });
        },
      },
    });
  };
}
