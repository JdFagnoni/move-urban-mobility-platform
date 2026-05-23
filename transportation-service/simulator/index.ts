import "dotenv/config";

const TRANSPORTATIONS_URL = process.env["TRANSPORTATIONS_URL"] ?? "http://localhost:3002";
const INTERVAL_MS = Number(process.env["INTERVAL_MS"] ?? 2000);

// Montevideo bounding box
const LAT_MIN = -34.93;
const LAT_MAX = -34.87;
const LON_MIN = -56.22;
const LON_MAX = -56.14;

const FAKE_VEHICLE_IDS = ["vehicle-001", "vehicle-002", "vehicle-003"];

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

async function sendSignal(vehicleId: string): Promise<void> {
  const signal = {
    vehicleId,
    location: {
      type: "Point" as const,
      coordinates: [randomBetween(LON_MIN, LON_MAX), randomBetween(LAT_MIN, LAT_MAX)] as [
        number,
        number,
      ],
    },
    speed: randomBetween(0, 80),
    heading: randomBetween(0, 359),
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(`${TRANSPORTATIONS_URL}/gps/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signal),
    });
    if (!res.ok) {
      console.warn(`[simulator] signal rejected for ${vehicleId}: ${res.status}`);
    }
  } catch (err) {
    console.error(`[simulator] failed to send signal: ${(err as Error).message}`);
  }
}

async function tick(): Promise<void> {
  await Promise.all(FAKE_VEHICLE_IDS.map((id) => sendSignal(id)));
}

console.log(
  `[simulator] starting - sending signals every ${INTERVAL_MS}ms to ${TRANSPORTATIONS_URL}`
);

setInterval(() => void tick(), INTERVAL_MS);
