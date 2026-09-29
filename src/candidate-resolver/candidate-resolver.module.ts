import { Module } from '@nestjs/common';
import { CandidateResolverService } from './candidate-resolver.service';

@Module({
  providers: [CandidateResolverService],
  exports: [CandidateResolverService],
})
export class CandidateResolverModule {}
