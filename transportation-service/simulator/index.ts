import "dotenv/config";

const TRANSPORTATIONS_URL = process.env["TRANSPORTATIONS_URL"] ?? "http://localhost:3002";
const INTERVAL_MS = Number(process.env["GPS_SIMULATOR_INTERVAL_MS"] ?? 10_000);

// Vehicle IDs must match real UUIDs in the DB.
// Override via env: SIMULATED_VEHICLE_IDS=uuid1,uuid2,...
const RAW_IDS = process.env["SIMULATED_VEHICLE_IDS"] ?? "";
const VEHICLE_IDS: string[] = RAW_IDS
  ? RAW_IDS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

// ─── Route definitions (Montevideo waypoints) ─────────────────────────────────
// Each route is a closed loop of [lon, lat] waypoints the vehicle follows.

interface Route {
  name: string;
  waypoints: [number, number][];
  // If true the vehicle will briefly detour into a known red-zone coordinate
  // every ~5 ticks to exercise alert generation during demos.
  triggerGeofence?: boolean;
}

const ROUTES: Route[] = [
  {
    name: "Centro → Aeropuerto",
    waypoints: [
      [-56.1882, -34.9065], // Plaza Independencia
      [-56.1712, -34.8941], // Bulevar Artigas
      [-56.1553, -34.8821], // Tres Cruces
      [-56.1308, -34.863], // Instrucciones
      [-56.0133, -34.8354], // Aeropuerto
    ],
    triggerGeofence: true,
  },
  {
    name: "Pocitos → Buceo",
    waypoints: [
      [-56.1621, -34.9072], // Pocitos
      [-56.1541, -34.9041], // Rambla
      [-56.1441, -34.9001], // Buceo
      [-56.1382, -34.8981], // Puerto del Buceo
    ],
  },
  {
    name: "Ciudad Vieja → Punta Carretas",
    waypoints: [
      [-56.2143, -34.9077], // Ciudad Vieja
      [-56.198, -34.9065], // Centro
      [-56.1852, -34.9121], // Palermo
      [-56.1712, -34.9154], // Punta Carretas
    ],
  },
];

// ─── State ────────────────────────────────────────────────────────────────────

interface VehicleState {
  vehicleId: string;
  route: Route;
  waypointIndex: number;
  progress: number; // 0..1 between current and next waypoint
  speed: number;
  heading: number;
  tickCount: number;
}

// Interpolate between two geo-points
function interpolate(from: [number, number], to: [number, number], t: number): [number, number] {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

function headingBetween(from: [number, number], to: [number, number]): number {
  const dLon = to[0] - from[0];
  const dLat = to[1] - from[1];
  return (Math.atan2(dLon, dLat) * 180) / Math.PI;
}

function jitter(value: number, amount: number): number {
  return value + (Math.random() - 0.5) * amount;
}

function initStates(): VehicleState[] {
  return VEHICLE_IDS.map((id, i) => ({
    vehicleId: id,
    route: ROUTES[i % ROUTES.length]!,
    waypointIndex: 0,
    progress: 0,
    speed: 30 + Math.random() * 20,
    heading: 0,
    tickCount: 0,
  }));
}

// ─── Signal generation ────────────────────────────────────────────────────────

function nextPosition(state: VehicleState): [number, number] {
  const { route, waypointIndex, tickCount, triggerGeofence } = {
    ...state,
    triggerGeofence: state.route.triggerGeofence,
  };

  // Every 5 ticks on a geofence-trigger route, send a coordinate that is
  // slightly off-route to simulate entering a restricted zone.
  if (triggerGeofence && tickCount % 5 === 4) {
    const current = route.waypoints[waypointIndex]!;
    return [current[0] + 0.002, current[1] + 0.002];
  }

  const current = route.waypoints[waypointIndex]!;
  const next = route.waypoints[(waypointIndex + 1) % route.waypoints.length]!;
  return interpolate(current, next, state.progress);
}

function advanceState(state: VehicleState): VehicleState {
  const PROGRESS_STEP = 0.12; // fraction of segment per tick
  let { waypointIndex, progress } = state;
  progress += PROGRESS_STEP;
  if (progress >= 1) {
    progress = 0;
    waypointIndex = (waypointIndex + 1) % state.route.waypoints.length;
  }

  const current = state.route.waypoints[waypointIndex]!;
  const next = state.route.waypoints[(waypointIndex + 1) % state.route.waypoints.length]!;

  return {
    ...state,
    waypointIndex,
    progress,
    speed: Math.max(0, jitter(state.speed, 8)),
    heading: headingBetween(current, next),
    tickCount: state.tickCount + 1,
  };
}

// ─── HTTP send ────────────────────────────────────────────────────────────────

async function sendSignal(state: VehicleState): Promise<void> {
  const [lon, lat] = nextPosition(state);
  const signal = {
    vehicleId: state.vehicleId,
    location: {
      type: "Point" as const,
      coordinates: [jitter(lon, 0.0002), jitter(lat, 0.0002)] as [number, number],
    },
    speed: Math.round(state.speed * 10) / 10,
    heading: Math.round(state.heading * 10) / 10,
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(`${TRANSPORTATIONS_URL}/gps/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signal),
    });
    if (!res.ok) {
      console.warn(`[simulator] rejected ${state.vehicleId}: HTTP ${res.status}`);
    } else {
      console.log(
        `[simulator] ${state.vehicleId} → [${signal.location.coordinates[0].toFixed(4)}, ${signal.location.coordinates[1].toFixed(4)}] ${signal.speed} km/h`
      );
    }
  } catch (err) {
    console.error(`[simulator] send error: ${(err as Error).message}`);
  }
}

// ─── Main loop ────────────────────────────────────────────────────────────────

if (VEHICLE_IDS.length === 0) {
  console.warn("[simulator] No vehicle IDs configured. Set SIMULATED_VEHICLE_IDS=uuid1,uuid2,...");
  console.warn(
    "[simulator] Running in demo mode with placeholder IDs (signals will be rejected by service)."
  );
  VEHICLE_IDS.push("00000000-0000-0000-0000-000000000001");
}

const states = initStates();

console.log(
  `[simulator] starting — ${states.length} vehicle(s), interval ${INTERVAL_MS}ms → ${TRANSPORTATIONS_URL}`
);
states.forEach((s) => console.log(`  • ${s.vehicleId} on route "${s.route.name}"`));

setInterval(() => {
  void Promise.all(
    states.map(async (state, i) => {
      await sendSignal(state);
      states[i] = advanceState(state);
    })
  );
}, INTERVAL_MS);
