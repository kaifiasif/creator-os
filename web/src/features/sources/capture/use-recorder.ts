import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'starting' | 'recording' | 'paused';

const BARS = 32;
const SAMPLE_MS = 60;
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'];
const silence = () => Array<number>(BARS).fill(0);

const extensionFor = (mime: string) => (mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm');

function describeMicError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Microphone access is blocked. Allow it in your browser’s site settings (the icon in the address bar), then try again.';
  if (name === 'NotFoundError') return 'No microphone was found. Connect one, then try again.';
  if (name === 'NotReadableError') return 'The microphone is in use by another app. Close it, then try again.';
  return 'The microphone could not start. Try again, or upload a recording instead.';
}

export const recordingSupported = () => typeof window !== 'undefined' && 'MediaRecorder' in window && Boolean(navigator.mediaDevices?.getUserMedia);

/**
 * In-browser voice capture with a live input level. When recording stops, `onRecorded` gets the file.
 * Leaving mid-recording keeps what was said: unmount stops the recorder, which still delivers the file.
 */
export function useRecorder(onRecorded: (file: File) => void) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState(silence);
  const [error, setError] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const frame = useRef(0);
  const clock = useRef({ since: 0, banked: 0 });
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  const release = useCallback(() => {
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    void audio.current?.close();
    audio.current = null;
  }, []);

  const meter = (analyser: AnalyserNode) => {
    const buffer = new Uint8Array(analyser.fftSize);
    let lastSample = 0;
    const loop = (now: number) => {
      if (now - lastSample > SAMPLE_MS) {
        lastSample = now;
        analyser.getByteTimeDomainData(buffer);
        let peak = 0;
        for (const v of buffer) peak = Math.max(peak, Math.abs(v - 128) / 128);
        const paused = recorder.current?.state !== 'recording';
        setLevels((prev) => [...prev.slice(1), paused ? 0 : Math.min(1, peak * 2)]);
        if (!paused) setElapsedMs(clock.current.banked + Date.now() - clock.current.since);
      }
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
  };

  const start = async () => {
    if (!recordingSupported()) {
      setError('This browser cannot record audio. Upload a recording instead.');
      return;
    }
    setError(null);
    setState('starting');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const context = new AudioContext();
      audio.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(media).connect(analyser);

      const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const next = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      next.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      next.onstop = () => {
        const mime = next.mimeType || 'audio/webm';
        const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '-');
        if (chunks.length) onRecordedRef.current(new File(chunks, `voice-memo-${stamp}.${extensionFor(mime)}`, { type: mime }));
      };
      next.start(250);
      recorder.current = next;
      clock.current = { since: Date.now(), banked: 0 };
      setElapsedMs(0);
      setState('recording');
      meter(analyser);
    } catch (e) {
      release();
      setState('idle');
      setError(describeMicError(e));
    }
  };

  const togglePause = () => {
    const current = recorder.current;
    if (!current) return;
    if (current.state === 'recording') {
      current.pause();
      clock.current.banked += Date.now() - clock.current.since;
      setState('paused');
    } else if (current.state === 'paused') {
      current.resume();
      clock.current.since = Date.now();
      setState('recording');
    }
  };

  const stop = () => {
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
    recorder.current = null;
    release();
    setState('idle');
    setLevels(silence());
  };

  useEffect(
    () => () => {
      if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
      release();
    },
    [release],
  );

  return { state, elapsedMs, levels, error, start, togglePause, stop };
}
