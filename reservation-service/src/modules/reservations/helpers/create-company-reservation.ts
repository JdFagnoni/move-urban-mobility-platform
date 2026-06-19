import type { CreateReservationDTO, UserDTO } from "@move/shared";
import { resolveCompanyLocation } from "./resolve-company-location";
import { resolveCompanyProducts } from "./resolve-company-products";
import type { NormalizedCargoItemInput, PreparedReservationCreation } from "./types";

interface CreateCompanyReservationInput {
  dto: CreateReservationDTO;
  clientUser: UserDTO;
  cargoItems: NormalizedCargoItemInput[];
  preferCache?: boolean;
}

export async function createCompanyReservation(
  input: CreateCompanyReservationInput
): Promise<PreparedReservationCreation> {
  const origin = await resolveCompanyLocation({
    clientId: input.clientUser.id,
    expectedKind: "origin",
    ...(input.preferCache !== undefined ? { preferCache: input.preferCache } : {}),
    ...(input.dto.originLocationId ? { locationId: input.dto.originLocationId } : {}),
    ...(input.dto.origin ? { location: input.dto.origin } : {}),
  });
  const destination = await resolveCompanyLocation({
    clientId: input.clientUser.id,
    expectedKind: "destination",
    ...(input.preferCache !== undefined ? { preferCache: input.preferCache } : {}),
    ...(input.dto.destinationLocationId ? { locationId: input.dto.destinationLocationId } : {}),
    ...(input.dto.destination ? { location: input.dto.destination } : {}),
  });
  const preparedCargoItems = await resolveCompanyProducts(
    input.clientUser.id,
    input.cargoItems,
    input.preferCache !== undefined ? { preferCache: input.preferCache } : undefined
  );

  return {
    origin,
    destination,
    status: "pending_quote",
    cargoItems: preparedCargoItems,
  };
}
