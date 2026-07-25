import { describe, expect, it } from 'vitest';
import { isIpad } from './device';

const nav = (userAgent: string, maxTouchPoints: number) => ({ userAgent, maxTouchPoints });

const classicIpadUa =
  'Mozilla/5.0 (iPad; CPU OS 12_5_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1';
const desktopModeIpadUa =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const windowsUa =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const androidTabletUa =
  'Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

describe('isIpad', () => {
  it('reconhece iPad clássico pelo user agent', () => {
    expect(isIpad(nav(classicIpadUa, 5))).toBe(true);
  });

  it('reconhece iPadOS 13+ em modo desktop (Macintosh + toque)', () => {
    expect(isIpad(nav(desktopModeIpadUa, 5))).toBe(true);
  });

  it('não considera Mac sem toque', () => {
    expect(isIpad(nav(desktopModeIpadUa, 0))).toBe(false);
  });

  it('não considera Windows nem tablet Android', () => {
    expect(isIpad(nav(windowsUa, 10))).toBe(false);
    expect(isIpad(nav(androidTabletUa, 5))).toBe(false);
  });
});
