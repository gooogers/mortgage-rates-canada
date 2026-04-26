export function isStaging(): boolean {
  return process.env.STAGING === "true";
}
