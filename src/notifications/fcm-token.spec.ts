import { isLikelyValidFcmToken } from './fcm-token';

describe('isLikelyValidFcmToken', () => {
  it('rejects mock and short tokens', () => {
    expect(isLikelyValidFcmToken('mock_fcm_token_123')).toBe(false);
    expect(isLikelyValidFcmToken('short')).toBe(false);
    expect(isLikelyValidFcmToken('')).toBe(false);
    expect(isLikelyValidFcmToken(null)).toBe(false);
  });

  it('accepts long opaque registration tokens', () => {
    const token = `dGVzdF9yZWFsX3Rva2VuX${'x'.repeat(120)}`;
    expect(isLikelyValidFcmToken(token)).toBe(true);
  });
});
