import "dotenv/config";
import { mkdir, writeFile } from "fs/promises";
import { resolve } from "path";
import { performance } from "perf_hooks";
import { loadEvaluationCategories } from "./category-catalog";
import { loadEvaluationDataset } from "./dataset";
import { warmSemanticSearchCache } from "../modules/semantic-search/service";
import { STRATEGY_QUALITATIVE_ASSESSMENTS } from "./qualitative-assessments";
import { renderSummaryMarkdown } from "./reporting";
import { resolveEvaluationStrategies } from "./strategies";
import type {
  CaseEvaluationResult,
  EvaluationDatasetEntry,
  StrategyAttemptResult,
  StrategyCaseResult,
  StrategySummary,
} from "./types";

interface CliOptions {
  repeats: number;
  outputDir: string;
  strategies: string[];
}

const PACKAGE_ROOT = resolve(__dirname, "../..");

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const categories = await loadEvaluationCategories();
  const dataset = loadEvaluationDataset(categories);
  const strategies = resolveEvaluationStrategies(options.strategies);

  if (strategies.some((strategy) => strategy.name === "semantic-search")) {
    await warmSemanticSearchCache();
  }

  const results: CaseEvaluationResult[] = [];

  for (const datasetEntry of dataset) {
    const strategyResults: StrategyCaseResult[] = [];

    for (const strategy of strategies) {
      const attempts: StrategyAttemptResult[] = [];

      for (let attempt = 1; attempt <= options.repeats; attempt += 1) {
        const startedAt = performance.now();
        const decision = await strategy.evaluate({
          description: datasetEntry.description,
          availableCategories: categories,
        });
        const durationMs = performance.now() - startedAt;

        const attemptResult: StrategyAttemptResult = {
          attempt,
          durationMs,
          outcome: decision.outcome,
          categoryId: decision.categoryId,
          isCorrect: isDecisionCorrect(datasetEntry, decision),
          ...(decision.rawLabel !== undefined ? { rawLabel: decision.rawLabel } : {}),
          ...(decision.error !== undefined ? { error: decision.error } : {}),
        };

        attempts.push(attemptResult);
      }

      strategyResults.push({
        strategy: strategy.name,
        attempts,
        firstAttemptCorrect: attempts[0]?.isCorrect ?? false,
      });
    }

    const caseResult: CaseEvaluationResult = {
      id: datasetEntry.id,
      description: datasetEntry.description,
      expectedOutcome: datasetEntry.expectedOutcome,
      expectedCategoryId: datasetEntry.expectedCategoryId,
      strategies: strategyResults,
      ...(datasetEntry.notes !== undefined ? { notes: datasetEntry.notes } : {}),
    };

    results.push(caseResult);
  }

  const summaries = summarizeResults(
    results,
    strategies.map((strategy) => strategy.name)
  );
  const summaryMarkdown = renderSummaryMarkdown(
    summaries,
    STRATEGY_QUALITATIVE_ASSESSMENTS,
    options.repeats
  );

  await mkdir(options.outputDir, { recursive: true });
  await Promise.all([
    writeJson(resolve(options.outputDir, "results.json"), results),
    writeJson(resolve(options.outputDir, "summary.json"), summaries),
    writeFile(resolve(options.outputDir, "summary.md"), summaryMarkdown, "utf8"),
  ]);

  console.log(
    `R10 evaluation completed. Results written to ${options.outputDir} for strategies: ${strategies.map(({ name }) => name).join(", ")}`
  );
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    repeats: 5,
    outputDir: resolve(PACKAGE_ROOT, "evaluation-results/r10"),
    strategies: [],
  };

  for (const arg of args) {
    if (arg.startsWith("--repeats=")) {
      const repeats = Number(arg.slice("--repeats=".length));
      if (!Number.isInteger(repeats) || repeats <= 0) {
        throw new Error(`Invalid repeats value: ${arg}`);
      }
      options.repeats = repeats;
      continue;
    }

    if (arg.startsWith("--output-dir=")) {
      const outputDir = arg.slice("--output-dir=".length).trim();
      if (!outputDir) {
        throw new Error(`Invalid output-dir value: ${arg}`);
      }
      options.outputDir = resolve(PACKAGE_ROOT, outputDir);
      continue;
    }

    if (arg.startsWith("--strategies=")) {
      const strategies = arg
        .slice("--strategies=".length)
        .split(",")
        .map((strategy) => strategy.trim())
        .filter((strategy) => strategy.length > 0);
      options.strategies = strategies;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function isDecisionCorrect(
  expected: EvaluationDatasetEntry,
  actual: { outcome: string; categoryId: string | null }
): boolean {
  if (expected.expectedOutcome !== actual.outcome) {
    return false;
  }

  return expected.expectedCategoryId === actual.categoryId;
}

function summarizeResults(
  results: CaseEvaluationResult[],
  strategyNames: string[]
): StrategySummary[] {
  return strategyNames.map((strategyName) => {
    const strategyResults = results.flatMap((result) =>
      result.strategies.filter((strategy) => strategy.strategy === strategyName)
    );
    const attempts = strategyResults.flatMap((strategyResult) => strategyResult.attempts);
    const firstAttempts = strategyResults
      .map((strategyResult) => strategyResult.attempts[0])
      .filter((attempt): attempt is StrategyAttemptResult => attempt !== undefined);
    const classifiableCases = results.filter(
      (result) => result.expectedOutcome === "classified"
    ).length;
    const fallbackCases = results.length - classifiableCases;
    const correctlyClassifiedCases = results.filter((result) =>
      result.expectedOutcome === "classified" ? wasFirstAttemptCorrect(result, strategyName) : false
    ).length;
    const correctlyHandledFallbackCases = results.filter((result) =>
      result.expectedOutcome === "operator_fallback"
        ? wasFirstAttemptCorrect(result, strategyName)
        : false
    ).length;
    const latencies = attempts.map((attempt) => attempt.durationMs).sort((a, b) => a - b);

    return {
      strategy: toStrategyName(strategyName),
      displayName: getStrategyDisplayName(strategyName),
      totalCases: results.length,
      correctCases: firstAttempts.filter((attempt) => attempt.isCorrect).length,
      accuracy: ratio(firstAttempts.filter((attempt) => attempt.isCorrect).length, results.length),
      classifiableCases,
      correctlyClassifiedCases,
      classificationPrecision: ratio(correctlyClassifiedCases, classifiableCases),
      fallbackCases,
      correctlyHandledFallbackCases,
      fallbackCorrectness: ratio(correctlyHandledFallbackCases, fallbackCases),
      averageLatencyMs: average(latencies),
      p95LatencyMs: percentile(latencies, 0.95),
      errorRate: ratio(
        attempts.filter((attempt) => attempt.error !== undefined && attempt.error.length > 0)
          .length,
        attempts.length
      ),
    };
  });
}

function wasFirstAttemptCorrect(result: CaseEvaluationResult, strategyName: string): boolean {
  return (
    result.strategies.find((strategy) => strategy.strategy === strategyName)?.firstAttemptCorrect ??
    false
  );
}

function toStrategyName(strategyName: string): StrategySummary["strategy"] {
  if (
    strategyName === "local-generative-ai" ||
    strategyName === "semantic-search" ||
    strategyName === "keyword-baseline"
  ) {
    return strategyName;
  }

  throw new Error(`Unknown strategy name '${strategyName}'`);
}

function getStrategyDisplayName(strategyName: string): string {
  switch (strategyName) {
    case "local-generative-ai":
      return "IA generativa local";
    case "semantic-search":
      return "Búsqueda semántica";
    case "keyword-baseline":
      return "Baseline determinístico";
    default:
      throw new Error(`Unknown strategy name '${strategyName}'`);
  }
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) {
    return 0;
  }

  const index = Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1);
  return values[index] ?? 0;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(message);
  process.exitCode = 1;
});
