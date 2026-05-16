import type { ZoneDTO } from "@move/shared";

// F9 – gestión de zonas
export async function listZones(): Promise<ZoneDTO[]> {
  return [];
}

export async function getZone(id: string): Promise<ZoneDTO | null> {
  void id;
  return null;
}

export async function createZone(dto: Omit<ZoneDTO, "id">): Promise<ZoneDTO> {
  return { id: crypto.randomUUID(), ...dto };
}

export async function updateZone(
  id: string,
  dto: Partial<Omit<ZoneDTO, "id">>
): Promise<ZoneDTO | null> {
  void id;
  void dto;
  return null;
}

export async function deleteZone(id: string): Promise<boolean> {
  void id;
  return false;
}
