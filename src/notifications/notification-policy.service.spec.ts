import { NotificationPolicyService } from './notification-policy.service';
import { PolicyInput } from './notification-policy.types';

describe('NotificationPolicyService', () => {
  const policy = new NotificationPolicyService();

  it('skips when notifications are disabled', () => {
    const decision = policy.evaluate(base({ notificationsEnabled: false }));
    expect(decision).toMatchObject({ allow: false, reason: 'NOTIFICATIONS_DISABLED' });
  });

  it('skips duplicate notifications', () => {
    const decision = policy.evaluate(base({ duplicateNotification: true }));
    expect(decision).toMatchObject({ allow: false, reason: 'DUPLICATE_NOTIFICATION' });
  });

  it('defers normal priority notifications during quiet hours', () => {
    const decision = policy.evaluate(
      base({ now: new Date('2026-09-29T18:00:00.000Z') }),
    );
    expect(decision.action).toBe('SCHEDULE');
    expect(decision.reason).toBe('QUIET_HOURS');
    expect(decision.scheduledAt?.toISOString()).toBe('2026-09-30T01:30:00.000Z');
  });

  it('allows a valid notification outside quiet hours', () => {
    const decision = policy.evaluate(base({ now: new Date('2026-09-29T06:30:00.000Z') }));
    expect(decision).toMatchObject({ allow: true, action: 'SEND', reason: 'ALLOWED' });
  });
});

function base(overrides: Partial<PolicyInput>): PolicyInput {
  return {
    now: new Date('2026-09-29T06:30:00.000Z'),
    timezone: 'Asia/Kolkata',
    quietStartHour: 22,
    quietEndHour: 7,
    notificationsEnabled: true,
    hasDevice: true,
    recommendationExpiresAt: new Date('2026-09-30T06:30:00.000Z'),
    featureAvailable: true,
    hasFeature: true,
    duplicateNotification: false,
    lastNotificationAt: null,
    cooldownHours: 4,
    priority: 'NORMAL',
    eligible: true,
    ...overrides,
  };
}
