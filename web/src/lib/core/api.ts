import { CORE, GUEST_COLLECTION, GUEST_GRANT, GUEST_ITEM_ID, type CoreService } from './config';
import { getIdToken } from './auth';
import type { GuestPage } from './guest';

export class CoreError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  service: CoreService,
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${CORE.urls[service]}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string } } | undefined)?.error;
    throw new CoreError(res.status, e?.code ?? String(res.status), e?.message ?? `Request failed (${res.status})`);
  }
  return json as T;
}

// Signed-in calls: the ID token is read (and refreshed if needed) right before each request.
const authed = async <T>(service: CoreService, path: string, opts: { method?: string; body?: unknown } = {}) =>
  request<T>(service, path, { ...opts, token: await getIdToken() });

export interface Integration {
  tenantId?: string;
  clientId?: string;
  apps?: { clientId: string; name?: string }[];
  [key: string]: unknown;
}

export interface SharePolicy {
  allowAnonymous: boolean;
  effectiveMaxAnonymousMinutes: number;
  effectiveMaxLoginMinutes: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ShareLink {
  linkId: string;
  access: string;
  grants: string[];
  label?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | string;
  createdAt: string;
  createdBy?: string;
  expiresAt: string;
  redemptionCount: number;
  maxRedemptions?: number;
  token?: string; // only present in the create response, shown once
}

export const getIntegration = () => authed<Integration>('tenants', '/integration');
export const getPolicy = () => authed<SharePolicy>('share', '/policy');
// Only ever called from an explicit click by the tenant-admin.
export const setAllowAnonymous = (allowAnonymous: boolean) =>
  authed<SharePolicy>('share', '/policy', { method: 'PUT', body: { allowAnonymous } });

export const listLinks = async () => (await authed<{ links: ShareLink[] }>('share', '/links')).links;
export const createGuestLink = (p: { label: string; ttlMinutes: number; maxRedemptions: number }) =>
  authed<ShareLink>('share', '/links', {
    method: 'POST',
    body: { grants: [GUEST_GRANT], access: 'anonymous', ...p },
  });
export const revokeLink = (linkId: string) => authed<void>('share', `/links/${encodeURIComponent(linkId)}`, { method: 'DELETE' });

const guestItemPath = `/collections/${GUEST_COLLECTION}/items/${GUEST_ITEM_ID}`;
export const publishGuestPage = (page: GuestPage) => authed('db', guestItemPath, { method: 'PUT', body: page });
export async function getPublishedGuestPage(): Promise<GuestPage | null> {
  try {
    return (await authed<{ data: GuestPage }>('db', guestItemPath)).data;
  } catch (e) {
    if (e instanceof CoreError && e.status === 404) return null;
    throw e;
  }
}

// --- the public viewer: no sign-in, only the share link's own token ---

export interface RedeemResult {
  sessionToken: string;
  expiresAt: string;
  grants: string[];
  linkExpiresAt: string;
  access: string;
}

export const redeemLink = (token: string) =>
  request<RedeemResult>('share', '/share/redeem', { method: 'POST', body: { token } });

export async function fetchGuestPageWithSession(sessionToken: string): Promise<GuestPage> {
  return (await request<{ data: GuestPage }>('db', guestItemPath, { token: sessionToken })).data;
}
