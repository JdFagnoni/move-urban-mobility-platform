import { HttpError, type CreateReservationDTO } from "@move/shared";
import { classifyIndividualCargo } from "./classify-individual-cargo";
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
  const classifiedCargo = await classifyIndividualCargo(input.cargoItems);

  return {
    origin,
    destination,
    status: classifiedCargo.status,
    cargoItems: classifiedCargo.cargoItems,
  };
}
