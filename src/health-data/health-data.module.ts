import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PropertyModule } from '../property/property.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { UsersModule } from '../users/users.module';
import { HealthDataController } from './health-data.controller';
import { HealthDataService } from './health-data.service';

@Module({
  imports: [AuthModule, PropertyModule, UsersModule, RecommendationsModule],
  controllers: [HealthDataController],
  providers: [HealthDataService],
})
export class HealthDataModule {}
