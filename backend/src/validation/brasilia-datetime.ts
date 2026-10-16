import { DateTime, FixedOffsetZone } from 'luxon';

const brasiliaZone = FixedOffsetZone.instance(-180);
const inputPattern =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d-03:00$/;

export function isBrasiliaDateTime(value: string): boolean {
  return (
    inputPattern.test(value) &&
    DateTime.fromISO(value, { setZone: true }).isValid
  );
}

export function formatBrasiliaDateTime(value: Date): string {
  return DateTime.fromJSDate(value, { zone: brasiliaZone }).toFormat(
    "yyyy-MM-dd'T'HH:mm:ssZZ",
  );
}
