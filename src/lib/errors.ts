// Centralized error handling utility for server functions and API surfaces.
// Logs the original error server-side and returns a safe, user-facing payload.
export function handleError(error: unknown): { ok: false; message: string } {
  console.error(error);
  return {
    ok: false,
    message: "Er ging iets mis. Probeer opnieuw.",
  };
}

// Small helper: normalize a Postgrest join value that may be an object,
// a single-element array, or null — into a single object or null.
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
