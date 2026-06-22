import type { ClassificationRequestedEvent } from "@move/shared";
import { sequelize } from "../db/sequelize";
import { classifyGood } from "../clients/categorizer";
import {
  createClassificationNotification,
  finalizeClassification,
  loadReservationWithRelations,
  sortCargoItemsByCreatedAt,
} from "../modules/reservations/service";

export async function handleClassificationRequested(
  event: ClassificationRequestedEvent
): Promise<void> {
  const reservation = await loadReservationWithRelations(event.reservationId);
  if (!reservation || reservation.status !== "pending_classification") {
    // Idempotente: ya se resolvio manualmente, se cancelo, o es una entrega
    // duplicada de la misma reserva.
    return;
  }

  const cargoItems = sortCargoItemsByCreatedAt(reservation.cargoItems ?? []);

  // Si classifyGood lanza (categorizer-service caido/timeout), la excepcion
  // sube sin capturar y el framework de consumers reintenta automaticamente.
  await Promise.all(
    cargoItems
      .filter((cargoItem) => cargoItem.categoryId === null)
      .map(async (cargoItem) => {
        cargoItem.categoryId = await classifyGood(cargoItem.description);
      })
  );

  if (cargoItems.some((cargoItem) => cargoItem.categoryId === null)) {
    // Resultado de negocio determinístico (no una falla transitoria): no
    // tiene sentido reintentar, se guarda el progreso y se notifica al
    // operador (F19).
    await sequelize.transaction(async (transaction) => {
      await Promise.all(cargoItems.map((cargoItem) => cargoItem.save({ transaction })));
      await createClassificationNotification(reservation.id, transaction);
    });
    return;
  }

  await finalizeClassification(reservation, cargoItems);
}
