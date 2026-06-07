// JWT signing secret.
//
// Source of truth is the JWT_SECRET environment variable (set it in the EB
// environment properties / .env). The hardcoded string below is ONLY a
// dev/rollout fallback so the app still boots if the env var is missing — it
// is intentionally well-known and MUST NOT be relied on in production, since
// anyone who can read the source could forge tokens with it.
//
// auth.module.ts and jwt.strategy.ts both resolve `JWT_SECRET || jwtConstants.secret`,
// and main.ts logs a loud warning at boot when JWT_SECRET is unset.
export class jwtConstants {
  static secret =
    process.env.JWT_SECRET ||
    'DO_NOT_USE_THIS_IN_PRODUCTION_BUT_ITS_OK_FOR_INTERNAL_TOOL';
}
