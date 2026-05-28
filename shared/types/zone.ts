export type ZoneType = "red" | "preferred";

export interface ZoneDTO {
  id: string;
  name: string;
  type: ZoneType;
  description?: string | null;
  polygon: GeoPolygon;
  active: boolean;
}

export interface GeoPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface GeoPoint {
  type: "Point";
  coordinates: [longitude: number, latitude: number];
}
