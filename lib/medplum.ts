/**
 * Singleton MedplumClient.
 *
 * Same globalThis caching pattern as lib/db.ts. Uses client credentials
 * (M2M) login — no user session needed. The client is lazy-initialised
 * on first call to getMedplum() so that Cover features remain opt-in:
 * if MEDPLUM_CLIENT_ID is absent the function returns null, and callers
 * skip the Medplum path.
 */

import { MedplumClient } from "@medplum/core";

const globalForMedplum = globalThis as unknown as {
  medplum: MedplumClient | undefined;
  medplumReady: Promise<MedplumClient> | undefined;
};

/**
 * Returns an authenticated MedplumClient, or null when Cover is not
 * configured (no MEDPLUM_CLIENT_ID env var).
 */
export async function getMedplum(): Promise<MedplumClient | null> {
  const clientId = process.env.MEDPLUM_CLIENT_ID;
  const clientSecret = process.env.MEDPLUM_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  // Fast path — already authenticated.
  if (globalForMedplum.medplum) return globalForMedplum.medplum;

  // Avoid parallel startClientLogin() calls during cold start.
  if (globalForMedplum.medplumReady) return globalForMedplum.medplumReady;

  const promise = (async () => {
    const client = new MedplumClient({
      baseUrl: process.env.MEDPLUM_BASE_URL ?? "https://api.medplum.com/",
      // Fetch is globally available in Node 18+.
      fetch: globalThis.fetch.bind(globalThis),
    });

    await client.startClientLogin(clientId, clientSecret);

    globalForMedplum.medplum = client;
    return client;
  })();

  globalForMedplum.medplumReady = promise;
  return promise;
}
