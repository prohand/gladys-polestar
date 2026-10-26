// -----------------------------------------------------------------------------
// Polestar ID sign-in (OpenID Connect, authorization code + PKCE).
//
// Polestar publishes no API for third parties: this is the flow of the
// Polestar web site and app, the same one the community libraries use
// (pypolestar, behind the Home Assistant integration). In short:
//
//   1. GET the authorization endpoint -> the sign-in page names the "resume"
//      path the form posts to;
//   2. POST the e-mail and the password there -> a redirect to the callback
//      URL carries the authorization `code` (or a `uid` when Polestar wants
//      new terms accepted first: they are accepted with one more POST);
//   3. exchange the code for an access token + a refresh token;
//   4. afterwards, refresh the token before it expires.
//
// The tokens live in memory only: a restart signs in again. Nothing is
// written to /data, so no secret ever lands on disk.
// -----------------------------------------------------------------------------

import { createHash, randomBytes } from 'node:crypto';
import { createLogger } from '@gladysassistant/integration-sdk';
import { CookieJar, form, getFollowing, send } from './http.js';
import { PolestarAuthError, PolestarCredentialsError } from './errors.js';

const logger = createLogger({ name: 'polestar-auth' });

export const OIDC_PROVIDER = 'https://polestarid.eu.polestar.com';
export const OIDC_CLIENT_ID = 'l3oopkc_10';
export const OIDC_REDIRECT_URI = 'https://www.polestar.com/sign-in-callback';
export const OIDC_SCOPE = 'openid profile email customer:attributes';

// Refresh ahead of expiry: half the lifetime, five minutes at most.
const REFRESH_WINDOW_MAX_S = 300;

const base64url = (buffer) => buffer.toString('base64url');

export class PolestarAuth {
  /**
   * @param {object} options
   * @param {string} options.email
   * @param {string} options.password
   * @param {typeof fetch} [options.fetch]
   * @param {() => number} [options.now] clock in ms (tests)
   */
  constructor({ email, password, fetch: fetchImpl = globalThis.fetch, now = Date.now }) {
    this.email = email;
    this.password = password;
    this.fetch = fetchImpl;
    this.now = now;
    this.jar = new CookieJar();
    this.oidc = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
    this.lifetime = 0;
    this.pending = null;
  }

  /**
   * A valid access token: the current one, a refreshed one or a new sign-in.
   * Concurrent callers share the same request.
   * @param {{ force?: boolean }} [options] force: the API refused the token
   */
  async getAccessToken({ force = false } = {}) {
    if (!force && this.accessToken && !this.needsRefresh()) {
      return this.accessToken;
    }
    if (!this.pending) {
      this.pending = this.renew().finally(() => {
        this.pending = null;
      });
    }
    return this.pending;
  }

  needsRefresh() {
    const window = Math.min(this.lifetime / 2, REFRESH_WINDOW_MAX_S) * 1000;
    return this.expiresAt - this.now() < window;
  }

  async renew() {
    if (this.refreshToken) {
      try {
        await this.refresh();
        logger.debug('Access token refreshed');
        return this.accessToken;
      } catch (err) {
        logger.warn(`Token refresh failed (${err.message}), signing in again`);
      }
    }
    try {
      await this.signIn();
      logger.info('Signed in to Polestar ID');
      return this.accessToken;
    } catch (err) {
      this.logout();
      throw err;
    }
  }

  logout() {
    this.jar.clear();
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
    this.lifetime = 0;
  }

  async configuration() {
    if (this.oidc) {
      return this.oidc;
    }
    const response = await send(
      this.fetch,
      this.jar,
      `${OIDC_PROVIDER}/.well-known/openid-configuration`,
    );
    if (!response.ok) {
      throw new PolestarAuthError(`OIDC configuration: HTTP ${response.status}`, {
        status: response.status,
      });
    }
    const body = await response.json().catch(() => ({}));
    if (!body.authorization_endpoint || !body.token_endpoint) {
      throw new PolestarAuthError('Invalid OIDC configuration');
    }
    this.oidc = {
      authorizationEndpoint: body.authorization_endpoint,
      tokenEndpoint: body.token_endpoint,
    };
    return this.oidc;
  }

  async signIn() {
    const { authorizationEndpoint } = await this.configuration();
    const verifier = base64url(randomBytes(32));
    const params = new URLSearchParams({
      client_id: OIDC_CLIENT_ID,
      redirect_uri: OIDC_REDIRECT_URI,
      response_type: 'code',
      scope: OIDC_SCOPE,
      state: base64url(randomBytes(32)),
      code_challenge: base64url(createHash('sha256').update(verifier).digest()),
      code_challenge_method: 'S256',
      response_mode: 'query',
    });

    // 1) The sign-in page: it names the path the form posts to.
    const { response: page } = await getFollowing(
      this.fetch,
      this.jar,
      `${authorizationEndpoint}?${params}`,
    );
    const html = await page.text();
    const resume = html.match(/(?:url|action):\s*"([^"]+)"/)?.[1];
    if (!resume) {
      throw new PolestarAuthError('Sign-in page without a resume path', { status: page.status });
    }
    const resumeUrl = `${new URL(resume, OIDC_PROVIDER)}${resume.includes('?') ? '&' : '?'}${params}`;

    // 2) The credentials. A redirect carries the code; a 200 is the form again.
    let answer = await this.postForm(resumeUrl, {
      'pf.username': this.email,
      'pf.pass': this.password,
    });
    let location = answer.headers.get('location');
    if (!location) {
      const text = await answer.text().catch(() => '');
      if (text.includes('ERR001')) {
        throw new PolestarCredentialsError();
      }
      throw new PolestarAuthError(`Sign-in refused: HTTP ${answer.status}`, {
        status: answer.status,
      });
    }
    let target = new URL(location, resumeUrl);

    // New terms to accept: Polestar answers with a `uid` instead of a code.
    const uid = target.searchParams.get('uid');
    if (!target.searchParams.get('code') && uid) {
      logger.info('Polestar ID asks to confirm the account: confirming');
      answer = await this.postForm(resumeUrl, { 'pf.submit': 'true', subject: uid });
      location = answer.headers.get('location');
      if (!location) {
        throw new PolestarAuthError(`Confirmation refused: HTTP ${answer.status}`, {
          status: answer.status,
        });
      }
      target = new URL(location, resumeUrl);
    }
    const code = target.searchParams.get('code');
    if (!code) {
      throw new PolestarAuthError('No authorization code in the sign-in redirect');
    }

    // 3) Code -> tokens.
    await this.token({
      grant_type: 'authorization_code',
      client_id: OIDC_CLIENT_ID,
      code,
      redirect_uri: OIDC_REDIRECT_URI,
      code_verifier: verifier,
    });
  }

  async refresh() {
    await this.token({
      grant_type: 'refresh_token',
      client_id: OIDC_CLIENT_ID,
      refresh_token: this.refreshToken,
    });
  }

  async postForm(url, values) {
    return send(this.fetch, this.jar, url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form(values),
    });
  }

  async token(values) {
    const { tokenEndpoint } = await this.configuration();
    const response = await this.postForm(tokenEndpoint, values);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.error || !body.access_token) {
      // The error code only (invalid_grant...), never the body: it may echo a token.
      throw new PolestarAuthError(`Token endpoint: ${body.error ?? `HTTP ${response.status}`}`, {
        status: response.status,
      });
    }
    this.accessToken = body.access_token;
    this.refreshToken = body.refresh_token ?? this.refreshToken;
    this.lifetime = Number(body.expires_in) || 3600;
    this.expiresAt = this.now() + this.lifetime * 1000;
  }
}
