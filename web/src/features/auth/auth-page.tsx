import { useState } from 'react';
import type { AuthSession } from '@/api/types';
import { LogoMark } from '@/components/shared/logo-mark';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from './components/login-form';
import { SignupForm } from './components/signup-form';

type Mode = 'login' | 'signup';

function intro(mode: Mode, session: AuthSession) {
  if (mode === 'login') return { title: 'Log in', description: 'Your archive, sources and drafts are only visible to you.' };
  if (session.existing_data) {
    return { title: 'Create the first account', description: 'This server already has an archive and drafts. The first account takes them over; later accounts start empty.' };
  }
  if (session.first_account) return { title: 'Create the first account', description: 'You will start with an empty archive. Import your posts once you are in.' };
  return { title: 'Create an account', description: 'Everything you add stays in your account. Nobody else on this server can see it.' };
}

/** Shown instead of the app until someone is signed in. */
export function AuthPage({ session }: { session: AuthSession }) {
  const [mode, setMode] = useState<Mode>(session.first_account ? 'signup' : 'login');
  const { title, description } = intro(mode, session);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-medium">
          <LogoMark className="size-6" />
          Creator OS
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            {mode === 'login' ? (
              <LoginForm onSignUp={session.signup_open ? () => setMode('signup') : undefined} />
            ) : (
              <SignupForm onLogIn={session.first_account ? undefined : () => setMode('login')} />
            )}
          </CardContent>
        </Card>
        {!session.signup_open && mode === 'login' && (
          <p className="text-center text-sm text-balance text-muted-foreground">New accounts are turned off on this server. Ask its owner for access.</p>
        )}
      </div>
    </main>
  );
}
