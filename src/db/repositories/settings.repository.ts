import type { Database } from '../client.ts';
import { json } from '../codec.ts';

export function createSettingsRepository(db: Database, userId: string) {
  return {
    get<T>(key: string, fallback: T): T {
      const row = db.get<{ value: string }>('SELECT value FROM settings WHERE user_id = ? AND key = ?', userId, key);
      return row ? json.decode<T>(row.value) : fallback;
    },
    set(key: string, value: unknown): void {
      db.run(
        'INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value',
        userId, key, json.encode(value),
      );
    },
  };
}
export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
