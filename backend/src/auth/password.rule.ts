// One rule for every place a password is chosen (sign-up, reset link, change password). Login does not use it,
// so passwords made before the rule still work. Keep frontend/lib/password.ts in step with this file.
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
export const PASSWORD_MESSAGE = 'Password must have at least 8 characters, with a lowercase letter, an uppercase letter and a number.';
