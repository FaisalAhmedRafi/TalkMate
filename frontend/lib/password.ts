// Same rule as backend/src/auth/password.rule.ts: 8+ characters with a lowercase letter, an uppercase letter and a number.
export const PASSWORD_HINT = "Use at least 8 characters with an uppercase letter, a lowercase letter and a number.";
export const passwordError = (p: string): string | null =>
  p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p)
    ? null
    : "Password must have at least 8 characters, with a lowercase letter, an uppercase letter and a number.";
