import { recordExternalCall, type CategoryDTO } from "@move/shared";

function getReservationsBaseUrl(): string {
  const url = process.env["RESERVATIONS_URL"];
  if (!url) {
    throw new Error("RESERVATIONS_URL is not configured");
  }
  return url.replace(/\/+$/u, "");
}

interface CategoriesResponse {
  success: boolean;
  data: CategoryDTO[];
}

export async function loadActiveCategories(): Promise<CategoryDTO[]> {
  const start = Date.now();
  let response: Response;

  try {
    response = await fetch(`${getReservationsBaseUrl()}/categories`);
    recordExternalCall(
      "reservation-service",
      response.ok ? "success" : "error",
      Date.now() - start
    );
  } catch (error) {
    recordExternalCall("reservation-service", "error", Date.now() - start);
    throw new Error(
      `Failed to fetch categories from reservation-service: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch categories from reservation-service: HTTP ${response.status}`);
  }

  const body = (await response.json()) as CategoriesResponse;
  return body.data.filter((category) => category.active);
}
