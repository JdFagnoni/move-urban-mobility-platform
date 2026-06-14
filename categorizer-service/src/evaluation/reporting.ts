import type { QualitativeAssessment, StrategySummary } from "./types";

export function renderSummaryMarkdown(
  summaries: StrategySummary[],
  assessments: Record<string, QualitativeAssessment>,
  repeats: number
): string {
  const lines: string[] = [];
  lines.push("# R10 Evaluation Summary");
  lines.push("");
  lines.push(`- Repeticiones por caso: ${repeats}`);
  lines.push(`- Estrategias evaluadas: ${summaries.length}`);
  lines.push("");
  lines.push(
    "| Estrategia | Accuracy | Precisión clasificación | Correctitud fallback | Latencia promedio (ms) | p95 (ms) | Error rate |"
  );
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");

  for (const summary of summaries) {
    lines.push(
      `| ${summary.displayName} | ${toPercent(summary.accuracy)} | ${toPercent(summary.classificationPrecision)} | ${toPercent(summary.fallbackCorrectness)} | ${summary.averageLatencyMs.toFixed(2)} | ${summary.p95LatencyMs.toFixed(2)} | ${toPercent(summary.errorRate)} |`
    );
  }

  lines.push("");
  lines.push("## Evaluación cualitativa");
  lines.push("");

  for (const summary of summaries) {
    const assessment = assessments[summary.strategy];
    if (!assessment) {
      continue;
    }

    lines.push(`### ${summary.displayName}`);
    lines.push("");
    lines.push(`- Complejidad de implementación: ${assessment.implementationComplexity}`);
    lines.push(`- Complejidad operativa: ${assessment.operationalComplexity}`);
    lines.push(`- Dependencias de infraestructura: ${assessment.infrastructureDependencies}`);
    lines.push(`- Observabilidad y depuración: ${assessment.observabilityDebuggability}`);
    lines.push(`- Riesgo esperado en producción: ${assessment.expectedProductionRisk}`);
    lines.push(`- Nota: ${assessment.notes}`);
    lines.push("");
  }

  return lines.join("\n");
}

function toPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}
