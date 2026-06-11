import type { CategorizationStrategyInput } from "../strategies/types";
import { diagnoseGenerativeAiClassification } from "../strategies/generative-ai/strategy";
import { diagnoseKeywordClassification } from "../strategies/keyword/strategy";
import { diagnoseSemanticSearchClassification } from "../strategies/semantic-search/strategy";
import type { StrategyDecision, StrategyName } from "./types";

export interface EvaluationStrategyDefinition {
  name: StrategyName;
  displayName: string;
  evaluate(input: CategorizationStrategyInput): Promise<StrategyDecision>;
}

export const EVALUATION_STRATEGIES: readonly EvaluationStrategyDefinition[] = [
  {
    name: "local-generative-ai",
    displayName: "IA generativa local",
    evaluate: async (input) => normalizeDecision(await diagnoseGenerativeAiClassification(input)),
  },
  {
    name: "semantic-search",
    displayName: "Búsqueda semántica",
    evaluate: async (input) => normalizeDecision(await diagnoseSemanticSearchClassification(input)),
  },
  {
    name: "keyword-baseline",
    displayName: "Baseline determinístico",
    evaluate: async (input) => normalizeDecision(diagnoseKeywordClassification(input)),
  },
] as const;

export function resolveEvaluationStrategies(strategyNames: string[]): EvaluationStrategyDefinition[] {
  if (strategyNames.length === 0) {
    return [...EVALUATION_STRATEGIES];
  }

  const byName = new Map(EVALUATION_STRATEGIES.map((strategy) => [strategy.name, strategy]));

  return strategyNames.map((strategyName) => {
    const strategy = byName.get(strategyName as StrategyName);
    if (!strategy) {
      throw new Error(
        `Unknown strategy '${strategyName}'. Valid options: ${EVALUATION_STRATEGIES.map(({ name }) => name).join(", ")}`
      );
    }

    return strategy;
  });
}

function normalizeDecision(result: {
  categoryId: string | null;
  rawLabel?: string;
  error?: string;
}): StrategyDecision {
  return {
    outcome: result.categoryId === null ? "operator_fallback" : "classified",
    categoryId: result.categoryId,
    ...(result.rawLabel !== undefined ? { rawLabel: result.rawLabel } : {}),
    ...(result.error !== undefined ? { error: result.error } : {}),
  };
}
