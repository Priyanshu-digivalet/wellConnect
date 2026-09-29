import { Module } from '@nestjs/common';
import { LifestylePatternsController } from './lifestyle-patterns.controller';
import { LifestylePatternsService } from './lifestyle-patterns.service';
import { PatternDetectionService } from './pattern-detection.service';

@Module({
  controllers: [LifestylePatternsController],
  providers: [LifestylePatternsService, PatternDetectionService],
  exports: [LifestylePatternsService],
})
export class LifestylePatternsModule {}
