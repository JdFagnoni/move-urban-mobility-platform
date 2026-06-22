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
  // maxRetries bastante mas alto que el default (5): cada categoria
  // creada/editada/borrada dispara un refresh completo del cache semantico de
  // categorizer-service (category.changed), que devuelve 503 ("cache still
  // warming") mientras recalcula embeddings para todas las categorias -- no
  // solo la nueva. Medido entre 30s y mas de 2 minutos segun carga. Con el
  // default de 5 reintentos (~25s con el TTL de 5s) el mensaje se parqueaba en
  // dead-letter antes de que el refresh terminara, dejando la reserva en
  // pending_classification para siempre sin notificar al operador. Si esto
  // sigue pasando en la practica, la causa raiz esta en que categorizer-service
  // recalcula TODAS las categorias ante cualquier cambio en vez de solo la
  // afectada -- no en este retry budget.
  await consume<ClassificationRequestedEvent>(
    QUEUES.reservationClassification,
    handleClassificationRequested,
    { prefetch: 5, maxRetries: 30 }
  );
}
