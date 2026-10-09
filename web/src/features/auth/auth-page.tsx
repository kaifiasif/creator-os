import { useState } from 'react';
import type { AuthSession } from '@/api/types';
import { LogoMark } from '@/components/shared/logo-mark';
import { LoginForm } from './components/login-form';
import { TextLoop } from '@/components/shared/motion/text-loop';
import { ProofDemo } from './components/proof-demo';
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

/**
 * Shown instead of the app until someone is signed in. The form sits on the left; on wide screens the
 * right half plays the proof demo once, so the first thing anyone sees is what the app actually does.
 */
export function AuthPage({ session }: { session: AuthSession }) {
  const [mode, setMode] = useState<Mode>(session.first_account ? 'signup' : 'login');
  const { title, description } = intro(mode, session);

  return (
    <main className="grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="motion-rise flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium">
            <LogoMark className="size-6" />
            Creator OS
          </div>
          <p className="text-sm text-muted-foreground">
            Posts from your{' '}
            <TextLoop words={['voice memos', 'calls', 'notes', 'old threads']} className="font-medium text-foreground" />, checked.
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center">
          {/* keyed by mode, so switching between log in and sign up replays the short entrance */}
          <div key={mode} className="motion-enter flex w-full max-w-sm flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="text-balance text-muted-foreground">{description}</p>
            </div>
            {mode === 'login' ? (
              <LoginForm onSignUp={session.signup_open ? () => setMode('signup') : undefined} />
            ) : (
              <SignupForm onLogIn={session.first_account ? undefined : () => setMode('login')} />
            )}
            {!session.signup_open && mode === 'login' && (
              <p className="text-sm text-balance text-muted-foreground">New accounts are turned off on this server. Ask its owner for access.</p>
            )}
          </div>
        </div>
      </div>
      <aside aria-label="How drafts are checked" className="relative hidden items-center justify-center overflow-hidden border-l bg-muted p-10 lg:flex xl:p-16">
        <ProofDemo />
      </aside>
    </main>
  );
}
