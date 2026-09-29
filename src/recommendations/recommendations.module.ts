import { Module } from '@nestjs/common';
import { AiGuideModule } from '../ai-guide/ai-guide.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CandidateResolverModule } from '../candidate-resolver/candidate-resolver.module';
import { DecisionEngineModule } from '../decision-engine/decision-engine.module';
import { FeedbackModule } from '../feedback/feedback.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [
    AnalyticsModule,
    DecisionEngineModule,
    CandidateResolverModule,
    AiGuideModule,
    NotificationsModule,
    FeedbackModule,
    UsersModule,
  ],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
