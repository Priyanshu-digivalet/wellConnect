import { Module } from '@nestjs/common';
import { LifestylePatternsModule } from '../lifestyle-patterns/lifestyle-patterns.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [LifestylePatternsModule],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
