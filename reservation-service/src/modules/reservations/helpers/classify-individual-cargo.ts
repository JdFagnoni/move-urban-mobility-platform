import type { ReservationStatus } from "@move/shared";
import { classifyGood } from "../../../clients/categorizer";
import type { NormalizedCargoItemInput, PreparedCargoItemInput } from "./types";

interface ClassifiedCargoResult {
  cargoItems: PreparedCargoItemInput[];
  status: ReservationStatus;
}

export async function classifyIndividualCargo(
  cargoItems: NormalizedCargoItemInput[]
): Promise<ClassifiedCargoResult> {
  const categoryIds = await Promise.all(cargoItems.map((item) => classifyGood(item.description)));
  const status: ReservationStatus = categoryIds.every((categoryId) => categoryId !== null)
    ? "pending_quote"
    : "pending_classification";

  return {
    status,
    cargoItems: cargoItems.map((item, index) => ({
      description: item.description,
      estimatedValue: item.estimatedValue,
      size: item.size,
      categoryId: categoryIds[index] ?? null,
    })),
  };
}
