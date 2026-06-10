import type {
  AuthAuditDecision,
  AuthAuditEventType,
  AuthProvider,
  ClientType,
  NotificationStatus,
  NotificationType,
  PaymentProvider,
  PaymentStatus,
  ReservationStatus,
  UserRole,
  UserStatus,
  ZoneType,
} from "@move/shared";

export const AUTH_PROVIDERS: readonly AuthProvider[] = ["auth0"];
export const USER_ROLES: readonly UserRole[] = ["admin", "operator", "client", "driver"];
export const USER_STATUSES: readonly UserStatus[] = ["active", "suspended", "disabled"];
export const CLIENT_TYPES: readonly ClientType[] = ["individual", "company"];
export const PAYMENT_PROVIDERS: readonly PaymentProvider[] = ["stripe"];
export const PAYMENT_STATUSES: readonly PaymentStatus[] = ["pending", "accepted", "rejected"];
export const RESERVATION_STATUSES: readonly ReservationStatus[] = [
  "pending_classification",
  "pending_quote",
  "pending_confirmation",
  "confirmed",
  "assigned",
  "in_progress",
  "completed",
  "rejected",
  "cancelled",
];
export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "classification_required",
];
export const NOTIFICATION_STATUSES: readonly NotificationStatus[] = [
  "pending",
  "acknowledged",
];
export const AUTH_AUDIT_EVENT_TYPES: readonly AuthAuditEventType[] = [
  "registration_success",
  "registration_failure",
  "token_accepted",
  "token_rejected",
  "access_denied",
  "status_changed",
  "profile_updated",
];
export const AUTH_AUDIT_DECISIONS: readonly AuthAuditDecision[] = [
  "authorized",
  "denied",
  "failed",
  "success",
];
export const ZONE_TYPES: readonly ZoneType[] = ["red", "preferred"];
