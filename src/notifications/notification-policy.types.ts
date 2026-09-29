export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH';

export interface PolicyInput {
  now: Date;
  timezone: string;
  quietStartHour: number;
  quietEndHour: number;
  notificationsEnabled: boolean;
  hasDevice: boolean;
  recommendationExpiresAt: Date;
  featureAvailable: boolean;
  hasFeature: boolean;
  duplicateNotification: boolean;
  lastNotificationAt: Date | null;
  cooldownHours: number;
  priority: NotificationPriority;
  eligible: boolean;
  /** When true (health-data ingest), send immediately and ignore cooldown/quiet-hours deferral. */
  forceNotify?: boolean;
}

export interface PolicyDecision {
  allow: boolean;
  action: 'SEND' | 'SCHEDULE' | 'SKIP';
  scheduledAt: Date | null;
  reason: string;
}
