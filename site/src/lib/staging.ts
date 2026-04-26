export function isStaging(): boolean {
  return import.meta.env.STAGING === "true";
}
