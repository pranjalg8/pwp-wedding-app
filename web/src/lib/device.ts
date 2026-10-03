// Best-effort device labeling for the manual-change audit trail.
// Browsers don't expose real hardware/device model info — this is
// user-agent + an optional nickname the person sets once per browser.
const NICKNAME_KEY = 'pwp_device_nickname';

export function getDeviceInfo() {
  return {
    user_agent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    nickname: localStorage.getItem(NICKNAME_KEY) || null,
  };
}

export function getDeviceNickname(): string | null {
  return localStorage.getItem(NICKNAME_KEY);
}

export function setDeviceNickname(name: string) {
  localStorage.setItem(NICKNAME_KEY, name);
}
