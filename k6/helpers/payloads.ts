// Payloads representativos para los scripts de performance K6.
// Las coordenadas usan formato GeoJSON { type: "Point", coordinates: [lon, lat] }
// (confirmado en postman/move-platform-reservations-f4.postman_collection.json),
// no { latitude, longitude }.

export type Point = [number, number];

// Descripciones de cargo reales tomadas de reservation-service/data/categories.csv,
// para que la clasificacion semantica (F4.1) procese contenido representativo
// en lugar de strings aleatorias sin relacion con el catalogo de categorias.
const INDIVIDUAL_CARGO_DESCRIPTIONS = [
  "Beading and jewelry making supplies",
  "Fabric decorating paints and dyes",
  "Knitting and crochet supplies",
  "Printmaking ink and rollers",
  "Scrapbooking stamps and stickers",
  "Sewing machine and accessories",
];

const MONTEVIDEO_POINTS: Point[] = [
  [-56.1645, -34.9011],
  [-56.1882, -34.9033],
  [-56.17, -34.905],
  [-56.155, -34.895],
  [-56.12, -34.88],
  [-56.11, -34.87],
];

function pick<T>(items: T[], index: number): T {
  return items[Math.abs(index) % items.length];
}

function futureDate(): string {
  return new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
}

export function individualReservationPayload(seed: number): string {
  const description = pick(INDIVIDUAL_CARGO_DESCRIPTIONS, seed);
  const origin = pick(MONTEVIDEO_POINTS, seed);
  const destination = pick(MONTEVIDEO_POINTS, seed + 1);

  return JSON.stringify({
    scheduledAt: futureDate(),
    origin: { type: "Point", coordinates: origin },
    destination: { type: "Point", coordinates: destination },
    cargoItems: [
      {
        description,
        estimatedValue: 500 + (seed % 10) * 100,
        size: "medium",
      },
    ],
  });
}

export function companyReservationPayload(companyProductId: string, seed: number): string {
  const origin = pick(MONTEVIDEO_POINTS, seed);
  const destination = pick(MONTEVIDEO_POINTS, seed + 1);

  return JSON.stringify({
    scheduledAt: futureDate(),
    origin: { type: "Point", coordinates: origin },
    destination: { type: "Point", coordinates: destination },
    cargoItems: [
      {
        description: `ERP shipment #${seed}`,
        companyProductId,
        estimatedValue: 1000 + (seed % 10) * 250,
        size: "large",
      },
    ],
  });
}

export function montevideoPoint(seed: number): Point {
  return pick(MONTEVIDEO_POINTS, seed);
}

export function gpsSignalPayload(
  vehicleId: string,
  coordinates: Point,
  speed = 45.5,
  heading = 90.0
): string {
  return JSON.stringify({
    vehicleId,
    location: { type: "Point", coordinates },
    speed,
    heading,
    timestamp: new Date().toISOString(),
  });
}
