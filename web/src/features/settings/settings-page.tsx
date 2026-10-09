import { Screen } from '@/components/layout/screen';
import { AccountCard } from '@/features/auth/components/account-card';
import { TwoStepCard } from '@/features/auth/components/two-step-card';
import { PageHeader } from '@/components/shared/page';
import { useConfig } from './api';
import { AgentsSettingsCard } from './components/agents-settings-card';
import { AppearanceCard } from './components/appearance-card';
import { ConnectionsCard } from './components/connections-card';

export function SettingsPage() {
  const config = useConfig();
  return (
    <Screen crumbs={[{ label: 'Settings' }]}>
      <PageHeader title="Settings" description="Your account, how drafts are checked, how the app looks and what this server connects to." />
      <div className="grid items-start gap-4 md:gap-6 @3xl/main:grid-cols-2">
        <div className="grid gap-4 md:gap-6">
          <AccountCard />
          <TwoStepCard />
        </div>
        <div className="grid gap-4 md:gap-6">
          <AgentsSettingsCard />
          <AppearanceCard />
        </div>
        <ConnectionsCard config={config} />
      </div>
    </Screen>
  );
}
