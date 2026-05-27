import type { GeoPolygon, ZoneType } from "@move/shared";
import { HttpError } from "@move/shared";
import { ZONE_TYPES } from "../../db/constants";

export interface CreateZoneDTO {
  name: string;
  type: ZoneType;
  polygon: GeoPolygon;
  description: string | null;
}

export interface UpdateZoneDTO {
  name?: string;
  type?: ZoneType;
  polygon?: GeoPolygon;
  description?: string | null;
}

function parseName(name: unknown): string {
  if (typeof name !== "string" || !name.trim()) {
    throw new HttpError(400, "Zone name is required", "invalid_zone");
  }
  const trimmed = name.trim();
  if (trimmed.length > 200) {
    throw new HttpError(400, "Zone name must be 200 characters or less", "invalid_zone");
  }
  return trimmed;
}

function parseType(type: unknown): ZoneType {
  if (!ZONE_TYPES.includes(type as ZoneType)) {
    throw new HttpError(
      400,
      `Zone type must be one of: ${ZONE_TYPES.join(", ")}`,
      "invalid_zone_type"
    );
  }
  return type as ZoneType;
}

function parsePolygon(polygon: unknown): GeoPolygon {
  if (!polygon || typeof polygon !== "object" || Array.isArray(polygon)) {
    throw new HttpError(400, "polygon is required", "invalid_polygon");
  }
  const p = polygon as Record<string, unknown>;
  if (p["type"] !== "Polygon") {
    throw new HttpError(400, "polygon.type must be 'Polygon'", "invalid_polygon");
  }
  if (!Array.isArray(p["coordinates"]) || p["coordinates"].length === 0) {
    throw new HttpError(400, "polygon.coordinates must be a non-empty array", "invalid_polygon");
  }
  for (const ring of p["coordinates"] as unknown[]) {
    if (!Array.isArray(ring) || ring.length < 4) {
      throw new HttpError(400, "Each polygon ring must have at least 4 points", "invalid_polygon");
    }
    for (const point of ring) {
      if (!Array.isArray(point) || point.length < 2) {
        throw new HttpError(400, "Each point must be [longitude, latitude]", "invalid_polygon");
      }
      const [lng, lat] = point as unknown[];
      if (typeof lng !== "number" || typeof lat !== "number") {
        throw new HttpError(400, "Coordinates must be numbers", "invalid_polygon");
      }
      if (lng < -180 || lng > 180) {
        throw new HttpError(400, "Longitude must be between -180 and 180", "invalid_polygon");
      }
      if (lat < -90 || lat > 90) {
        throw new HttpError(400, "Latitude must be between -90 and 90", "invalid_polygon");
      }
    }
    const first = (ring as number[][])[0];
    const last = (ring as number[][])[ring.length - 1];
    if (first === undefined || last === undefined || first[0] !== last[0] || first[1] !== last[1]) {
      throw new HttpError(
        400,
        "Polygon ring must be closed: first and last point must be equal",
        "invalid_polygon"
      );
    }
  }
  return polygon as GeoPolygon;
}

function parseOptionalDescription(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

export function parseCreateZoneDTO(input: unknown): CreateZoneDTO {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpError(400, "A valid zone payload is required", "invalid_zone");
  }
  const p = input as Record<string, unknown>;
  return {
    name: parseName(p["name"]),
    type: parseType(p["type"]),
    polygon: parsePolygon(p["polygon"]),
    description: parseOptionalDescription(p["description"]),
  };
}

export function parseUpdateZoneDTO(input: unknown): UpdateZoneDTO {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpError(400, "A valid zone payload is required", "invalid_zone");
  }
  const p = input as Record<string, unknown>;
  const dto: UpdateZoneDTO = {};
  if (p["name"] !== undefined) dto.name = parseName(p["name"]);
  if (p["type"] !== undefined) dto.type = parseType(p["type"]);
  if (p["polygon"] !== undefined) dto.polygon = parsePolygon(p["polygon"]);
  if (p["description"] !== undefined) dto.description = parseOptionalDescription(p["description"]);
  return dto;
}
