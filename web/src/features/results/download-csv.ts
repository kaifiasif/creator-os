import { ApiError } from '@/api/errors';

/**
 * Downloads a file from the API. Fetching first, rather than following a link, means a failure
 * (an expired session, say) shows as an error message instead of a downloaded error page.
 */
export async function downloadCsv(url: string, filename: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach the Creator OS server. Check that it is running, then try again.');
  }
  if (!res.ok) throw await ApiError.fromResponse(res);

  const href = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
