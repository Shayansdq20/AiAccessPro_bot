/** Recursively convert BigInt (and Prisma Decimal) values so JSON.stringify never throws. */
export function serializeBigInt(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(serializeBigInt);
  if (typeof value === 'object') {
    // Prisma Decimal exposes toJSON
    const ctorName = (value as object).constructor?.name;
    if (ctorName === 'Decimal') return (value as { toString(): string }).toString();
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeBigInt(v);
    }
    return out;
  }
  return value;
}
