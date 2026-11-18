import { describe, expect, it } from 'vitest';
import { createLiveLoader, oneOf, rowsOf, type LiveState } from '../liveData';

function harness<T>(load: () => Promise<T>, initial: T) {
  let state: LiveState<T> = { data: initial, loaded: false, error: null };
  const loader = createLiveLoader(load, (update) => {
    state = update(state);
  });
  return { loader, get: () => state };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('rowsOf and oneOf', () => {
  it('return the data, with no rows meaning an empty list or null', () => {
    expect(rowsOf({ data: [{ id: 1 }], error: null })).toEqual([{ id: 1 }]);
    expect(rowsOf({ data: null, error: null })).toEqual([]);
    expect(oneOf({ data: null, error: null })).toBeNull();
  });

  it('treat a failed query as a failure, not as nothing found', () => {
    expect(() => rowsOf({ data: null, error: { message: 'offline' } })).toThrow('offline');
    expect(() => oneOf({ data: null, error: { message: 'offline' } })).toThrow('offline');
  });
});

describe('createLiveLoader', () => {
  it('keeps the last good data when a later load fails, and clears the error on the next success', async () => {
    const answers = [() => Promise.resolve(['a']), () => Promise.reject(new Error('offline')), () => Promise.resolve(['b'])];
    const { loader, get } = harness(() => answers.shift()!(), [] as string[]);
    await loader.run();
    expect(get()).toEqual({ data: ['a'], loaded: true, error: null });
    await loader.run();
    expect(get()).toEqual({ data: ['a'], loaded: true, error: 'offline' });
    await loader.run();
    expect(get()).toEqual({ data: ['b'], loaded: true, error: null });
  });

  it('marks a first load that fails as loaded, with the error and no data', async () => {
    const { loader, get } = harness(() => Promise.reject(new Error('offline')), [] as string[]);
    await loader.run();
    expect(get()).toEqual({ data: [], loaded: true, error: 'offline' });
  });

  it('folds a burst of updates into one more load, ending on the newest answer', async () => {
    const first = deferred<number>();
    const second = deferred<number>();
    const queue = [first, second];
    let loads = 0;
    const { loader, get } = harness(() => {
      loads += 1;
      return queue.shift()!.promise;
    }, 0);
    const done = loader.run();
    void loader.run();
    void loader.run();
    void loader.run();
    first.resolve(1);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    second.resolve(2);
    await done;
    expect(loads).toBe(2);
    expect(get().data).toBe(2);
  });

  it('ignores an answer that arrives after the page has closed', async () => {
    const slow = deferred<number>();
    const { loader, get } = harness(() => slow.promise, 0);
    const done = loader.run();
    loader.stop();
    slow.resolve(5);
    await done;
    expect(get()).toEqual({ data: 0, loaded: false, error: null });
  });
});
