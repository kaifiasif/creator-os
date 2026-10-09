import { useMemo, useState } from 'react';
import type { SourceDetail } from '@/api/types';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAngles } from '../api';
import { AnglesPanel } from './angles-panel';
import { ClaimsPanel } from './claims-panel';
import { CUSTOM, type CustomAngleValue } from './custom-angle';
import { SourceRuns } from './source-runs';
import { claimAnchor, TranscriptView } from './transcript-view';

/** Transcript on the left; angles and claims on the right. Stacks on narrow screens. */
export function ReadyView({ source }: { source: SourceDetail }) {
  const angles = useAngles(source.id, true);
  const leadClaims = useMemo(() => source.claims.filter((c) => c.is_creator && !c.retired), [source.claims]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [custom, setCustom] = useState<CustomAngleValue>({ leadClaimId: '', text: '' });
  const [located, setLocated] = useState<string | null>(null);
  const [tab, setTab] = useState('angles');

  // until the creator picks, the first proposed angle is selected
  const selection = chosen ?? angles.data?.[0]?.id ?? null;
  const customValue = { ...custom, leadClaimId: custom.leadClaimId || leadClaims[0]?.id || '' };

  const emphasis = useMemo(() => {
    if (located) return new Set([located]);
    if (selection === CUSTOM) return new Set(customValue.leadClaimId ? [customValue.leadClaimId] : []);
    return new Set(angles.data?.find((a) => a.id === selection)?.claim_ids ?? []);
  }, [located, selection, customValue.leadClaimId, angles.data]);

  const locate = (claimId: string) => {
    setLocated(claimId);
    document.getElementById(claimAnchor(claimId))?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const select = (next: string) => {
    setLocated(null);
    setChosen(next);
  };

  return (
    <div className="grid items-start gap-4 md:gap-6 @5xl/main:grid-cols-2">
      <TranscriptView source={source} emphasis={emphasis} className="@5xl/main:sticky @5xl/main:top-[calc(var(--header-height)+1.5rem)] @5xl/main:max-h-[calc(100svh-var(--header-height)-3rem)] @5xl/main:overflow-y-auto" />
      <div className="order-first grid gap-4 md:gap-6 @5xl/main:order-none">
        <SourceRuns runs={source.runs} />
        <Card>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab} className="gap-4">
              <TabsList>
                <TabsTrigger value="angles">Angles</TabsTrigger>
                <TabsTrigger value="claims">Claims</TabsTrigger>
              </TabsList>
              <TabsContent value="angles">
                <AnglesPanel sourceId={source.id} angles={angles} leadClaims={leadClaims} selection={selection} onSelect={select} custom={customValue} onCustom={setCustom} />
              </TabsContent>
              <TabsContent value="claims">
                <ClaimsPanel source={source} onLocate={locate} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
