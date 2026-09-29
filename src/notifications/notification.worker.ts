import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationWorker {
  private readonly logger = new Logger(NotificationWorker.name);
  private running = false;

  constructor(private readonly notifications: NotificationService) {}

  @Interval(15_000)
  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.notifications.dispatchDue(new Date());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'notification_worker_failed';
      this.logger.error(`notification_worker_failed message=${message}`);
    } finally {
      this.running = false;
    }
  }
}
