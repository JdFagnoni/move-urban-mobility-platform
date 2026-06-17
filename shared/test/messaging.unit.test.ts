import assert from "node:assert/strict";
import { test } from "node:test";
import {
  QUEUES,
  WORK_QUEUES,
  deadLetterQueueName,
  rejectionCount,
  retryQueueName,
} from "@move/shared";

function messageWithDeaths(deaths: unknown): { properties: { headers: Record<string, unknown> } } {
  return { properties: { headers: { "x-death": deaths } } };
}

test("retryQueueName y deadLetterQueueName derivan los nombres por convencion", () => {
  assert.equal(retryQueueName("gps.detection"), "gps.detection.retry");
  assert.equal(deadLetterQueueName("gps.detection"), "gps.detection.dlq");
});

test("cada cola de trabajo se enruta desde un exchange con su routing key", () => {
  const names = WORK_QUEUES.map((definition) => definition.name);
  assert.deepEqual(
    [...names].sort(),
    [QUEUES.gpsDetection, QUEUES.notificationsEmail, QUEUES.tripCreation].sort()
  );
  for (const definition of WORK_QUEUES) {
    assert.ok(definition.exchange.length > 0);
    assert.ok(definition.routingKey.length > 0);
  }
});

test("rejectionCount es 0 cuando no hay header x-death", () => {
  const message = { properties: { headers: {} } } as never;
  assert.equal(rejectionCount(message, "gps.detection"), 0);
});

test("rejectionCount cuenta los rechazos de la cola principal", () => {
  const message = messageWithDeaths([
    { queue: "gps.detection", reason: "rejected", count: 3 },
    { queue: "gps.detection.retry", reason: "expired", count: 3 },
  ]) as never;
  assert.equal(rejectionCount(message, "gps.detection"), 3);
});

test("rejectionCount ignora entradas de otras colas y razones", () => {
  const message = messageWithDeaths([
    { queue: "other.queue", reason: "rejected", count: 9 },
    { queue: "gps.detection", reason: "expired", count: 7 },
  ]) as never;
  assert.equal(rejectionCount(message, "gps.detection"), 0);
});
