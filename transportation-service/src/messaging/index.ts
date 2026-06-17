import {
  QUEUES,
  consume,
  startMessaging,
  type GpsSignalIngestedEvent,
  type ReservationAssignedEvent,
} from "@move/shared";
import { ensureTripForReservation } from "../modules/trips/service";
import { detectAndAlert } from "../modules/alerts/service";

export function startTransportationMessaging(): void {
  void registerConsumers();
  startMessaging();
}

async function registerConsumers(): Promise<void> {
  await consume<ReservationAssignedEvent>(QUEUES.tripCreation, ensureTripForReservation);
  await consume<GpsSignalIngestedEvent>(QUEUES.gpsDetection, detectAndAlert);
}
