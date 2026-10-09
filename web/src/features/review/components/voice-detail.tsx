import { formatPercent } from '@/lib/format';
import type { Checks, VoiceFeature } from '../lib/types';
import { DetailSection } from './detail-section';

const describe = (f: VoiceFeature) =>
  'z' in f
    ? `${f.feature} is ${Math.abs(f.z)} standard deviations ${f.z > 0 ? 'above' : 'below'} your usual`
    : `${f.feature} shows up in only ${formatPercent(f.archive_rate)} of your posts`;

export function VoiceDetail({ voice }: { voice: Checks['voice'] }) {
  if (!voice) return null;
  if (voice.skipped) {
    return (
      <DetailSection title="Voice">
        <p>The voice check was skipped for this draft.</p>
      </DetailSection>
    );
  }
  if (!voice.flag) {
    return (
      <DetailSection title="Sounds like you">
        <p>Nothing unusual compared with your archive.</p>
      </DetailSection>
    );
  }
  return (
    <DetailSection title="Reads unlike your archive">
      <ul className="list-disc space-y-1 pl-4">
        {voice.features.map((f) => (
          <li key={f.feature}>{describe(f)}.</li>
        ))}
      </ul>
      <p className="text-xs">Voice is advice only. It never blocks accepting.</p>
    </DetailSection>
  );
}
