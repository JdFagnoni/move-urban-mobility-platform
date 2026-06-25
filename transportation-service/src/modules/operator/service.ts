import type { AlertSeverity, AlertType, GeoPoint, TripStatus, VehicleDTO } from "@move/shared";
import { HttpError, query, redisClient } from "@move/shared";
import type { TripDTO } from "@move/shared";
import { VehicleModel, ZoneModel } from "../../db/models";
import { resolveUserByAuthSubject } from "../../clients/reservation-service";
import { formatGeoPoint, pointInPolygon } from "../zones/geo";

export interface ActiveTripFilters {
  vehicleId?: string;
  driverId?: string;
  categoryId?: string;
  hasActiveAlerts?: boolean;
}

export interface ActiveTripDTO {
  id: string;
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  originLabel: string;
  destinationLabel: string;
  status: TripStatus;
  statusLabel: string;
  vehicle: {
    id: string;
    plate: string;
    type: string;
    capacity: number;
    status: string;
  };
  driver: {
    id: string;
    name: string;
    email: string;
  };
  hasActiveAlerts: boolean;
  activeAlerts: ActiveTripAlertDTO[];
  alertsLabel: string;
  operatorSummary: string;
}

interface ActiveTripRow {
  id: string;
  status: string;
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_type: string;
  vehicle_capacity: number;
  vehicle_status: string;
  driver_id: string;
  driver_name: string | null;
  driver_email: string | null;
  has_active_alerts: boolean;
}

interface ZoneCandidate {
  id: string;
  name: string;
  polygon: {
    coordinates: number[][][];
  };
}

interface ActiveTripAlertRow {
  id: string;
  trip_id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  created_at: Date | string;
}

export interface ActiveTripAlertDTO {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  createdAt: string;
}

function mapStatusLabel(status: TripStatus): string {
  switch (status) {
    case "assigned":
      return "Asignado";
    case "in_progress":
      return "En curso";
    case "completed":
      return "Finalizado";
    case "cancelled":
      return "Cancelado";
  }
}

function findZoneName(point: GeoPoint | null, zones: readonly ZoneCandidate[]): string | null {
  if (point === null) {
    return null;
  }

  for (const zone of zones) {
    const ring = zone.polygon.coordinates[0];
    if (ring && pointInPolygon(point.coordinates, ring)) {
      return zone.name;
    }
  }

  return null;
}

function formatPointLabel(point: GeoPoint | null, zones: readonly ZoneCandidate[]): string {
  if (point === null) {
    return "Ubicacion no disponible";
  }

  const zoneName = findZoneName(point, zones);
  if (zoneName) {
    return zoneName;
  }

  return formatGeoPoint(point);
}

function mapActiveTripAlert(row: ActiveTripAlertRow): ActiveTripAlertDTO {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    message: row.message,
    createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
  };
}

function formatAlertsLabel(alerts: readonly ActiveTripAlertDTO[]): string {
  if (alerts.length === 0) {
    return "sin alertas";
  }

  if (alerts.length === 1) {
    return `con alerta: ${alerts[0]!.message}`;
  }

  return `con ${alerts.length} alertas activas: ${alerts.map((alert) => alert.message).join("; ")}`;
}

function buildOperatorSummary(dto: {
  id: string;
  originLabel: string;
  destinationLabel: string;
  statusLabel: string;
  vehiclePlate: string;
  driverName: string;
  alertsLabel: string;
}): string {
  return [
    `Traslado ${dto.id}`,
    `${dto.originLabel} -> ${dto.destinationLabel}`,
    dto.statusLabel,
    `vehiculo ${dto.vehiclePlate}`,
    `conductor ${dto.driverName || "No asignado"}`,
    dto.alertsLabel,
  ].join(", ");
}

function rowToActiveDTO(
  row: ActiveTripRow,
  zones: readonly ZoneCandidate[],
  alerts: readonly ActiveTripAlertDTO[]
): ActiveTripDTO {
  const status = row.status as TripStatus;
  const originLabel = formatPointLabel(row.origin, zones);
  const destinationLabel = formatPointLabel(row.destination, zones);
  const alertsLabel = formatAlertsLabel(alerts);
  return {
    id: row.id,
    origin: row.origin,
    destination: row.destination,
    originLabel,
    destinationLabel,
    status,
    statusLabel: mapStatusLabel(status),
    vehicle: {
      id: row.vehicle_id,
      plate: row.vehicle_plate,
      type: row.vehicle_type,
      capacity: row.vehicle_capacity,
      status: row.vehicle_status,
    },
    driver: {
      id: row.driver_id,
      name: row.driver_name ?? "",
      email: row.driver_email ?? "",
    },
    hasActiveAlerts: row.has_active_alerts,
    activeAlerts: [...alerts],
    alertsLabel,
    operatorSummary: buildOperatorSummary({
      id: row.id,
      originLabel,
      destinationLabel,
      statusLabel: mapStatusLabel(status),
      vehiclePlate: row.vehicle_plate,
      driverName: row.driver_name ?? "",
      alertsLabel,
    }),
  };
}

const ACTIVE_TRIPS_TTL_SECONDS = 3;

