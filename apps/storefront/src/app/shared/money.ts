export function formatBrl(cents: number): string {
  const reais = Math.trunc(cents / 100);
  const fraction = Math.abs(cents % 100)
    .toString()
    .padStart(2, '0');
  const grouped = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${grouped},${fraction}`;
}
