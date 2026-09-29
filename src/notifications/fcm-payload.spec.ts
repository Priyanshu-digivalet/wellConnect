import { buildFcmPayload } from './fcm-payload';

describe('FCM payload', () => {
  it('builds a notification and data payload from the property deep link', () => {
    const payload = buildFcmPayload({
      title: 'Time to unwind',
      body: 'The spa is available if you would like some time to relax.',
      notificationId: 'ntf_82931',
      recommendationId: 'rec_8f92ab',
      type: 'WELLNESS_RECOMMENDATION',
      featureId: 'service_spa',
      deepLink: 'app://service/spa',
    });

    expect(payload.notification).toEqual({
      title: 'Time to unwind',
      body: 'The spa is available if you would like some time to relax.',
    });
    expect(payload.data).toEqual({
      notificationId: 'ntf_82931',
      recommendationId: 'rec_8f92ab',
      type: 'WELLNESS_RECOMMENDATION',
      featureId: 'service_spa',
      deepLink: 'app://service/spa',
      schemaVersion: '1.0',
    });
    expect(payload).not.toHaveProperty('token');
    expect(JSON.stringify(payload)).not.toContain('fcm');
  });
});