function activeTripsCacheKey(filters: ActiveTripFilters): string {
  const hasAlertsPart =
    filters.hasActiveAlerts === undefined ? "-" : String(filters.hasActiveAlerts);
  return [
    "trips:active",
    filters.vehicleId ?? "-",
    filters.driverId ?? "-",
    filters.categoryId ?? "-",
    hasAlertsPart,
  ].join(":");
}

// F18 – panel del operador: traslados en curso (no finalizados)
export async function getActiveTrips(
  callerAuthSubject: string,
  filters: ActiveTripFilters
): Promise<ActiveTripDTO[]> {
  const caller = await resolveUserByAuthSubject(callerAuthSubject);
  if (!caller || caller.role !== "operator") {
    throw new HttpError(403, "Caller is not a registered operator", "caller_not_operator");
  }

  const cacheKey = activeTripsCacheKey(filters);
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached) as ActiveTripDTO[];
  } catch (err) {
    console.error("[operator] redis read error:", err);
  }

  // Todos los datos del traslado (origin/destination/conductor/categorias) estan
  // desnormalizados en la tabla trips, por lo que esta consulta solo toca tablas
  // propias de transportation-service (trips, vehicles, alerts).
  const conditions: string[] = ["t.status NOT IN ('completed', 'cancelled')"];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filters.vehicleId !== undefined) {
    conditions.push(`t.vehicle_id = $${paramIdx++}`);
    params.push(filters.vehicleId);
  }

  if (filters.driverId !== undefined) {
    conditions.push(`t.driver_id = $${paramIdx++}`);
    params.push(filters.driverId);
  }

  if (filters.categoryId !== undefined) {
    conditions.push(`$${paramIdx++} = ANY(t.category_ids)`);
    params.push(filters.categoryId);
  }

  if (filters.hasActiveAlerts === true) {
    conditions.push(
      `EXISTS (SELECT 1 FROM alerts a WHERE a.trip_id = t.id AND a.resolved_at IS NULL)`
    );
  } else if (filters.hasActiveAlerts === false) {
    conditions.push(
      `NOT EXISTS (SELECT 1 FROM alerts a WHERE a.trip_id = t.id AND a.resolved_at IS NULL)`
    );
  }

  const whereClause = conditions.join(" AND ");

  const result = await query<ActiveTripRow>(
    `SELECT
       t.id,
       t.status,
       t.origin,
       t.destination,
       v.id          AS vehicle_id,
       v.plate       AS vehicle_plate,
       v.type        AS vehicle_type,
       v.capacity    AS vehicle_capacity,
       v.status      AS vehicle_status,
       t.driver_id   AS driver_id,
       t.driver_name AS driver_name,
       t.driver_email AS driver_email,
       EXISTS (
         SELECT 1 FROM alerts a
         WHERE a.trip_id = t.id AND a.resolved_at IS NULL
       ) AS has_active_alerts
     FROM trips t
     JOIN vehicles v ON v.id = t.vehicle_id
     WHERE ${whereClause}
     ORDER BY t.created_at DESC`,
    params
  );

  const [zones, activeAlertsByTrip] = await Promise.all([
    listActiveZones(),
    listActiveAlertsByTrip(result.rows.map((row) => row.id)),
  ]);

  const data = result.rows.map((row) =>
    rowToActiveDTO(row, zones, activeAlertsByTrip.get(row.id) ?? [])
  );

  redisClient
    .set(cacheKey, JSON.stringify(data), "EX", ACTIVE_TRIPS_TTL_SECONDS)
    .catch((err: unknown) => {
      console.error("[operator] redis write error:", err);
    });

  return data;
}

async function listActiveZones(): Promise<ZoneCandidate[]> {
  const zones = await ZoneModel.findAll({
    where: { active: true },
    attributes: ["id", "name", "type", "polygon"],
    order: [["name", "ASC"]],
  });

  return zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    polygon: zone.polygon,
  }));
}

async function listActiveAlertsByTrip(
  tripIds: readonly string[]
): Promise<Map<string, ActiveTripAlertDTO[]>> {
  const alertsByTrip = new Map<string, ActiveTripAlertDTO[]>();
  if (tripIds.length === 0) {
    return alertsByTrip;
  }

  const result = await query<ActiveTripAlertRow>(
    `SELECT id, trip_id, type, severity, message, created_at
     FROM alerts
     WHERE trip_id = ANY($1::uuid[]) AND resolved_at IS NULL
     ORDER BY created_at DESC`,
    [tripIds]
  );

  for (const row of result.rows) {
    const current = alertsByTrip.get(row.trip_id) ?? [];
    current.push(mapActiveTripAlert(row));
    alertsByTrip.set(row.trip_id, current);
  }

  return alertsByTrip;
}

// F19 – reasignar vehículo en traslado activo
export async function reassignVehicle(
  tripId: string,
  newVehicleId: string
): Promise<TripDTO | null> {
  void tripId;
  void newVehicleId;
  return null;
}

// F19 – vehículos disponibles para reasignación
export async function getAvailableVehicles(): Promise<VehicleDTO[]> {
  const vehicles = await VehicleModel.findAll({ where: { status: "available" } });
  return vehicles.map((v) => ({
    id: v.id,
    plate: v.plate,
    type: v.type,
    capacity: v.capacity,
    status: v.status,
    customFeatures: v.customFeatures,
  }));
}
