import { QUEUES, consume, startMessaging, type ReservationAssignedEvent } from "@move/shared";
import { ensureTripForReservation } from "../modules/trips/service";

export function startTransportationMessaging(): void {
  void registerConsumers();
  startMessaging();
}

async function registerConsumers(): Promise<void> {
  await consume<ReservationAssignedEvent>(QUEUES.tripCreation, ensureTripForReservation);
}
