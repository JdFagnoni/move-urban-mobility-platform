import type { QualitativeAssessment, StrategyName } from "./types";

export const STRATEGY_QUALITATIVE_ASSESSMENTS: Record<StrategyName, QualitativeAssessment> = {
  "local-generative-ai": {
    implementationComplexity: "Medium",
    operationalComplexity: "High",
    infrastructureDependencies: "High",
    observabilityDebuggability: "Medium",
    expectedProductionRisk: "Medium",
    notes:
      "Requires a local model and inference runtime. It offers semantic flexibility, but increases environment dependency and response-time variability.",
  },
  "semantic-search": {
    implementationComplexity: "Medium",
    operationalComplexity: "Medium",
    infrastructureDependencies: "Medium",
    observabilityDebuggability: "Medium",
    expectedProductionRisk: "Medium",
    notes:
      "Requires embedding generation and threshold calibration. It is easier to reason about than a generative LLM, but still depends on embedding components and tuning.",
  },
  "keyword-baseline": {
    implementationComplexity: "Low",
    operationalComplexity: "Low",
    infrastructureDependencies: "Low",
    observabilityDebuggability: "High",
    expectedProductionRisk: "High",
    notes:
      "Requires no additional infrastructure and is easy to explain. It works well as a baseline, but is brittle against paraphrases, noisy inputs, and ambiguous descriptions.",
  },
};
