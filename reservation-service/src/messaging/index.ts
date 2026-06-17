import { QUEUES, consume, startMessaging, type ReservationUnsupportedEvent } from "@move/shared";
import { sendUnsupportedReservationEmail } from "./email-consumer";
import { startOutboxRelay } from "./relay";

export function startReservationMessaging(): void {
  void registerConsumers();
  startMessaging();
  startOutboxRelay();
}

async function registerConsumers(): Promise<void> {
  await consume<ReservationUnsupportedEvent>(
    QUEUES.notificationsEmail,
    sendUnsupportedReservationEmail
  );
}
