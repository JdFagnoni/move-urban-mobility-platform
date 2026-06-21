import {
  QUEUES,
  consume,
  startMessaging,
  type ClassificationRequestedEvent,
  type ReservationUnsupportedEvent,
} from "@move/shared";
import { handleClassificationRequested } from "./classification-consumer";
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
  // prefetch mas bajo: cada mensaje dispara llamadas HTTP al categorizer-service.
  await consume<ClassificationRequestedEvent>(
    QUEUES.reservationClassification,
    handleClassificationRequested,
    { prefetch: 5 }
  );
}
