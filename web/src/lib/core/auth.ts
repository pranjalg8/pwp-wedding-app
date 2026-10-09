import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { CORE } from './config';

const pool = new CognitoUserPool({ UserPoolId: CORE.cognito.userPoolId, ClientId: CORE.cognito.clientId });

export interface CoreIdentity {
  email: string;
  tenantId?: string;
  clientId?: string;
  groups: string[];
}

export type SignInResult = { status: 'ok' } | { status: 'new_password_required' };

// Kept in memory only. The password is passed straight to Cognito's SRP flow and never stored.
let pending: CognitoUser | undefined;

export function signIn(username: string, password: string): Promise<SignInResult> {
  const user = new CognitoUser({ Username: username, Pool: pool });
  return new Promise((resolve, reject) => {
    user.authenticateUser(new AuthenticationDetails({ Username: username, Password: password }), {
      onSuccess: () => resolve({ status: 'ok' }),
      onFailure: reject,
      newPasswordRequired: () => {
        pending = user;
        resolve({ status: 'new_password_required' });
      },
    });
  });
}

export function completeNewPassword(newPassword: string): Promise<void> {
  const user = pending;
  if (!user) return Promise.reject(new Error('No sign-in in progress'));
  return new Promise((resolve, reject) => {
    user.completeNewPasswordChallenge(
      newPassword,
      {},
      {
        onSuccess: () => {
          pending = undefined;
          resolve();
        },
        onFailure: reject,
      },
    );
  });
}

function currentSession(): Promise<CognitoUserSession | undefined> {
  const user = pool.getCurrentUser();
  if (!user) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    // getSession refreshes an expired ID token with the refresh token when it can.
    user.getSession((err: Error | null, session: CognitoUserSession | null) =>
      resolve(err || !session?.isValid() ? undefined : session),
    );
  });
}

/** The platform verifies the ID token (not the access token). */
export async function getIdToken(): Promise<string> {
  const session = await currentSession();
  if (!session) throw new Error('Not signed in to core-services');
  return session.getIdToken().getJwtToken();
}

export async function getIdentity(): Promise<CoreIdentity | undefined> {
  const session = await currentSession();
  if (!session) return undefined;
  const p = session.getIdToken().payload;
  return {
    email: String(p.email ?? ''),
    tenantId: p['custom:tenantId'],
    clientId: p['custom:clientId'],
    groups: (p['cognito:groups'] as string[] | undefined) ?? [],
  };
}

export function signOut(): void {
  pending = undefined;
  pool.getCurrentUser()?.signOut();
}
