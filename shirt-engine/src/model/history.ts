// Undo/redo over immutable snapshots. Consecutive edits with the same
// coalesce key (e.g. typing in one number field) merge into one undo step.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  lastKey?: string;
  lastAt?: number;
}

export type HistoryAction<T> =
  | { type: 'apply'; next: T; key?: string; at?: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; present: T };

const LIMIT = 200;
const COALESCE_MS = 1000;

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

export function historyReducer<T>(h: History<T>, a: HistoryAction<T>): History<T> {
  switch (a.type) {
    case 'apply': {
      if (a.next === h.present) return h;
      const at = a.at ?? Date.now();
      if (a.key && a.key === h.lastKey && h.lastAt !== undefined && at - h.lastAt < COALESCE_MS) {
        return { ...h, present: a.next, future: [], lastAt: at };
      }
      return { past: [...h.past, h.present].slice(-LIMIT), present: a.next, future: [], lastKey: a.key, lastAt: at };
    }
    case 'undo': {
      if (!h.past.length) return h;
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
    }
    case 'redo': {
      if (!h.future.length) return h;
      return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
    }
    case 'reset':
      return initHistory(a.present);
  }
}
