import type { AppServices } from '../../context.ts';
import { router } from '../../http/types.ts';

/** Public: platforms poll this to decide whether the server is up. */
export function healthRoutes(app: AppServices) {
  return router().get('/health', (c) => {
    // healthy means the database answers, not just that the process is up
    app.db.get('SELECT 1');
    return c.json({ ok: true });
  });
}

export function systemRoutes(app: AppServices) {
  return router().get('/config', (c) => {
    const { llm, embeddings, transcription } = app.providers;
    return c.json({
      llm: llm.name,
      models: llm.models,
      embeddings: embeddings.name,
      transcription: transcription.name,
      audio_supported: transcription.canTranscribeAudio,
      signup: app.config.signup,
    });
  });
}
