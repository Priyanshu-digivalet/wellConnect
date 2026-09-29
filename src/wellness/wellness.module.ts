import { Module } from '@nestjs/common';
import { FeedbackModule } from '../feedback/feedback.module';
import { HealthDataModule } from '../health-data/health-data.module';
import { LifestylePatternsModule } from '../lifestyle-patterns/lifestyle-patterns.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';

@Module({
  imports: [HealthDataModule, RecommendationsModule, FeedbackModule, LifestylePatternsModule],
})
export class WellnessModule {}
