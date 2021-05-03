import "reflect-metadata";
import { connect } from "amqplib";
import { AmqpDuplex } from "./amqp-duplex";
import { delay } from "../utils";
import dotenv from "dotenv";

dotenv.config({ path: process.cwd() + "/.env.test" });

describe("AmqpDuplex", () => {
  describe("constructor", () => {
    it("should create a confirmChannel given a connection", async () => {
      const connection = await connect({
        hostname: process.env.RABBITMQ_HOSTNAME,
        protocol: "amqp",
        port: +(<any>process.env.RABBITMQ_PORT),
      });
      const amqpDuplex = new AmqpDuplex(10, "test", connection);
      await delay(1000);
      const channel = Reflect.get(amqpDuplex, "channel");
      expect(channel).toBeDefined();
      amqpDuplex.destroy();
      await delay(200);
      connection.close();
    });
  });
  describe("write", () => {
    it("should send a message to the specified queue", async () => {
      const connection = await connect({
        hostname: process.env.RABBITMQ_HOSTNAME,
        protocol: "amqp",
        port: +(<any>process.env.RABBITMQ_PORT),
      });
      const amqpDuplex = new AmqpDuplex(10, "test", connection);
      await delay(1000);
      const channel = Reflect.get(amqpDuplex, "channel");
      const sendToQueueSpy = jest.spyOn(channel, "sendToQueue");
      amqpDuplex.write({ test: "test" });
      await delay(500);
      expect(sendToQueueSpy).toHaveBeenCalledTimes(1);
      amqpDuplex.destroy();
      await delay(200);
      connection.close();
    });
  });
  describe("read", () => {
    it("should retrieve a message if one is present in queue, switching duplex into reading mode", async () => {
      const connection = await connect({
        hostname: process.env.RABBITMQ_HOSTNAME,
        protocol: "amqp",
        port: +(<any>process.env.RABBITMQ_PORT),
      });
      const amqpDuplex1 = new AmqpDuplex(10, "test", connection);
      const amqpDuplex2 = new AmqpDuplex(10, "test", connection);
      await delay(1000);
      amqpDuplex2.on("readable", () => {
        const data = amqpDuplex2.read(1);
        expect(data).toEqual({ test: "test" });
      });
      amqpDuplex2.read();
      await delay(200);
      amqpDuplex1.write({ test: "test" });
      await delay(500);
      expect(Reflect.get(amqpDuplex2, "readMode")).toBeTruthy();
      await delay(500);
      amqpDuplex1.destroy();
      amqpDuplex2.destroy();
      await delay(200);
      connection.close();
    });
  });
});
