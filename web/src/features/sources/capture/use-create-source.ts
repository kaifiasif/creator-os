import { useMutation } from '@tanstack/react-query';
import { createSourceRequest, type NewSource } from '../api';
import { useSourceAdded } from './use-source-added';

/** Adds one source from pasted text; confirms and refreshes the inbox on success. */
export function useCreateSource() {
  const sourceAdded = useSourceAdded();
  return useMutation({
    mutationFn: (input: NewSource) => createSourceRequest(input).promise,
    onSuccess: ({ source_item_id }) => sourceAdded([source_item_id]),
  });
}
