import type { CategoryDTO } from "@move/shared";
import datasetEntries from "./data/dataset.json";
import type { EvaluationDatasetEntry } from "./types";

export function loadEvaluationDataset(
  availableCategories: CategoryDTO[]
): EvaluationDatasetEntry[] {
  const dataset = datasetEntries as EvaluationDatasetEntry[];
  validateDataset(dataset, availableCategories);
  return dataset;
}

function validateDataset(
  dataset: EvaluationDatasetEntry[],
  availableCategories: CategoryDTO[]
): void {
  if (dataset.length < 30 || dataset.length > 50) {
    throw new Error(
      `R10 dataset must contain between 30 and 50 cases. Received: ${dataset.length}`
    );
  }

  const categoryIds = new Set(availableCategories.map((category) => category.id));
  const caseIds = new Set<string>();

  for (const entry of dataset) {
    if (caseIds.has(entry.id)) {
      throw new Error(`Duplicate dataset id detected: ${entry.id}`);
    }
    caseIds.add(entry.id);

    if (!entry.description.trim()) {
      throw new Error(`Dataset entry ${entry.id} has an empty description`);
    }

    if (entry.expectedOutcome === "classified") {
      if (!entry.expectedCategoryId) {
        throw new Error(`Dataset entry ${entry.id} must define expectedCategoryId`);
      }

      if (!categoryIds.has(entry.expectedCategoryId)) {
        throw new Error(
          `Dataset entry ${entry.id} references unknown category ${entry.expectedCategoryId}`
        );
      }
      continue;
    }

    if (entry.expectedCategoryId !== null) {
      throw new Error(
        `Dataset entry ${entry.id} must use null expectedCategoryId for operator_fallback`
      );
    }
  }
}
