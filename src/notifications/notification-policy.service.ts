import { Injectable } from '@nestjs/common';
import { isWithinQuietHours, nextQuietHoursEnd } from '../common/timezone';
import { PolicyDecision, PolicyInput } from './notification-policy.types';

@Injectable()
export class NotificationPolicyService {
  evaluate(input: PolicyInput): PolicyDecision {
    if (!input.eligible) {
      return skip('NOT_ELIGIBLE');
    }
    if (!input.notificationsEnabled) {
      return skip('NOTIFICATIONS_DISABLED');
    }
    if (!input.hasDevice) {
      return skip('NO_DEVICE');
    }
    if (input.duplicateNotification) {
      return skip('DUPLICATE_NOTIFICATION');
    }
    if (input.recommendationExpiresAt.getTime() <= input.now.getTime()) {
      return skip('RECOMMENDATION_EXPIRED');
    }
    if (input.hasFeature && !input.featureAvailable) {
      return skip('FEATURE_UNAVAILABLE');
    }
    if (input.lastNotificationAt) {
      const elapsed = input.now.getTime() - input.lastNotificationAt.getTime();
      const cooldownMs = input.cooldownHours * 60 * 60 * 1000;
      if (elapsed < cooldownMs && input.priority !== 'HIGH') {
        return skip('NOTIFICATION_COOLDOWN');
      }
    }

    const inQuietHours = isWithinQuietHours(
      input.now,
      input.timezone,
      input.quietStartHour,
      input.quietEndHour,
    );
    if (inQuietHours && input.priority !== 'HIGH') {
      return {
        allow: true,
        action: 'SCHEDULE',
        scheduledAt: nextQuietHoursEnd(input.now, input.timezone, input.quietEndHour),
        reason: 'QUIET_HOURS',
      };
    }

    return {
      allow: true,
      action: 'SEND',
      scheduledAt: input.now,
      reason: 'ALLOWED',
    };
  }
}

function skip(reason: string): PolicyDecision {
  return { allow: false, action: 'SKIP', scheduledAt: null, reason };
}
