import EventEmitter from "events";

async function promisify<Treturn>(
  fn: (callback: (...result: [Treturn]) => void) => void,
  context?: any
): Promise<Treturn> {
  return new Promise((resolve: (res: Treturn) => void) => {
    fn.bind(context)((...result: [Treturn]) => {
      resolve(...result);
    });
  });
}

function cure<Tfirst, Trest, Treturn>(
  fn: (...args: [Tfirst, ...Trest[]]) => Treturn,
  context: any = null
): (first: Tfirst) => (...args: Trest[]) => Treturn {
  return (first: Tfirst) => (...args: Trest[]) =>
    fn.call(context, first, ...args);
}

function getMemoPromise<T>(memo: Generator<[T, EventEmitter], never, T>) {
  const {
    value: [_, emitter],
  } = memo.next();
  return promisify<T>(cure(emitter.once, emitter)("updated"), emitter);
}

function getMemoValue<T>(memo: Generator<[T, EventEmitter], never, T>) {
  const {
    value: [memoized, _],
  } = memo.next();
  return memoized;
}

function putMemoValue<T>(
  memo: Generator<[T, EventEmitter], never, T>,
  value: T
) {
  memo.next(value);
}

function memo<T>(initialState: T): Generator<[T, EventEmitter], never, T> {
  const generator = (function* (
    initialState: T
  ): Generator<[T, EventEmitter], never, T> {
    let state: T = initialState;
    const emitter = new EventEmitter();
    emitter.setMaxListeners(Math.pow(2, 32) / 2 - 1);
    while (true) {
      const passed = yield [state, emitter];
      if (passed !== undefined) {
        state = passed;
        emitter.emit("updated", state);
      }
    }
  })(initialState);
  generator.next();
  return generator;
}

async function delay(ms: number) {
  await new Promise<void>((resolve) => setTimeout(() => resolve(), ms));
}

export {
  promisify,
  cure,
  memo,
  getMemoValue,
  getMemoPromise,
  putMemoValue,
  delay,
};
