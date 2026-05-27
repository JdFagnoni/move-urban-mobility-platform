import { Auth0IdentityProvisioningAdapter } from "./adapters/Auth0IdentityProvisioningAdapter";
import { createAuthService } from "./service";

export const authService = createAuthService({
  identityProvider: new Auth0IdentityProvisioningAdapter(),
});
