import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { Calibration } from '@/api/types';
import { plural } from '@/lib/format';
import { useCalibration, useCalibrationActions } from './api';
import type { CalibrationLabel } from './types';

export interface FittedThreshold {
  threshold: number;
  f1: number;
  n: number;
}

/** The stored fit is an open record on the server; read the three numbers only when they are there. */
function readFit(current: Calibration['current']): FittedThreshold | null {
  if (!current) return null;
  const { threshold, f1, n } = current;
  return typeof threshold === 'number' && typeof f1 === 'number' && typeof n === 'number' ? { threshold, f1, n } : null;
}

/** One labelling session: label pairs locally, then save them and fit the threshold in one go. */
export function useCalibrationSession() {
  const query = useCalibration();
  const { saveLabels, fit } = useCalibrationActions();
  const [labels, setLabels] = useState<CalibrationLabel[]>([]);

  const pairs = query.data?.pairs ?? [];
  const pair = pairs[labels.length] ?? null;
  const busy = saveLabels.isPending || fit.isPending;

  const label = (sameAngle: boolean) => {
    if (!pair || busy) return;
    setLabels((list) => [...list, { piece_a: pair.piece_a.id, piece_b: pair.piece_b.id, same_angle: sameAngle }]);
  };
  const undo = () => setLabels((list) => list.slice(0, -1));

  const persist = async () => {
    if (!labels.length) return;
    await saveLabels.mutateAsync(labels);
    setLabels([]);
  };

  const save = async () => {
    const count = labels.length;
    try {
      await persist();
      toast.success(`Saved ${plural(count, 'label')}.`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const fitThreshold = async () => {
    try {
      await persist();
      const result = await fit.mutateAsync();
      toast.success(`Repeat threshold set to ${result.threshold.toFixed(2)}.`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return {
    query,
    pair,
    position: labels.length,
    total: pairs.length,
    unsaved: labels.length,
    labelledBefore: query.data?.labelled ?? 0,
    fitted: fit.data ?? readFit(query.data?.current ?? null),
    busy,
    label,
    undo,
    save,
    fitThreshold,
  };
}
export type CalibrationSession = ReturnType<typeof useCalibrationSession>;
