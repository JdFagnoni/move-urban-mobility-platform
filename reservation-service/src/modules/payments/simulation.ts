export type PaymentSimulationMode = "none" | "unavailable";

let paymentSimulationModeOverride: PaymentSimulationMode | null = null;

export function getPaymentSimulationMode(): PaymentSimulationMode {
  return paymentSimulationModeOverride ?? getConfiguredPaymentSimulationMode();
}

export function setPaymentSimulationMode(mode: PaymentSimulationMode): PaymentSimulationMode {
  paymentSimulationModeOverride = mode;
  return getPaymentSimulationMode();
}

export function clearPaymentSimulationModeOverride(): PaymentSimulationMode {
  paymentSimulationModeOverride = null;
  return getPaymentSimulationMode();
}

export function isPaymentSimulationMode(value: unknown): value is PaymentSimulationMode {
  return value === "none" || value === "unavailable";
}

function getConfiguredPaymentSimulationMode(): PaymentSimulationMode {
  const configured = process.env["PAYMENT_SIMULATION_MODE"]?.trim().toLowerCase();
  return configured === "unavailable" ? "unavailable" : "none";
}
