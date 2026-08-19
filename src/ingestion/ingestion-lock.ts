const locks = new Map<string, Promise<void>>();

export async function withIngestionLock<T>(
  sourceType: string,
  sourceId: number,
  operation: () => Promise<T>,
): Promise<T> {
  const key = `${sourceType}:${sourceId}`;

  const previous = locks.get(key) ?? Promise.resolve();

  let release!: () => void;

  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  locks.set(key, current);

  await previous;

  try {
    return await operation();
  } finally {
    release();

    if (locks.get(key) === current) {
      locks.delete(key);
    }
  }
}
