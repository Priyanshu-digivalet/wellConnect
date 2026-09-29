import { Injectable, Logger } from '@nestjs/common';
import { NotificationQueue } from './notification.queue';

@Injectable()
export class DatabaseNotificationQueue implements NotificationQueue {
  private readonly logger = new Logger(DatabaseNotificationQueue.name);

  async enqueue(notificationId: string): Promise<void> {
    this.logger.log(`notification_enqueued notificationId=${notificationId}`);
  }
}
