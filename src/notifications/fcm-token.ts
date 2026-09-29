/** Real FCM registration tokens are long opaque strings; mock/test values are not. */
export function isLikelyValidFcmToken(token: string | null | undefined): boolean {
  if (!token) {
    return false;
  }
  const trimmed = token.trim();
  if (trimmed.length < 100) {
    return false;
  }
  if (/^(mock|test|synthetic|fake|dummy)[_-]/i.test(trimmed)) {
    return false;
  }
  return true;
}
