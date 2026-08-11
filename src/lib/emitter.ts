type Events = Record<string, unknown>;

export interface Emitter<Schema extends Events> {
  on<Key extends keyof Schema>(
    event: Key,
    fn: (payload: Schema[Key]) => void,
  ): VoidFunction;
  off<Key extends keyof Schema>(
    event: Key,
    fn: (payload: Schema[Key]) => void,
  ): void;
  emit<Key extends keyof Schema>(
    event: Key,
    ...rest: Schema[Key] extends void | undefined ? [] : [Schema[Key]]
  ): void;
}

export function createEmitter<Schema extends Events>(): Emitter<Schema> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listeners = new Map<keyof Schema, Set<(payload: any) => void>>();

  function on<Key extends keyof Schema>(
    event: Key,
    fn: (payload: Schema[Key]) => void,
  ) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }

    listeners.get(event)?.add(fn);

    return () => off(event, fn);
  }

  function off<Key extends keyof Schema>(
    event: Key,
    fn: (payload: Schema[Key]) => void,
  ) {
    listeners.get(event)?.delete(fn);
  }

  function emit<Key extends keyof Schema>(
    event: Key,
    ...rest: Schema[Key] extends void | undefined ? [] : [Schema[Key]]
  ) {
    listeners.get(event)?.forEach((fn) => fn(rest[0]));
  }

  return { on, emit, off };
}
