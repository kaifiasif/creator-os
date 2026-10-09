import type { UseMutationResult } from '@tanstack/react-query';
import { SendIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { Rehearsal, RehearsalInterviewResult, RehearsalResult } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { DetailSection } from './detail-section';

type Persona = NonNullable<RehearsalResult['personas']>[number];
type InterviewMutation = UseMutationResult<RehearsalInterviewResult, Error, { rehearsalId: string; agent_id: number; prompt: string }>;

/** Ask one simulated follower why they reacted the way they did. */
export function RehearsalInterview({ rehearsal, personas, mutation }: { rehearsal: Rehearsal; personas: Persona[]; mutation: InterviewMutation }) {
  const [agent, setAgent] = useState<string>('');
  const [question, setQuestion] = useState('');
  const name = (id: number) => personas.find((p) => p.id === id)?.name ?? `Follower ${id}`;
  const canAsk = agent !== '' && question.trim().length > 0 && !mutation.isPending;

  const ask = () => {
    if (!canAsk) return;
    mutation.mutate(
      { rehearsalId: rehearsal.id, agent_id: Number(agent), prompt: question.trim() },
      { onSuccess: () => setQuestion(''), onError: (e) => toast.error(errorMessage(e)) },
    );
  };

  return (
    <DetailSection title="Ask a follower">
      {rehearsal.interviews.map((it) => (
        <div key={it.at} className="grid gap-0.5">
          <p className="text-xs">You asked {name(it.agent_id)}: {it.prompt}</p>
          <p className="text-foreground">{it.answer}</p>
        </div>
      ))}
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <Select value={agent} onValueChange={setAgent}>
          <SelectTrigger className="sm:w-40" aria-label="Follower">
            <SelectValue placeholder="Pick a follower" />
          </SelectTrigger>
          <SelectContent>
            {personas.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={question} maxLength={1000} placeholder="Would you repost this?" aria-label="Question" onChange={(e) => setQuestion(e.target.value)} />
        <Button type="submit" size="icon" variant="outline" disabled={!canAsk} aria-label="Ask">
          {mutation.isPending ? <Spinner /> : <SendIcon />}
        </Button>
      </form>
    </DetailSection>
  );
}
