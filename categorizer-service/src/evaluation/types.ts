export type EvaluationOutcome = "classified" | "operator_fallback";

export type StrategyName = "local-generative-ai" | "semantic-search" | "keyword-baseline";

export interface EvaluationDatasetEntry {
  id: string;
  description: string;
  expectedOutcome: EvaluationOutcome;
  expectedCategoryId: string | null;
  notes?: string;
}

export interface StrategyDecision {
  outcome: EvaluationOutcome;
  categoryId: string | null;
  rawLabel?: string;
  error?: string;
}

export interface StrategyAttemptResult extends StrategyDecision {
  attempt: number;
  durationMs: number;
  isCorrect: boolean;
}

export interface StrategyCaseResult {
  strategy: StrategyName;
  attempts: StrategyAttemptResult[];
  firstAttemptCorrect: boolean;
}

export interface CaseEvaluationResult {
  id: string;
  description: string;
  expectedOutcome: EvaluationOutcome;
  expectedCategoryId: string | null;
  notes?: string;
  strategies: StrategyCaseResult[];
}

export interface StrategySummary {
  strategy: StrategyName;
  displayName: string;
  totalCases: number;
  correctCases: number;
  accuracy: number;
  classifiableCases: number;
  correctlyClassifiedCases: number;
  classificationPrecision: number;
  fallbackCases: number;
  correctlyHandledFallbackCases: number;
  fallbackCorrectness: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
}

export interface QualitativeAssessment {
  implementationComplexity: "Low" | "Medium" | "High";
  operationalComplexity: "Low" | "Medium" | "High";
  infrastructureDependencies: "Low" | "Medium" | "High";
  observabilityDebuggability: "Low" | "Medium" | "High";
  expectedProductionRisk: "Low" | "Medium" | "High";
  notes: string;
}
