// The message of the first failed response in a batch, or null when they all came back.
export function firstError(...results: { error: { message: string } | null }[]): string | null {
  return results.find((r) => r.error)?.error?.message ?? null;
}
