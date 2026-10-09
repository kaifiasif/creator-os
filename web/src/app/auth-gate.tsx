import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import { whenSignedOut } from '@/api/client';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/query-client';
import type { AuthSession } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/features/auth/api';
import { AuthPage } from '@/features/auth/auth-page';

/** Renders the app only for a signed-in creator; everyone else gets the log-in screen. */
export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const client = useQueryClient();

  // the session ended under us (expired, or the password changed on another device)
  useEffect(
    () =>
      whenSignedOut(() => {
        const current = client.getQueryData<AuthSession>(queryKeys.session);
        if (!current?.user) return;
        client.removeQueries({ predicate: (q) => q.queryKey[0] !== queryKeys.session[0] });
        client.setQueryData<AuthSession>(queryKeys.session, { ...current, user: null });
        toast.info('You were logged out. Log in again to carry on.');
      }),
    [client],
  );

  if (session.isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }
  if (session.isError) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">{errorMessage(session.error)}</p>
        <Button variant="outline" onClick={() => void session.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!session.data.user) return <AuthPage session={session.data} />;
  return children;
}
