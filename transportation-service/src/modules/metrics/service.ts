import { query } from "@move/shared";

export interface AlertsByTypeRow {
  type: string;
  count: number;
}

export async function getAlertsByType(): Promise<AlertsByTypeRow[]> {
  const result = await query<{ type: string; count: string }>(
    `SELECT type, COUNT(*) AS count FROM alerts GROUP BY type ORDER BY count DESC`
  );

  return result.rows.map((row) => ({ type: row.type, count: Number(row.count) }));
}

export async function getGpsSignalsIngestedCount(): Promise<number> {
  const result = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM gps_signals`);
  return Number(result.rows[0]?.count ?? 0);
}
