import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import {
  EXCHANGES,
  QUEUES,
  ROUTING_KEYS,
  consume,
  deadLetterQueueName,
  isConnected,
  publish,
  startMessaging,
  stopMessaging,
} from "@move/shared";

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return true;
    }
    await sleep(100);
  }
  return predicate();
}

before(async () => {
  startMessaging();
  const connected = await waitFor(() => isConnected(), 15_000);
  assert.ok(connected, "no se pudo conectar a RabbitMQ");
});

after(async () => {
  await stopMessaging();
});

test("publish/consume entrega el evento publicado al handler", async () => {
  let received: unknown = null;
  await consume(QUEUES.tripCreation, async (payload) => {
    received = payload;
  });

  const event = { reservationId: randomUUID(), vehicleId: randomUUID(), driverId: randomUUID() };
  await publish(EXCHANGES.reservations, ROUTING_KEYS.reservationAssigned, event);

  const delivered = await waitFor(() => received !== null, 8_000);
  assert.ok(delivered, "el handler no recibio el evento");
  assert.deepEqual(received, event);
});

test("un handler que falla reintenta y termina parqueado en la DLQ", async () => {
  let parked: unknown = null;
  await consume(QUEUES.gpsDetection, async () => {
    throw new Error("fallo inyectado");
  });
  await consume(deadLetterQueueName(QUEUES.gpsDetection), async (payload) => {
    parked = payload;
  });

  const signal = { vehicleId: randomUUID(), marker: "to-dlq" };
  await publish(EXCHANGES.gps, ROUTING_KEYS.gpsSignalIngested, signal);

  const reachedDlq = await waitFor(() => parked !== null, 15_000);
  assert.ok(reachedDlq, "el mensaje no llego a la DLQ tras agotar los reintentos");
  assert.deepEqual(parked, signal);
});
