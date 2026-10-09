import type { Tone } from '@/lib/labels';

/** The dot colour for each tone. Proof colours mean something; they never decorate. */
export const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-muted-foreground/50',
  info: 'bg-chart-2',
  supported: 'bg-supported',
  partial: 'bg-partial',
  unsupported: 'bg-unsupported',
  repeat: 'bg-repeat',
};

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-muted-foreground',
  info: 'text-chart-2',
  supported: 'text-supported',
  partial: 'text-partial',
  unsupported: 'text-unsupported',
  repeat: 'text-repeat',
};
