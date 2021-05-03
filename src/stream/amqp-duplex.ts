import { Duplex } from "stream";
import { Connection, Replies, ConsumeMessage, Channel } from "amqplib";

class AmqpDuplex extends Duplex {
  private channel: Channel | undefined;
  private readMode: boolean = false;
  constructor(
    queueSize: number,
    private streamKey: string,
    private connection: Connection
  ) {
    super({
      objectMode: true,
      highWaterMark: queueSize,
      autoDestroy: false,
      emitClose: false,
    });
    this.connection.createChannel().then((channel) => {
      this.channel = channel;
      this.channel
        .assertQueue(this.streamKey, {
          durable: false,
        })
        .then(
          (_response: Replies.AssertQueue) => {},
          /* istanbul ignore next */ (err: any) => this.destroy(err)
        );
    });
  }
  _read() {
    if (!this.readMode) {
      this.readMode = true;
      this.channel?.consume(
        this.streamKey,
        (msg: ConsumeMessage | null) => {
          /* istanbul ignore else */
          if (msg) {
            this.push(JSON.parse(msg.content.toString("utf-8")));
          }
        },
        { noAck: true }
      );
    }
  }
  _write(data: any, _encoding: any, callback: (err?: Error) => void) {
    this.channel?.sendToQueue(
      this.streamKey,
      Buffer.from(JSON.stringify(data), "utf-8"),
      { expiration: 5_000 }
    );
    callback();
  }
  _destroy(err: Error | null, callback: (err: Error | null) => void) {
    this.channel?.close().then(
      () => {
        callback(err);
      },
      /* istanbul ignore next */ () => {
        callback(err);
      }
    );
  }
}

export { AmqpDuplex };
