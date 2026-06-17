import { randomUUID } from "crypto";
import { getPublishChannel } from "./connection";
import { logMessaging } from "./log";

export interface PublishOptions {
  messageId?: string;
}

export async function publish(
  exchange: string,
  routingKey: string,
  message: unknown,
  options: PublishOptions = {}
): Promise<void> {
  const channel = getPublishChannel();
  const messageId = options.messageId ?? randomUUID();
  const content = Buffer.from(JSON.stringify(message));

  await new Promise<void>((resolve, reject) => {
    channel.publish(
      exchange,
      routingKey,
      content,
      { persistent: true, contentType: "application/json", messageId },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      }
    );
  });

  logMessaging("info", "message_published", { exchange, routingKey, messageId });
}
