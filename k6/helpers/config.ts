// Configuracion compartida por los scripts de performance K6 (R1, R2, R3, R8).
// Todos los valores son overrideables por --env; los defaults de Auth0 y del
// admin bootstrap reutilizan las mismas credenciales de prueba que el equipo
// ya usa en las colecciones de postman/.

export const BASE_URL = __ENV["BASE_URL"] ?? "http://localhost:3000";

// POST /gps/signal ya es publico tanto en el gateway como en
// transportation-service, asi que gps-burst.ts y el scenario "gps" de r2/r3
// pueden ir por BASE_URL/el gateway igual que el resto de las llamadas.
// TRANSPORTATIONS_BASE_URL se mantiene solo porque r3-alert-latency.ts le
// sigue pegando directo al servicio a proposito (cada muestra usa su propio
// vehiculo, no hay necesidad de pasar por el gateway ahi). El resto de las
// llamadas a transportation-service (vehiculos, zonas, trips) SI van por
// BASE_URL/el gateway: transportation-service usa createAuthenticate() de
// @move/shared, que no valida ningun JWT por su cuenta, solo confia en los
// headers que el gateway agrega al proxyear (ver helpers/fleet.ts).
export const TRANSPORTATIONS_BASE_URL =
  __ENV["TRANSPORTATIONS_BASE_URL"] ?? "http://localhost:3002";

export const AUTH0_DOMAIN = __ENV["AUTH0_DOMAIN"] ?? "dev-v18wbrah03r8lc5v.us.auth0.com";
export const AUTH0_CLIENT_ID = __ENV["AUTH0_CLIENT_ID"] ?? "y1zVsp6x4vS4jN5mtFUiIIMqjYRruQSz";
export const AUTH0_CLIENT_SECRET =
  __ENV["AUTH0_CLIENT_SECRET"] ??
  "O_m5mem6bJ_z2vpQKNfxb_wFQT2RBPpwFWyrPR-Ub0_nIkeJeaZDbw64qYDhrW_v";
export const AUTH0_AUDIENCE = __ENV["AUTH0_AUDIENCE"] ?? "https://move-platform-api";
export const AUTH0_REALM = __ENV["AUTH0_REALM"] ?? "Username-Password-Authentication";

export const ADMIN_EMAIL = __ENV["ADMIN_EMAIL"] ?? "admin@move.local";
export const ADMIN_PASSWORD = __ENV["ADMIN_PASSWORD"] ?? "Admin123";

// Credenciales fijas reutilizadas entre k6/seed/seed-frequent-client.ts,
// r1-reservation-performance.ts y r8-stress-test.ts: el ranking de clientes
// frecuentes (Redis) se calcula sobre reservas reales de estos mismos
// usuarios, asi que tienen que ser estables entre corridas.
export const FREQUENT_COMPANY_EMAIL =
  __ENV["FREQUENT_COMPANY_EMAIL"] ?? "frequent-company@move.local";
export const FREQUENT_COMPANY_PASSWORD = __ENV["FREQUENT_COMPANY_PASSWORD"] ?? "Secret123!";

export const NONFREQUENT_COMPANY_EMAIL =
  __ENV["NONFREQUENT_COMPANY_EMAIL"] ?? "nonfrequent-company@move.local";
export const NONFREQUENT_COMPANY_PASSWORD = __ENV["NONFREQUENT_COMPANY_PASSWORD"] ?? "Secret123!";

export const INDIVIDUAL_CLIENT_EMAIL =
  __ENV["INDIVIDUAL_CLIENT_EMAIL"] ?? "individual-client@move.local";
export const INDIVIDUAL_CLIENT_PASSWORD = __ENV["INDIVIDUAL_CLIENT_PASSWORD"] ?? "Secret123!";
