/**
 * iPadOS 13+ no Safari se identifica como Mac desktop; o toque diferencia.
 * Macs com tela de toque são um falso positivo aceito (spec 2026-07-25).
 */
export function isIpad(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> = navigator): boolean {
  if (nav.userAgent.includes('iPad')) return true;
  return nav.userAgent.includes('Macintosh') && nav.maxTouchPoints > 1;
}
