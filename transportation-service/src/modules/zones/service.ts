import type { ZoneDTO } from "@move/shared";
import { HttpError } from "@move/shared";
import { ZoneModel } from "../../db/models";
import type { CreateZoneDTO, UpdateZoneDTO } from "./parser";

function mapZone(zone: ZoneModel): ZoneDTO {
  return {
    id: zone.id,
    name: zone.name,
    type: zone.type,
    description: zone.description,
    polygon: zone.polygon,
    active: zone.active,
  };
}

export async function listZones(type?: string): Promise<ZoneDTO[]> {
  const where = type !== undefined ? { type } : {};
  const zones = await ZoneModel.findAll({ where, order: [["name", "ASC"]] });
  return zones.map(mapZone);
}

export async function getZone(id: string): Promise<ZoneDTO | null> {
  const zone = await ZoneModel.findByPk(id);
  return zone ? mapZone(zone) : null;
}

export async function getZoneForHttp(id: string): Promise<ZoneDTO> {
  const zone = await getZone(id);
  if (!zone) {
    throw new HttpError(404, "Zone not found", "zone_not_found");
  }
  return zone;
}

export async function createZone(dto: CreateZoneDTO): Promise<ZoneDTO> {
  const zone = await ZoneModel.create({
    id: crypto.randomUUID(),
    name: dto.name,
    type: dto.type,
    description: dto.description,
    polygon: dto.polygon,
    active: true,
  });
  return mapZone(zone);
}

export async function updateZone(id: string, dto: UpdateZoneDTO): Promise<ZoneDTO> {
  const zone = await ZoneModel.findByPk(id);
  if (!zone) {
    throw new HttpError(404, "Zone not found", "zone_not_found");
  }
  if (dto.name !== undefined) zone.name = dto.name;
  if (dto.type !== undefined) zone.type = dto.type;
  if (dto.polygon !== undefined) zone.polygon = dto.polygon;
  if (dto.description !== undefined) zone.description = dto.description ?? null;
  await zone.save();
  return mapZone(zone);
}

export async function deleteZone(id: string): Promise<void> {
  const zone = await ZoneModel.findByPk(id);
  if (!zone) {
    throw new HttpError(404, "Zone not found", "zone_not_found");
  }
  await zone.destroy();
}
