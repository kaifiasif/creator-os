import { useEffect, useState } from 'react';

/** Native audio controls, so a recording can be checked before it is uploaded. */
export function AudioPreview({ file, label }: { file: File; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  if (!url) return null;
  return <audio controls preload="metadata" src={url} aria-label={`Play ${label}`} className="h-9 w-full" />;
}
