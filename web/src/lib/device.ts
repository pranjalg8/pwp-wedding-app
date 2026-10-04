// Optional friendly name for this browser, e.g. "Paridhi's phone". It is sent with every
// request as an x-device-name header so the database audit trigger can record it.
export const DEVICE_NICKNAME_KEY = 'pwp_device_nickname';

export function getDeviceNickname(): string | null {
  return localStorage.getItem(DEVICE_NICKNAME_KEY);
}

export function setDeviceNickname(name: string) {
  localStorage.setItem(DEVICE_NICKNAME_KEY, name);
}

export function describeDevice(userAgent?: string | null) {
  if (!userAgent) return null;
  const os = /iPhone|iPad/.test(userAgent)
    ? 'iPhone/iPad'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Mac OS X/.test(userAgent)
        ? 'Mac'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Unknown device';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /CriOS|Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox|FxiOS/.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'browser';
  return `${os} · ${browser}`;
}
