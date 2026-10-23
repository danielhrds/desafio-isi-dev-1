export function normalizeSpaces(value: string): string {
  return value.replace(/^ +| +$/g, '').replace(/ {2,}/g, ' ');
}
