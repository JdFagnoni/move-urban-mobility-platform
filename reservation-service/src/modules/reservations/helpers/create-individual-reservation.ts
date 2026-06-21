import { HttpError, type CreateReservationDTO } from "@move/shared";
import type { NormalizedCargoItemInput, PreparedReservationCreation } from "./types";
import { requireGeoPoint } from "./validate-common-input";

interface CreateIndividualReservationInput {
  dto: CreateReservationDTO;
  cargoItems: NormalizedCargoItemInput[];
}

export async function createIndividualReservation(
  input: CreateIndividualReservationInput
): Promise<PreparedReservationCreation> {
  if (input.dto.originLocationId !== undefined) {
    throw new HttpError(
      400,
      "originLocationId is not allowed for individual clients",
      "invalid_reservation"
    );
  }

  if (input.dto.destinationLocationId !== undefined) {
    throw new HttpError(
      400,
      "destinationLocationId is not allowed for individual clients",
      "invalid_reservation"
    );
  }

  const hasCompanyProductReference = input.cargoItems.some(
    (cargoItem) => cargoItem.companyProductId !== undefined
  );
  if (hasCompanyProductReference) {
    throw new HttpError(
      400,
      "companyProductId is not allowed for individual clients",
      "invalid_reservation"
    );
  }

  const origin = requireGeoPoint(input.dto.origin, "origin");
  const destination = requireGeoPoint(input.dto.destination, "destination");

  // La clasificacion se hace de forma asincrona (ver
  // messaging/classification-consumer.ts): la reserva arranca siempre en
  // pending_classification, sin categoria, y un worker la resuelve en
  // segundo plano.
  return {
    origin,
    destination,
    status: "pending_classification",
    cargoItems: input.cargoItems.map((item) => ({
      description: item.description,
      estimatedValue: item.estimatedValue,
      size: item.size,
      categoryId: null,
    })),
  };
}
