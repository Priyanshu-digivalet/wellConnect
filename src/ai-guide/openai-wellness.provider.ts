import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AIRecommendation, WellnessAIContext, WellnessAIProvider } from './ai.types';
import { PromptBuilderService } from './prompt-builder.service';

@Injectable()
export class OpenAIWellnessProvider implements WellnessAIProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAIWellnessProvider.name);
  private client: OpenAI | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prompts: PromptBuilderService,
  ) {}

  async generateRecommendation(context: WellnessAIContext): Promise<AIRecommendation> {
    const apiKey = this.config.get<string>('openaiApiKey') ?? '';
    const model = this.config.get<string>('openaiModel') ?? '';
    if (!apiKey || !model) {
      throw new Error('OpenAI is not configured');
    }

    if (!this.client) {
      this.client = new OpenAI({ apiKey, timeout: 20_000, maxRetries: 1 });
    }

    const completion = await this.client.chat.completions.create({
      model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: this.prompts.systemPrompt(context.candidates.length > 0),
        },
        { role: 'user', content: this.prompts.buildUserPrompt(context) },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      this.logger.error('ai_call_failure provider=openai reason=empty_response');
      throw new Error('OpenAI returned an empty response');
    }

    try {
      return JSON.parse(content) as AIRecommendation;
    } catch {
      this.logger.error('ai_call_failure provider=openai reason=invalid_json');
      throw new Error('OpenAI returned invalid JSON');
    }
  }
}
