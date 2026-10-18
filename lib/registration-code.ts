// Keep original invitation links valid while using short, case-insensitive codes.
export function normalizeRegistrationCode(value:string){const code=value.trim();return /^[a-f0-9]{24}$/i.test(code)?code.toLowerCase():code.toUpperCase()}
export function isRegistrationCode(value:string){return /^(?:[A-Z0-9]{6}|[a-f0-9]{24})$/.test(normalizeRegistrationCode(value))}
export const registrationCodePattern='(?:[A-Za-z0-9]{6}|[a-fA-F0-9]{24})';
