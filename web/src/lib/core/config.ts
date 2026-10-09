// core-services (tenant "wedding"): the one place that knows its URLs. None of these are secrets; every
// call is authorised by a user token or a share-link session token.
export const CORE = {
  cognito: { region: 'us-west-2', userPoolId: 'us-west-2_WMOgHf6cc', clientId: '1kb3vbjtm4ppcme9g0hgt37fhk' },
  urls: {
    db: 'https://1bf7lx4i1b.execute-api.us-west-2.amazonaws.com/prod',
    share: 'https://phkjggotx9.execute-api.us-west-2.amazonaws.com/prod',
    tenants: 'https://3lyvwwq4ul.execute-api.us-west-2.amazonaws.com/prod',
    audit: 'https://y2knioroed.execute-api.us-west-2.amazonaws.com/prod',
  },
} as const;

export type CoreService = keyof typeof CORE.urls;

// App data lives in collections with app-specific names; collection names are per tenant.
export const GUEST_COLLECTION = 'wedding_guest_pages';
export const GUEST_ITEM_ID = 'main';
export const GUEST_GRANT = `/collections/${GUEST_COLLECTION}/items/${GUEST_ITEM_ID}`;
