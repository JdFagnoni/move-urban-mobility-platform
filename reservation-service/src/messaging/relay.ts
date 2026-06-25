import { EXCHANGES, describeError, isConnected, logMessaging, publish } from "@move/shared";
import { OutboxEventModel } from "../db/models";
import { sequelize } from "../db/sequelize";

const POLL_INTERVAL_MS = 500;
const BATCH_SIZE = 50;

let timer: NodeJS.Timeout | null = null;
let draining = false;

export function startOutboxRelay(): void {
  if (timer !== null) {
    return;
  }
  timer = setInterval(() => {
    void drainOutbox();
  }, POLL_INTERVAL_MS);
}

async function drainOutbox(): Promise<void> {
  if (draining || !isConnected()) {
    return;
  }
  draining = true;
  try {
    let batchSize = 0;
    do {
      batchSize = await publishPendingBatch();
    } while (batchSize === BATCH_SIZE);
  } catch (error) {
    logMessaging("error", "outbox_relay_failed", { error: describeError(error) });
  } finally {
    draining = false;
  }
}

async function publishPendingBatch(): Promise<number> {
  return sequelize.transaction(async (transaction) => {
    const events = await OutboxEventModel.findAll({
      where: { status: "pending" },
      order: [["created_at", "ASC"]],
      limit: BATCH_SIZE,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
      transaction,
    });

    for (const event of events) {
      await publish(event.exchange || EXCHANGES.reservations, event.routingKey, event.payload, {
        messageId: event.id,
      });
      event.status = "published";
      event.publishedAt = new Date();
      await event.save({ transaction });
    }

    return events.length;
  });
}
