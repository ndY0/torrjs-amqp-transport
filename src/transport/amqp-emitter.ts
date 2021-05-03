import { TransportEmitter } from "./interface";
import { Duplex, EventEmitter } from "stream";
import {
  memo,
  getMemoValue,
  putMemoValue,
  promisify,
  cure,
  delay,
} from "../utils";
import { AmqpDuplex } from "../stream/amqp-duplex";
import { Connection } from "amqplib";

class AmqpEmitter implements TransportEmitter {
  private streams: Map<string | symbol, Duplex> = new Map<
    string | symbol,
    Duplex
  >();
  public constructor(
    private readonly queueSize: number,
    private connection: Connection
  ) {}
  getInternalStreamType() {
    return AmqpDuplex;
  }
  resetInternalStreams(): void {
    this.streams = new Map();
  }
  setStream(key: string, stream: Duplex): void {
    this.streams.set(key, stream);
  }
  getStream(key: string): Duplex | undefined {
    return this.streams.get(key);
  }
  public async once(
    {
      timeout,
      event,
      canceler,
    }: {
      timeout?: number | Promise<any>;
      event: string;
      canceler: Generator<[boolean, EventEmitter], never, boolean>;
    },
    listener: (...args: any[]) => void
  ): Promise<void> {
    let stream = this.streams.get(event);
    if (!stream) {
      stream = new AmqpDuplex(this.queueSize, event, this.connection);
      this.streams.set(event, stream);
    }
    const innerCanceler = memo(true);
    let result = stream.read(1);
    if (!result) {
      result = await Promise.race([
        (async function (passedCanceler, outterCanceler) {
          await promisify(cure(stream.once, stream)("readable"), stream);
          const shouldRun = [
            getMemoValue(passedCanceler),
            getMemoValue(outterCanceler),
          ].reduce((acc, curr) => acc && curr, true);
          if (shouldRun) {
            return (<Duplex>stream).read(1);
          }
        })(innerCanceler, canceler),
        (async function (passedCanceler) {
          if (typeof timeout === "number" || timeout === undefined) {
            await delay(timeout || 10_000);
          } else {
            await timeout;
          }
          putMemoValue(passedCanceler, false);
        })(innerCanceler),
      ]);
    }
    if (result && typeof result !== "boolean") {
      listener(...result);
    } else {
      listener();
    }
  }
  public async emit(
    { timeout, event }: { timeout?: number; event: string },
    ...args: any[]
  ): Promise<boolean> {
    let stream = this.streams.get(event);
    if (!stream) {
      stream = new AmqpDuplex(this.queueSize, event, this.connection);
      this.streams.set(event, stream);
    }
    stream.write(args);
    return true;
  }
}

export { AmqpEmitter };
