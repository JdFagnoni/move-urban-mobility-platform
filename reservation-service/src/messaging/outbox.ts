import type { Transaction } from "sequelize";
import { OutboxEventModel } from "../db/models";

export interface OutboxEventInput {
  aggregateId: string;
  type: string;
  routingKey: string;
  payload: Record<string, unknown>;
}

export async function enqueueOutboxEvent(
  input: OutboxEventInput,
  transaction: Transaction
): Promise<void> {
  await OutboxEventModel.create(
    {
      id: crypto.randomUUID(),
      aggregateId: input.aggregateId,
      type: input.type,
      routingKey: input.routingKey,
      payload: input.payload,
      status: "pending",
    },
    { transaction }
  );
}
