import {
  promisify,
  cure,
  memo,
  getMemoValue,
  getMemoPromise,
  putMemoValue,
  delay,
} from ".";

describe("promisify", () => {
  it("should return a promise which resolve when the given callback is called", async () => {
    const testCallback = (callback: (val: any) => void) => {
      setTimeout(() => callback(true), 200);
    };
    const promisifyReturn = promisify<any>(testCallback);
    expect(promisifyReturn).toBeInstanceOf(Promise);
    const result = await promisifyReturn;
    expect(result).toEqual(true);
  });
  it("should accept a context to bind to the function", async () => {
    const testCallback = {
      test: (callback: (val: any) => void) => {
        setTimeout(() => callback(true), 200);
      },
    };
    const promisifyReturn = promisify<any>(testCallback.test, testCallback);
    expect(promisifyReturn).toBeInstanceOf(Promise);
    const result = await promisifyReturn;
    expect(result).toEqual(true);
  });
});

describe("cure", () => {
  it("should cure the function first argument into an higher order function", () => {
    const toCure = (arg1: any, arg2: any) => {
      return `${arg1}, ${arg2}`;
    };
    const cured = cure(toCure);
    expect(cured("Jane")("Jeannot")).toEqual(toCure("Jane", "Jeannot"));
  });
});

describe("memo", () => {
  it("should retain a value, give it back on empty next call alongside an eventEmitter wich will emit on next change, and change it on none empty next call", async () => {
    const memoGenerator = memo({ test: "Jane" });
    const {
      value: [retainedValue, promise],
    } = await memoGenerator.next();
    promise.once("updated", (val) => expect(val).toEqual({ test: "Jeannot" }));
    expect(retainedValue).toEqual({ test: "Jane" });
    const {
      value: [retainedValue2],
    } = await memoGenerator.next();
    expect(retainedValue2).toEqual({ test: "Jane" });
    await memoGenerator.next({ test: "Jeannot" });
    const {
      value: [retainedValue3],
    } = await memoGenerator.next();
    expect(retainedValue3).toEqual({ test: "Jeannot" });
    const {
      value: [retainedValue4],
    } = await memoGenerator.next();
    expect(retainedValue4).toEqual({ test: "Jeannot" });
  });
});

describe("getMemoValue", () => {
  it("should return the stored value in a memo Generator", async () => {
    const testValue = "test";
    const memorized = memo(testValue);
    expect(getMemoValue(memorized)).toEqual(testValue);
  });
});

describe("getMemoPromise", () => {
  it("should return a promise which will resolve when the stored value in a memo Generator changes", async () => {
    const testValue = "test";
    const nextValue = "changed";
    const memorized = memo(testValue);
    const valueChangePromise = getMemoPromise(memorized);
    valueChangePromise.then((value) => expect(value).toEqual(nextValue));
    await memorized.next(nextValue);
  });
});

describe("putMemoValue", () => {
  it("should mutate the stored value in a memo Generator", async () => {
    const testValue = "test";
    const nextValue = "changed";
    const memorized = memo(testValue);
    const {
      value: [retainedValue],
    } = await memorized.next();
    expect(retainedValue).toEqual(testValue);
    putMemoValue(memorized, nextValue);
    const {
      value: [retainedValue2],
    } = await memorized.next();
    expect(retainedValue2).toEqual(nextValue);
  });
});

describe("delay", () => {
  it("should delay further execution by given milliseconds", async () => {
    const before = new Date().getTime();
    await delay(300);
    const after = new Date().getTime();
    expect(after - before).toBeGreaterThanOrEqual(300);
  });
});
