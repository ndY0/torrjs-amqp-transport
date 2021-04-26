import { Duplex } from "stream";
import { Connection, ConfirmChannel, Replies, ConsumeMessage } from "amqplib";

class AmqpDuplex extends Duplex {
  private channel: ConfirmChannel | undefined;
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
    this.connection.createConfirmChannel().then((channel) => {
      this.channel = channel;
      this.channel
        .assertQueue(this.streamKey, {
          durable: false,
        })
        .then(
          (_response: Replies.AssertQueue) => {},
          (err: any) => this.destroy(err)
        );
    });
  }
  _read() {
    if (!this.readMode) {
      this.readMode = true;
      this.channel?.consume(this.streamKey, (msg: ConsumeMessage | null) => {
        if (msg) {
          this.push(JSON.parse(msg.content.toString("utf-8")));
        }
      });
    }
  }
  _write(data: any, _encoding: any, callback: (err?: Error) => void) {
    this.channel?.sendToQueue(
      this.streamKey,
      Buffer.from(JSON.stringify(data), "utf-8"),
      undefined,
      (err: any, _reply: Replies.Empty) => {
        if (err) {
          callback(err);
        } else {
          callback();
        }
      }
    );
  }
  _destroy(err: Error | null, callback: (err: Error | null) => void) {
    this.channel?.close().then(
      () => {
        callback(err);
      },
      () => {
        callback(err);
      }
    );
  }
}

export { AmqpDuplex };
