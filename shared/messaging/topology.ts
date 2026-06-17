import type { Channel } from "./connection";
import { positiveIntFromEnv } from "./env";
import {
  EXCHANGES,
  WORK_QUEUES,
  deadLetterQueueName,
  retryQueueName,
  type WorkQueueDefinition,
} from "./types";

const RETRY_TTL_MS = positiveIntFromEnv("RABBITMQ_RETRY_TTL_MS", 5_000);

export async function assertTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(EXCHANGES.reservations, "topic", { durable: true });
  await channel.assertExchange(EXCHANGES.gps, "topic", { durable: true });
  await channel.assertExchange(EXCHANGES.deadLetter, "topic", { durable: true });

  for (const definition of WORK_QUEUES) {
    await assertWorkQueue(channel, definition);
  }
}

async function assertWorkQueue(channel: Channel, definition: WorkQueueDefinition): Promise<void> {
  const retryQueue = retryQueueName(definition.name);
  const deadLetterQueue = deadLetterQueueName(definition.name);

  await channel.assertQueue(definition.name, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": EXCHANGES.deadLetter,
      "x-dead-letter-routing-key": retryQueue,
    },
  });
  await channel.bindQueue(definition.name, definition.exchange, definition.routingKey);

  await channel.assertQueue(retryQueue, {
    durable: true,
    arguments: {
      "x-message-ttl": RETRY_TTL_MS,
      "x-dead-letter-exchange": definition.exchange,
      "x-dead-letter-routing-key": definition.routingKey,
    },
  });
  await channel.bindQueue(retryQueue, EXCHANGES.deadLetter, retryQueue);

  await channel.assertQueue(deadLetterQueue, { durable: true });
  await channel.bindQueue(deadLetterQueue, EXCHANGES.deadLetter, deadLetterQueue);
}
