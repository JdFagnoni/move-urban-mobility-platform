import type { ConsumeMessage } from "amqplib";
import { createConsumerChannel, isConnected, onReconnect, type Channel } from "./connection";
import { positiveIntFromEnv } from "./env";
import { describeError, logMessaging } from "./log";
import { assertTopology } from "./topology";
import { EXCHANGES, deadLetterQueueName } from "./types";

const DEFAULT_PREFETCH = positiveIntFromEnv("RABBITMQ_PREFETCH", 20);
const DEFAULT_MAX_RETRIES = positiveIntFromEnv("RABBITMQ_MAX_RETRIES", 5);

export type MessageHandler<T> = (payload: T, raw: ConsumeMessage) => Promise<void>;

export interface ConsumeOptions {
  prefetch?: number;
  maxRetries?: number;
}

interface XDeathEntry {
  count?: number;
  queue?: string;
  reason?: string;
}

export async function consume<T>(
  queue: string,
  handler: MessageHandler<T>,
  options: ConsumeOptions = {}
): Promise<void> {
  const prefetch = options.prefetch ?? DEFAULT_PREFETCH;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  let channel: Channel | null = null;

  const startConsumer = async (): Promise<void> => {
    if (channel !== null) {
      return;
    }
    const consumerChannel = await createConsumerChannel(prefetch);
    channel = consumerChannel;
    consumerChannel.once("close", () => {
      if (channel === consumerChannel) {
        channel = null;
      }
    });
    await assertTopology(consumerChannel);
    await consumerChannel.consume(queue, (message) => {
      if (message === null) {
        return;
      }
      void handleDelivery(consumerChannel, queue, message, handler, maxRetries);
    });
    logMessaging("info", "consumer_started", { queue, prefetch });
  };

  onReconnect(startConsumer);
  if (isConnected()) {
    await startConsumer();
  }
}

async function handleDelivery<T>(
  channel: Channel,
  queue: string,
  message: ConsumeMessage,
  handler: MessageHandler<T>,
  maxRetries: number
): Promise<void> {
  const payload = parsePayload<T>(message);
  if (payload === undefined) {
    parkMessage(channel, queue, message);
    channel.ack(message);
    logMessaging("error", "message_unparseable_parked", {
      queue,
      messageId: message.properties.messageId,
    });
    return;
  }

  try {
    await handler(payload, message);
    channel.ack(message);
  } catch (error) {
    handleFailure(channel, queue, message, maxRetries, error);
  }
}

function handleFailure(
  channel: Channel,
  queue: string,
  message: ConsumeMessage,
  maxRetries: number,
  error: unknown
): void {
  const retries = rejectionCount(message, queue);
  if (retries >= maxRetries) {
    parkMessage(channel, queue, message);
    channel.ack(message);
    logMessaging("error", "message_parked", {
      queue,
      messageId: message.properties.messageId,
      retries,
      error: describeError(error),
    });
    return;
  }
  channel.nack(message, false, false);
  logMessaging("warn", "message_retry_scheduled", {
    queue,
    messageId: message.properties.messageId,
    retries,
    error: describeError(error),
  });
}

function parsePayload<T>(message: ConsumeMessage): T | undefined {
  try {
    return JSON.parse(message.content.toString()) as T;
  } catch {
    return undefined;
  }
}

export function rejectionCount(message: ConsumeMessage, queue: string): number {
  const header = message.properties.headers?.["x-death"];
  if (!Array.isArray(header)) {
    return 0;
  }
  const entries = header as XDeathEntry[];
  const entry = entries.find((item) => item.queue === queue && item.reason === "rejected");
  return typeof entry?.count === "number" ? entry.count : 0;
}

function parkMessage(channel: Channel, queue: string, message: ConsumeMessage): void {
  channel.publish(EXCHANGES.deadLetter, deadLetterQueueName(queue), message.content, {
    persistent: true,
    contentType: message.properties.contentType,
    messageId: message.properties.messageId,
    headers: message.properties.headers,
  });
}
