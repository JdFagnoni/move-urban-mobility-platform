export type UserRole = "admin" | "operator" | "client" | "driver";
export type ClientType = "individual" | "company";
export type UserStatus = "active" | "suspended" | "disabled";
export type AuthProvider = "auth0";

export interface UserDTO {
  id: string;
  authProvider: AuthProvider;
  authSubject: string;
  email: string;
  name: string;
  role: UserRole;
  clientType?: ClientType | null;
  status: UserStatus;
  phone?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  companyName?: string | null;
  taxId?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterClientDTO {
  email: string;
  password: string;
  name: string;
  clientType?: ClientType;
  phone?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  companyName?: string | null;
  taxId?: string | null;
}

export interface UpdateUserDTO {
  name?: string;
  role?: UserRole;
  clientType?: ClientType | null;
  status?: UserStatus;
  phone?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  companyName?: string | null;
  taxId?: string | null;
}

export interface ListUsersQueryDTO {
  role?: UserRole;
  status?: UserStatus;
  clientType?: ClientType;
  email?: string;
  page?: number;
  pageSize?: number;
}

export type AuthAuditEventType =
  | "registration_success"
  | "registration_failure"
  | "token_accepted"
  | "token_rejected"
  | "access_denied"
  | "status_changed"
  | "profile_updated";

export type AuthAuditDecision = "authorized" | "denied" | "failed" | "success";

export interface AuthAuditLogDTO {
  id: string;
  occurredAt: string;
  eventType: AuthAuditEventType;
  decision: AuthAuditDecision;
  userId?: string | null;
  authSubject?: string | null;
  email?: string | null;
  role?: UserRole | null;
  clientType?: ClientType | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ListAuthAuditLogsQueryDTO {
  eventType?: AuthAuditEventType;
  email?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuthenticatedUserDTO {
  user: UserDTO;
}

export interface CreateUserDTO extends RegisterClientDTO {
  role?: UserRole;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthTokenDTO {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}
