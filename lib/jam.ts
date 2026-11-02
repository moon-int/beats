// next to tabs on one host (jam.geyser.at/beats): grooves are saved through tabs, which signs the
// band in with havoc and keeps a copy in havoc. JAM_API is set by tabs' launcher (deploy/jam.mjs);
// without it (beats.mo-tion.at) there is nothing to save to and the grooves button stays away.
export const JAM_API = (process.env.JAM_API || '').replace(/\/+$/, '');

export type JamUser = { id: string; name: string; admin: boolean };
export type JamMe = { auth: boolean; user: JamUser | null };

export type SavedGroove = {
  id: string;
  name: string;
  ownerName: string;
  updatedAt: number;
  mine: boolean;
  editable: boolean;
  bpm: number | null;
  kit: number | null;
  patterns: number;
};

/** the share-link form of a groove: { b, w, v, k, s, p, t } */
export type CompactGroove = Record<string, unknown>;

class JamError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${JAM_API}${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const text = payload.error === 'sign_in_required' ? 'please sign in first' : payload.error === 'store_off' ? 'saving is off on this server' : payload.error;
    throw new JamError(text || `the server answered ${res.status}`, res.status);
  }
  return payload as T;
}

export const jam = {
  me: () => call<JamMe>('GET', '/auth/me'),
  signIn: () => { window.location.href = `${JAM_API}/auth/login?next=${encodeURIComponent(window.location.pathname)}`; },
  list: () => call<{ items: SavedGroove[] }>('GET', '/store/grooves').then(r => r.items),
  get: (id: string) => call<SavedGroove & { data: CompactGroove }>('GET', `/store/grooves/${encodeURIComponent(id)}`),
  create: (name: string, data: CompactGroove) => call<SavedGroove>('POST', '/store/grooves', { name, data }),
  update: (id: string, patch: { name?: string; data?: CompactGroove }) => call<SavedGroove>('PUT', `/store/grooves/${encodeURIComponent(id)}`, patch),
  remove: (id: string) => call<{ ok: true }>('DELETE', `/store/grooves/${encodeURIComponent(id)}`),
};
