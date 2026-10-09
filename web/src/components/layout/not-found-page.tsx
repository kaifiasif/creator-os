import { Button } from '@/components/ui/button';
import { Mascot } from '@/components/shared/mascot/mascot';
import { Screen } from './screen';

/** A link that points nowhere in the app: say so, and offer the way back. */
export function NotFoundPage() {
  return (
    <Screen crumbs={[{ label: 'Not found' }]}>
      <div className="motion-enter mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-5 py-16 text-center">
        <Mascot pose="magnifier" label className="sticker sticker-in size-36 [--tilt:-5deg]" />
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">This page is not here</h1>
          <p className="text-balance text-muted-foreground">Blot looked everywhere. The link may be old or mistyped; your drafts and sources are where you left them.</p>
        </div>
        <Button asChild>
          <a href="#/">Back to the Inbox</a>
        </Button>
      </div>
    </Screen>
  );
}
