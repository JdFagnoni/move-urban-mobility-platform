import { HttpError, type GeoPoint } from "@move/shared";
import { CompanyLocationModel } from "../../../db/models";
import { refreshCompanyLocationCacheForClient, getCachedCompanyLocation } from "../fast-path-cache";
import { requireGeoPoint } from "./validate-common-input";

type CompanyLocationKindTarget = "origin" | "destination";

interface ResolveCompanyLocationInput {
  clientId: string;
  expectedKind: CompanyLocationKindTarget;
  locationId?: string;
  location?: GeoPoint;
  preferCache?: boolean;
}

export async function resolveCompanyLocation(
  input: ResolveCompanyLocationInput
): Promise<GeoPoint> {
  if (input.locationId && input.location) {
    throw new HttpError(
      400,
      `${input.expectedKind} and ${input.expectedKind}LocationId cannot be combined`,
      "invalid_company_location"
    );
  }

  if (!input.locationId) {
    return requireGeoPoint(input.location, input.expectedKind, "invalid_company_location");
  }

  if (input.preferCache) {
    const cachedLocation = await getCachedCompanyLocation(input.clientId, input.locationId);
    if (cachedLocation) {
      if (cachedLocation.kind !== input.expectedKind && cachedLocation.kind !== "both") {
        throw new HttpError(
          400,
          `${input.expectedKind}LocationId is not valid for ${input.expectedKind}`,
          "invalid_company_location"
        );
      }

      return cachedLocation.location;
    }
  }

  const row = await CompanyLocationModel.findOne({
    where: { id: input.locationId, clientId: input.clientId },
  });

  if (!row) {
    throw new HttpError(404, "Company location not found", "company_location_not_found");
  }

  if (row.kind !== input.expectedKind && row.kind !== "both") {
    throw new HttpError(
      400,
      `${input.expectedKind}LocationId is not valid for ${input.expectedKind}`,
      "invalid_company_location"
    );
  }

  if (input.preferCache) {
    void refreshCompanyLocationCacheForClient(input.clientId);
  }

  return row.location;
}
