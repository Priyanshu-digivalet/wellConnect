export const NOTIFICATION_QUEUE = Symbol('NOTIFICATION_QUEUE');

export interface NotificationQueue {
  enqueue(notificationId: string): Promise<void>;
}
