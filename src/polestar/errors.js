// -----------------------------------------------------------------------------
// The errors the Polestar client raises, so the callers can tell apart what the
// user must fix (credentials) from what fixes itself (the cloud is down).
// -----------------------------------------------------------------------------

/** The cloud answered, but not what we expected: retried at the next poll. */
export class PolestarApiError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message, { cause });
    this.name = 'PolestarApiError';
    this.status = status;
  }
}

/**
 * Polestar ID refused the e-mail / password. Never retried on its own:
 * hammering a sign-in form with a wrong password is how an account gets
 * locked. Only a new configuration tries again.
 */
export class PolestarCredentialsError extends Error {
  constructor(message = 'Polestar ID refused the e-mail or the password') {
    super(message);
    this.name = 'PolestarCredentialsError';
  }
}

/** The sign-in flow did not go as expected (page changed, server down...). */
export class PolestarAuthError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message, { cause });
    this.name = 'PolestarAuthError';
    this.status = status;
  }
}
