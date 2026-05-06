// ─── Common ────────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── User ──────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "operator" | "passenger" | "driver";

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthTokenDTO {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ─── Zone ──────────────────────────────────────────────────────────────────

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

// ─── Vehicle ───────────────────────────────────────────────────────────────

export type VehicleStatus = "available" | "busy" | "maintenance" | "inactive";

export interface VehicleDTO {
  id: string;
  plate: string;
  model: string;
  capacity: number;
  status: VehicleStatus;
  currentLocation?: GeoPoint;
}

// ─── Category ──────────────────────────────────────────────────────────────

export interface CategoryDTO {
  id: string;
  name: string;
  rules: CategoryRule[];
}

export interface CategoryRule {
  field: string;
  operator: "eq" | "gte" | "lte" | "in";
  value: unknown;
}

// ─── Reservation ───────────────────────────────────────────────────────────

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface ReservationDTO {
  id: string;
  passengerId: string;
  vehicleId?: string;
  categoryId: string;
  originZoneId: string;
  destinationZoneId: string;
  origin: GeoPoint;
  destination: GeoPoint;
  scheduledAt: string;
  status: ReservationStatus;
  createdAt: string;
}

export interface CreateReservationDTO {
  passengerId: string;
  categoryId: string;
  originZoneId: string;
  destinationZoneId: string;
  origin: GeoPoint;
  destination: GeoPoint;
  scheduledAt: string;
}

// ─── Trip (Traslado) ────────────────────────────────────────────────────────

export type TripStatus =
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface TripDTO {
  id: string;
  reservationId: string;
  vehicleId: string;
  driverId: string;
  status: TripStatus;
  startedAt?: string;
  completedAt?: string;
  route: GeoPoint[];
}

export interface CreateTripDTO {
  reservationId: string;
  vehicleId: string;
  driverId: string;
}

// ─── GPS ───────────────────────────────────────────────────────────────────

export interface GpsSignalDTO {
  vehicleId: string;
  location: GeoPoint;
  speed: number;
  heading: number;
  timestamp: string;
}

// ─── Alert ─────────────────────────────────────────────────────────────────

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType = "geofence_exit" | "speeding" | "breakdown" | "delay";

export interface AlertDTO {
  id: string;
  tripId: string;
  vehicleId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  location?: GeoPoint;
  createdAt: string;
  resolvedAt?: string;
}
