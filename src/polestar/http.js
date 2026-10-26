// -----------------------------------------------------------------------------
// The small HTTP layer the Polestar ID sign-in needs.
//
// Polestar ID is a PingFederate server: the sign-in form is a chain of
// redirects that only works when the cookies it sets are sent back, and the
// authorization code is read from a `Location` header. The global `fetch`
// neither keeps cookies nor shows a redirect it followed, so this module adds
// both: a per-host cookie jar and a manual redirect loop.
//
// `fetch` is injected everywhere: the tests swap it for a fake Polestar.
// -----------------------------------------------------------------------------

export const HTTP_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 10;

/** Cookies per host, enough for a sign-in session (no expiry, no path rules). */
export class CookieJar {
  constructor() {
    this.hosts = new Map();
  }

  /** Remember the `Set-Cookie` headers of a response. */
  store(url, response) {
    const host = new URL(url).host;
    const lines =
      typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    if (lines.length === 0) {
      return;
    }
    const cookies = this.hosts.get(host) ?? new Map();
    for (const line of lines) {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      if (index > 0) {
        cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
      }
    }
    this.hosts.set(host, cookies);
  }

  /** The `Cookie` header for a URL, or undefined. */
  header(url) {
    const cookies = this.hosts.get(new URL(url).host);
    if (!cookies || cookies.size === 0) {
      return undefined;
    }
    return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  clear() {
    this.hosts.clear();
  }
}

/**
 * One request, cookies sent and stored, redirects NOT followed.
 * @returns {Promise<Response>}
 */
export async function send(fetchImpl, jar, url, { method = 'GET', headers = {}, body } = {}) {
  const cookie = jar.header(url);
  const response = await fetchImpl(url, {
    method,
    headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}) },
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  jar.store(url, response);
  return response;
}

/**
 * GET a URL and follow its redirects by hand, cookies included.
 * @returns {Promise<{ response: Response, url: string }>} the last response and its URL
 */
export async function getFollowing(fetchImpl, jar, url) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await send(fetchImpl, jar, current);
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) {
      return { response, url: current };
    }
    current = new URL(location, current).toString();
  }
  throw new Error(`Too many redirects from ${new URL(url).host}`);
}

/** `application/x-www-form-urlencoded` body. */
export function form(values) {
  return new URLSearchParams(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== null),
  ).toString();
}
