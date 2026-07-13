/** Extrae AAAA-MM-DD de un timestamp ISO sin alterar el valor original ni la zona horaria. */
export function formatDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/** Extrae HH:mm de un timestamp ISO sin alterar el valor original ni la zona horaria. */
export function formatTimeOnly(iso: string): string {
  return iso.slice(11, 16);
}
