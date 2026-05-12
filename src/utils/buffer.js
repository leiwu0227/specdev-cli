/**
 * Append a chunk to a Buffer, keeping only the last `limit` bytes.
 *
 * Returns the original buffer when `limit <= 0`.
 */
export function appendCapped(buffer, chunk, limit) {
  if (limit <= 0) return buffer
  const next = Buffer.concat([buffer, Buffer.from(chunk)])
  if (next.length <= limit) return next
  return next.subarray(next.length - limit)
}
