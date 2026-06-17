import { startMessaging } from "@move/shared";
import { startOutboxRelay } from "./relay";

export function startReservationMessaging(): void {
  startMessaging();
  startOutboxRelay();
}
