import type { ArchiveImportInput, ArchiveList, ArchivePreview, Calibration } from '@/api/types';

export type Piece = ArchiveList['pieces'][number];
export type PreviewRow = ArchivePreview['rows'][number];
export type ExcludedRow = ArchivePreview['excluded'][number];
export type ImportFormat = NonNullable<ArchiveImportInput['format']>;
export type CalibrationPair = Calibration['pairs'][number];
export type CalibrationLabel = { piece_a: string; piece_b: string; same_angle: boolean };
