export function clampPage(page: number, totalPages: number): number {
  const lastPage = Math.max(1, Math.trunc(totalPages));
  return Math.min(Math.max(1, Math.trunc(page)), lastPage);
}
