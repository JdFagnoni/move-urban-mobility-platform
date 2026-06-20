import type { GpsSignalDTO } from "../types/gps";
import type { GeoPoint } from "../types/zone";

export const EXCHANGES = {
  reservations: "move.reservations",
  gps: "move.gps",
  categories: "move.categories",
  deadLetter: "move.dlx",
} as const;

export const ROUTING_KEYS = {
  reservationAssigned: "reservation.assigned",
  reservationUnsupported: "reservation.unsupported",
  gpsSignalIngested: "gps.signal.ingested",
  categoryChanged: "category.changed",
} as const;

export const QUEUES = {
  tripCreation: "trip.creation",
  notificationsEmail: "notifications.email",
  gpsDetection: "gps.detection",
  categorySync: "category.sync",
} as const;

export type ExchangeName = (typeof EXCHANGES)[keyof typeof EXCHANGES];
export type RoutingKey = (typeof ROUTING_KEYS)[keyof typeof ROUTING_KEYS];
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface WorkQueueDefinition {
  name: QueueName;
  exchange: ExchangeName;
  routingKey: RoutingKey;
}

export const WORK_QUEUES: readonly WorkQueueDefinition[] = [
  {
    name: QUEUES.tripCreation,
    exchange: EXCHANGES.reservations,
    routingKey: ROUTING_KEYS.reservationAssigned,
  },
  {
    name: QUEUES.notificationsEmail,
    exchange: EXCHANGES.reservations,
    routingKey: ROUTING_KEYS.reservationUnsupported,
  },
  {
    name: QUEUES.gpsDetection,
    exchange: EXCHANGES.gps,
    routingKey: ROUTING_KEYS.gpsSignalIngested,
  },
  {
    name: QUEUES.categorySync,
    exchange: EXCHANGES.categories,
    routingKey: ROUTING_KEYS.categoryChanged,
  },
];

export function retryQueueName(queue: string): string {
  return `${queue}.retry`;
}

export function deadLetterQueueName(queue: string): string {
  return `${queue}.dlq`;
}

export interface ReservationAssignedEvent {
  reservationId: string;
  vehicleId: string;
  driverId: string;
  // Datos desnormalizados que transportation-service persiste en la tabla trips
  // para evitar consultar las tablas reservations/users/goods de reservation-service.
  // Opcionales para compatibilidad con eventos en vuelo previos a este cambio.
  origin?: GeoPoint;
  destination?: GeoPoint;
  driverName?: string;
  driverEmail?: string;
  categoryIds?: string[];
}

export interface ReservationUnsupportedEvent {
  reservationId: string;
  recipientEmail: string;
  recipientName: string;
  rejectionReason: string;
}

export type GpsSignalIngestedEvent = GpsSignalDTO;

export interface CategoryChangedEvent {
  trigger: "created" | "updated" | "deleted";
}
