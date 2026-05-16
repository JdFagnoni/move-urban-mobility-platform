export interface ZoneDTO {
  id: string;
  name: string;
  description: string;
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
