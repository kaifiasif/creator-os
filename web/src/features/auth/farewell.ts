/**
 * Why the log-in screen is showing, when it is not the first visit: the creator logged out, or their
 * session ended elsewhere. The screen reads it once, to say goodbye instead of pitching the app again.
 */
export type Farewell = 'logged-out' | 'expired' | null;

let farewell: Farewell = null;

export const markFarewell = (reason: Farewell) => {
  farewell = reason;
};

export const readFarewell = (): Farewell => farewell;
