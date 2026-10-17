import { describe, expect, it } from 'vitest';
import { historyReducer, initHistory } from '../src/model/history';

describe('undo/redo', () => {
  it('undoes and redoes', () => {
    let h = initHistory(0);
    h = historyReducer(h, { type: 'apply', next: 1 });
    h = historyReducer(h, { type: 'apply', next: 2 });
    h = historyReducer(h, { type: 'undo' });
    expect(h.present).toBe(1);
    h = historyReducer(h, { type: 'undo' });
    expect(h.present).toBe(0);
    h = historyReducer(h, { type: 'undo' });
    expect(h.present).toBe(0);
    h = historyReducer(h, { type: 'redo' });
    expect(h.present).toBe(1);
  });
  it('a new edit clears redo', () => {
    let h = initHistory('a');
    h = historyReducer(h, { type: 'apply', next: 'b' });
    h = historyReducer(h, { type: 'undo' });
    h = historyReducer(h, { type: 'apply', next: 'c' });
    expect(h.future).toEqual([]);
    expect(h.past).toEqual(['a']);
  });
  it('coalesces rapid edits with the same key into one step', () => {
    let h = initHistory(0);
    h = historyReducer(h, { type: 'apply', next: 1, key: 'x', at: 1000 });
    h = historyReducer(h, { type: 'apply', next: 2, key: 'x', at: 1300 });
    h = historyReducer(h, { type: 'apply', next: 3, key: 'x', at: 1600 });
    expect(h.past).toEqual([0]);
    h = historyReducer(h, { type: 'apply', next: 4, key: 'x', at: 5000 });
    expect(h.past).toEqual([0, 3]);
  });
});
