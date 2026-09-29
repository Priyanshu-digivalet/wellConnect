import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIRecommendation, WellnessAIContext, WellnessAIProvider } from './ai.types';
import { DemoWellnessProvider } from './demo-wellness.provider';
import { OpenAIWellnessProvider } from './openai-wellness.provider';

@Injectable()
export class AiGuideService {
  private readonly logger = new Logger(AiGuideService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly demo: DemoWellnessProvider,
    private readonly openai: OpenAIWellnessProvider,
  ) {}

  async generate(context: WellnessAIContext): Promise<{
    provider: string;
    recommendation: AIRecommendation;
  }> {
    const provider = this.selectProvider();
    try {
      const recommendation = await provider.generateRecommendation(context);
      this.logger.log(`ai_call_success provider=${provider.name}`);
      return { provider: provider.name, recommendation };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ai_call_failed';
      this.logger.error(`ai_call_failure provider=${provider.name} message=${message}`);
      throw error;
    }
  }

  private selectProvider(): WellnessAIProvider {
    if (this.config.get<boolean>('demoMode')) {
      return this.demo;
    }
    const requested = this.config.get<string>('aiProvider') ?? 'openai';
    if (requested === 'openai') {
      const apiKey = this.config.get<string>('openaiApiKey') ?? '';
      const model = this.config.get<string>('openaiModel') ?? '';
      if (!apiKey || !model) {
        this.logger.warn('ai_config_missing_using_demo_provider');
        return this.demo;
      }
      return this.openai;
    }
    this.logger.warn(`unknown_ai_provider provider=${requested} using_demo_provider`);
    return this.demo;
  }
}
