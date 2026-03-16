/**
 * Admin authentication via URL secret key.
 *
 * For production, replace ADMIN_SECRET_KEY with an environment variable.
 * Current approach: hardcoded temporary key, easy to rotate.
 */

// ⚠️ REPLACE THIS KEY before public launch or move to env variable
const ADMIN_SECRET_KEY = 'stk_Qv8nW3pLm7xR2dYj6Tf9';

/**
 * Validate admin access by checking the `admin_key` query parameter.
 * Returns true only if the key matches the secret.
 */
export function validateAdminAccess(searchParams: URLSearchParams): boolean {
  const key = searchParams.get('admin_key');
  return key === ADMIN_SECRET_KEY;
}