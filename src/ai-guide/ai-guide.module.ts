import { Module } from '@nestjs/common';
import { AiGuideService } from './ai-guide.service';
import { AIOutputValidator } from './ai-output.validator';
import { DemoWellnessProvider } from './demo-wellness.provider';
import { OpenAIWellnessProvider } from './openai-wellness.provider';
import { PromptBuilderService } from './prompt-builder.service';

@Module({
  providers: [
    PromptBuilderService,
    DemoWellnessProvider,
    OpenAIWellnessProvider,
    AiGuideService,
    AIOutputValidator,
  ],
  exports: [AiGuideService, AIOutputValidator, PromptBuilderService, DemoWellnessProvider],
})
export class AiGuideModule {}
