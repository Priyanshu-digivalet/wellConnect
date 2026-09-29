import { Module } from '@nestjs/common';
import { DatabaseNotificationQueue } from './database-notification.queue';
import { FcmService } from './fcm.service';
import { NotificationPolicyService } from './notification-policy.service';
import { NOTIFICATION_QUEUE } from './notification.queue';
import { NotificationService } from './notification.service';
import { NotificationWorker } from './notification.worker';
import { NotificationsController } from './notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationPolicyService,
    FcmService,
    DatabaseNotificationQueue,
    { provide: NOTIFICATION_QUEUE, useExisting: DatabaseNotificationQueue },
    NotificationService,
    NotificationWorker,
  ],
  exports: [NotificationService, NotificationPolicyService, FcmService],
})
export class NotificationsModule {}
