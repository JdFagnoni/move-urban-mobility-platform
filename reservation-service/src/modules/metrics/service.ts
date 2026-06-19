import { query } from "@move/shared";

export interface ReservationsByCategoryRow {
  name: string;
  spanishName: string | null;
  count: number;
}

interface ReservationsByCategoryQueryRow {
  name: string;
  spanish_name: string | null;
  count: string;
}

export async function getReservationsByCategory(): Promise<ReservationsByCategoryRow[]> {
  const result = await query<ReservationsByCategoryQueryRow>(
    `SELECT c.name, c.spanish_name, COUNT(g.id) AS count
     FROM goods g
     JOIN categories c ON c.id = g.category_id
     GROUP BY c.id, c.name, c.spanish_name
     ORDER BY count DESC`
  );

  return result.rows.map((row) => ({
    name: row.name,
    spanishName: row.spanish_name,
    count: Number(row.count),
  }));
}
