import type { AppConfig } from '@/api/types';
import { QueryView } from '@/components/shared/query-view';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Kbd } from '@/components/ui/kbd';
import { Skeleton } from '@/components/ui/skeleton';
import type { UseQueryResult } from '@tanstack/react-query';

const ENV_VARS = [
  { name: 'ANTHROPIC_API_KEY', turnsOn: 'Claude for drafting and the agents' },
  { name: 'LLM_API_KEY', turnsOn: 'a free Groq model for drafting and the agents (or any OpenAI-compatible API via LLM_BASE_URL)' },
  { name: 'OPENAI_API_KEY', turnsOn: 'OpenAI embeddings for the repeat and voice checks' },
  { name: 'ASSEMBLYAI_API_KEY', turnsOn: 'AssemblyAI to transcribe voice memos and calls' },
];

const PLACES = [
  { path: 'data/creator-os.db', holds: 'Sources, drafts, decisions and your archive' },
  { path: 'data/uploads/', holds: 'Audio and files you capture' },
];

function Providers({ config }: { config: AppConfig }) {
  const rows = [
    { label: 'Language model', value: config.llm, note: `${config.models.main} for drafts, ${config.models.judge} for checks` },
    { label: 'Embeddings', value: config.embeddings },
    { label: 'Transcription', value: config.transcription, note: config.audio_supported ? undefined : 'Audio cannot be transcribed until a provider is set.' },
  ];
  return (
    <dl className="divide-y text-sm">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-0.5 py-2 first:pt-0 sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd>
            <span className="font-mono">{row.value}</span>
            {row.note && <p className="text-xs text-muted-foreground">{row.note}</p>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function List({ title, items }: { title: string; items: { key: string; code: string; text: string }[] }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="grid gap-2 text-sm">
        {items.map((item) => (
          <li key={item.key} className="grid gap-1 sm:grid-cols-[13rem_1fr] sm:items-baseline">
            <Kbd className="w-fit">{item.code}</Kbd>
            <span className="text-muted-foreground">{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ConnectionsCard({ config }: { config: UseQueryResult<AppConfig> }) {
  return (
    <Card className="@3xl/main:col-span-2">
      <CardHeader>
        <CardTitle>Connections</CardTitle>
        <CardDescription>Which providers this server uses. Set an environment variable and restart the server to switch one on.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <QueryView query={config} loading={<Skeleton className="h-24" />}>
          {(c) => <Providers config={c} />}
        </QueryView>
        <List title="Environment variables" items={ENV_VARS.map((v) => ({ key: v.name, code: v.name, text: `Turns on ${v.turnsOn}` }))} />
        <List title="Where your data lives" items={PLACES.map((p) => ({ key: p.path, code: p.path, text: p.holds }))} />
      </CardContent>
    </Card>
  );
}
