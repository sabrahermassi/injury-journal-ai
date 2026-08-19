import { withIngestionLock } from '../src/ingestion/ingestion-lock.js';

function createDeferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('withIngestionLock', () => {
  it('resolves with the return value of the operation', async () => {
    const result = await withIngestionLock('treatment', 1, async () => 42);

    expect(result).toBe(42);
  });

  it('serializes operations for the same sourceType/sourceId key', async () => {
    const order: string[] = [];
    const gate = createDeferred<void>();

    const p1 = withIngestionLock('treatment', 1, async () => {
      order.push('start-1');
      await gate.promise;
      order.push('end-1');
    });

    // Allow p1 to start and reach the gate.
    await Promise.resolve();
    await Promise.resolve();

    const p2 = withIngestionLock('treatment', 1, async () => {
      order.push('start-2');
    });

    await Promise.resolve();
    await Promise.resolve();

    // p2 must not run until p1's operation has finished, since they share a key.
    expect(order).toEqual(['start-1']);

    gate.resolve();
    await Promise.all([p1, p2]);

    expect(order).toEqual(['start-1', 'end-1', 'start-2']);
  });

  it('does not serialize operations for different sourceIds', async () => {
    const order: string[] = [];
    const gate = createDeferred<void>();

    const p1 = withIngestionLock('treatment', 1, async () => {
      order.push('start-1');
      await gate.promise;
      order.push('end-1');
    });

    await Promise.resolve();
    await Promise.resolve();

    const p2 = withIngestionLock('treatment', 2, async () => {
      order.push('start-2');
    });

    // p2 uses a different key, so it should complete without waiting on p1.
    await p2;

    expect(order).toEqual(['start-1', 'start-2']);

    gate.resolve();
    await p1;

    expect(order).toEqual(['start-1', 'start-2', 'end-1']);
  });

  it('treats different sourceTypes with the same sourceId as separate keys', async () => {
    const order: string[] = [];
    const gate = createDeferred<void>();

    const p1 = withIngestionLock('treatment', 1, async () => {
      order.push('start-treatment');
      await gate.promise;
    });

    await Promise.resolve();
    await Promise.resolve();

    const p2 = withIngestionLock('medical_visit', 1, async () => {
      order.push('start-medical_visit');
    });

    await p2;

    expect(order).toEqual(['start-treatment', 'start-medical_visit']);

    gate.resolve();
    await p1;
  });

  it('propagates errors from the operation', async () => {
    await expect(
      withIngestionLock('treatment', 1, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('releases the lock even when the operation throws, allowing subsequent operations to run', async () => {
    await expect(
      withIngestionLock('treatment', 1, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const result = await withIngestionLock('treatment', 1, async () => 'recovered');

    expect(result).toBe('recovered');
  });

  it('runs several queued operations for the same key in submission order', async () => {
    const order: number[] = [];

    const operations = [1, 2, 3, 4].map((n) =>
      withIngestionLock('treatment', 99, async () => {
        order.push(n);
      }),
    );

    await Promise.all(operations);

    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('does not block a later operation for the same key if an earlier one fails', async () => {
    const order: string[] = [];

    const p1 = withIngestionLock('treatment', 1, async () => {
      order.push('op-1');
      throw new Error('op-1 failed');
    });

    const p2 = withIngestionLock('treatment', 1, async () => {
      order.push('op-2');
    });

    await expect(p1).rejects.toThrow('op-1 failed');
    await p2;

    expect(order).toEqual(['op-1', 'op-2']);
  });
});