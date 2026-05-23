import type { ZoneDTO } from "@move/shared";
import { HttpError } from "@move/shared";

// F9 – gestión de zonas
export async function listZones(): Promise<ZoneDTO[]> {
  return [];
}

export async function getZone(id: string): Promise<ZoneDTO | null> {
  void id;
  return null;
}

export async function getZoneForHttp(id: string): Promise<ZoneDTO> {
  const zone = await getZone(id);
  if (!zone) {
    throw new HttpError(404, "Zone not found", "zone_not_found");
  }

  return zone;
}

export async function createZone(dto: Omit<ZoneDTO, "id">): Promise<ZoneDTO> {
  return { id: crypto.randomUUID(), ...dto };
}

export async function updateZone(id: string, dto: Partial<Omit<ZoneDTO, "id">>): Promise<ZoneDTO> {
  await getZoneForHttp(id);
  void dto;
  throw new HttpError(404, "Zone not found", "zone_not_found");
}

export async function deleteZone(id: string): Promise<void> {
  await getZoneForHttp(id);
  throw new HttpError(404, "Zone not found", "zone_not_found");
}
