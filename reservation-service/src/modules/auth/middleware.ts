import { createAuthenticate, requireRole } from "@move/shared";
import { touchLastLogin } from "../users/service";

export const authenticate = createAuthenticate({
  onAuthenticated: (user) => touchLastLogin(user.id),
});

export { requireRole };
