import type { RegisterClientDTO } from "@move/shared";

export interface ProvisionedClientIdentity {
  authSubject: string;
}

export interface AuthIdentityProvisioningPort {
  createClientIdentity(dto: RegisterClientDTO): Promise<ProvisionedClientIdentity>;
}
