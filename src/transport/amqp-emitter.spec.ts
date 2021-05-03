import "reflect-metadata";
import { delay, memo, putMemoValue } from "../utils";
import { connect, Connection } from "amqplib";
import { AmqpEmitter } from "./amqp-emitter";
import { AmqpDuplex } from "../stream/amqp-duplex";
import dotenv from "dotenv";

dotenv.config({ path: process.cwd() + "/.env.test" });

let connection: Connection;
beforeAll(async () => {
  connection = await connect({
    hostname: process.env.RABBITMQ_HOSTNAME,
    protocol: "amqp",
    port: +(<any>process.env.RABBITMQ_PORT),
  });
});
afterAll(async () => {
  await connection.close();
});

describe("RedisTransportEmitter", () => {
  describe("constructor", () => {
    it("should set an an empty map in streams property", async () => {
      const emitter = new AmqpEmitter(10, connection);
      const streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      expect(streams?.value).toBeInstanceOf(Map);
      expect(streams?.value.size).toEqual(0);
    });
  });
  describe("once", () => {
    it("should create a Redis stream for the given event name if none is present, or reuse one if existing", async () => {
      const emitter = new AmqpEmitter(10, connection);
      const canceler = memo(true);
      emitter.once({ event: "test", canceler }, () => {});
      let streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      expect(streams?.value).toBeInstanceOf(Map);
      expect(streams?.value.size).toEqual(1);
      expect(streams?.value.get("test")).toBeInstanceOf(AmqpDuplex);
      emitter.once({ event: "test", canceler }, () => {});
      expect(streams?.value.size).toEqual(1);
    });
    it("should await for data for 10 second before returning undefined", async () => {
      const emitter = new AmqpEmitter(10, connection);
      const canceler = memo(true);
      const res = await emitter.once(
        { event: "test4", canceler },
        (data) => {}
      );
      expect(res).toBeUndefined();
    });
    it("should await for data before timeout before returning undefined, and skip reading from inner stream", async () => {
      const emitter = new AmqpEmitter(10, connection);
      const canceler = memo(true);
      const streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      const res = await emitter.once(
        { event: "test5", canceler, timeout: 100 },
        (data) => {}
      );
      const testStream = streams?.value.get("test5");
      const spyRead = jest.spyOn(testStream, "read");
      await emitter.emit({ event: "test5" }, {});
      await new Promise<void>((resolve) =>
        setTimeout(() => {
          expect(spyRead).toHaveBeenCalledTimes(0);
          resolve();
        }, 200)
      );
      expect(res).toBeUndefined();
    });
    it("should await for data before passed Promise resolve before returning undefined, and skip reading from inner stream", async () => {
      const emitter = new AmqpEmitter(10, connection);
      const canceler = memo(true);
      const timeoutPromise = delay(400);
      const streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      const res = await emitter.once(
        { event: "test21", canceler, timeout: timeoutPromise },
        (data) => {}
      );
      const testStream = streams?.value.get("test21");
      const spyRead = jest.spyOn(testStream, "read");
      await emitter.emit({ event: "test21" }, {});
      await new Promise<void>((resolve) =>
        setTimeout(() => {
          expect(spyRead).toHaveBeenCalledTimes(0);
          resolve();
        }, 200)
      );
      expect(res).toBeUndefined();
    });
    it("should avoid reading from inner stream if cancellation event is triggered", async () => {
      const emitter = new AmqpEmitter(10, connection);
      const canceler = memo(true);
      const streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      const res = await Promise.all([
        emitter.once({ event: "test6", canceler }, (data) => {}),
        (async () => {
          const testStream = streams?.value.get("test6");
          const spyRead = jest.spyOn(testStream, "read");
          putMemoValue(canceler, false);
          await emitter.emit({ event: "test6" }, {});
          await new Promise<void>((resolve) =>
            setTimeout(() => {
              expect(spyRead).toHaveBeenCalledTimes(0);
              resolve();
            }, 200)
          );
        })(),
      ]);
      expect(res[0]).toBeUndefined();
    });
    it("should read the first value, then wait for a second element if a second call is made in between", async () => {
      const emitter = new AmqpEmitter(10, connection);
      const canceler = memo(true);
      await emitter.emit({ event: "test20" }, {});
      await delay(200);
      const res = await emitter.once({ event: "test20", canceler }, (data) => {
        expect(data).toBeUndefined();
      });
      await delay(200);
      const res2 = await Promise.all([
        emitter.once({ event: "test20", canceler }, (data) => {
          expect(data).toEqual({});
        }),
        (async () => {
          await delay(200);
          await emitter.emit({ event: "test20" }, {});
          await emitter.emit({ event: "test20" }, {});
          await emitter.emit({ event: "test20" }, {});
          await emitter.emit({ event: "test20" }, {});
        })(),
      ]);
      await delay(200);
      emitter.once({ event: "test20", canceler }, (data) => {
        expect(data).toEqual({});
      });
      expect(res).toEqual(undefined);
      await delay(1000);
    });
  });
  describe("emit", () => {
    it("should create a AmqpDuplex stream for the given event name if none is present, or reuse one if existing", async () => {
      const emitter = new AmqpEmitter(10, connection);
      const canceler = memo(true);
      //   emitter.once({ event: "test7", canceler }, () => {});
      let streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      expect(streams?.value).toBeInstanceOf(Map);
      expect(streams?.value.size).toEqual(0);
      emitter.emit({ event: "test7" }, {});
      await delay(200);
      expect(streams?.value.size).toEqual(1);
      expect(streams?.value.get("test7")).toBeInstanceOf(AmqpDuplex);
    });
    it("should write to inner stream and return immediately if operation successfull", async () => {
      const emitter = new AmqpEmitter(10, connection);
      const canceler = memo(true);
      await emitter.once({ event: "test8", canceler }, () => {});
      const streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      const testStream = streams?.value.get("test8");
      const spyWrite = jest.spyOn(testStream, "write");
      await emitter.emit({ event: "test8" });
      expect(spyWrite).toHaveBeenCalledTimes(1);
    });
  });
  describe("getInternalStreamType", () => {
    it("should return the class object of the used internal stream", () => {
      const emitter = new AmqpEmitter(10, connection);
      expect(emitter.getInternalStreamType()).toEqual(AmqpDuplex);
    });
  });
  describe("setStream", () => {
    it("should set a duplex stream for the given key", () => {
      const emitter = new AmqpEmitter(2, connection);
      emitter.setStream(
        "test12",
        new (emitter.getInternalStreamType())(10, "test12", connection)
      );
      const streamsDescriptor = Reflect.getOwnPropertyDescriptor(
        emitter,
        "streams"
      );

      expect(streamsDescriptor?.value.get("test12")).toBeInstanceOf(AmqpDuplex);
    });
  });
  describe("getStream", () => {
    it("should get a duplex stream for the given key", () => {
      const emitter = new AmqpEmitter(2, connection);
      emitter.setStream(
        "test13",
        new (emitter.getInternalStreamType())(10, "test13", connection)
      );
      const stream = emitter.getStream("test13");
      expect(stream).toBeInstanceOf(AmqpDuplex);
    });
  });
  describe("resetInternalStreams", () => {
    it("should remove all internal representation of a stream", () => {
      const emitter = new AmqpEmitter(2, connection);
      emitter.setStream(
        "test14",
        new (emitter.getInternalStreamType())(10, "test14", connection)
      );
      emitter.resetInternalStreams();
      const streamsDescriptor = Reflect.getOwnPropertyDescriptor(
        emitter,
        "streams"
      );
      expect(streamsDescriptor?.value.size).toEqual(0);
    });
  });
});
