import { Injectable } from '@nestjs/common';
import { AICandidate, WellnessAIContext } from './ai.types';

@Injectable()
export class PromptBuilderService {
  systemPrompt(hasCandidates: boolean): string {
    if (hasCandidates) {
      return [
        'You are a wellness guide for a residential property app.',
        'You personalize wording only. You do not make wellness-state decisions.',
        'Choose exactly one featureId from the supplied candidates.',
        'Do not invent services, facilities, outlets, availability, or deep links.',
        'Do not diagnose, prescribe medication, or make medical claims.',
        'Do not mention disease, medication, or clinical treatment.',
        'Return JSON with this shape:',
        '{"recommendation":{"type":"WELLNESS_ACTIVITY","category":"RECOVERY|ACTIVITY|SLEEP|DINING|GENERAL","featureId":"...","title":"...","message":"...","reasonCode":"...","confidence":0.8},"notification":{"eligible":true,"priority":"LOW|NORMAL|HIGH","delivery":"PUSH","scheduleType":"IMMEDIATE"},"safety":{"medicalAdvice":false}}',
        'Use the reasonCode provided in the context. Keep the title under 80 characters and the message under 320 characters.',
        'Omit deepLink. The backend supplies it.',
      ].join(' ');
    }

    return [
      'You are a wellness guide for a residential property app.',
      'No property facilities are available, so suggest a simple personal wellness action based only on the supplied activity, sleep, recovery, and trend fields.',
      'You personalize wording only. You do not make wellness-state decisions or invent facilities.',
      'Examples of good suggestions: a short walk when activity is low, gentle stretching when things look balanced, a calmer evening when sleep is light, or a brief check-in on how rested they feel when sleep has been high.',
      'Do not diagnose, prescribe medication, or make medical claims.',
      'Do not mention disease, medication, or clinical treatment.',
      'Return JSON with this shape:',
      '{"recommendation":{"type":"DAILY_WELLNESS","category":"RECOVERY|ACTIVITY|SLEEP|GENERAL","featureId":null,"title":"...","message":"...","reasonCode":"...","confidence":0.8},"notification":{"eligible":true,"priority":"LOW|NORMAL|HIGH","delivery":"PUSH","scheduleType":"IMMEDIATE"},"safety":{"medicalAdvice":false}}',
      'featureId must be null. Omit deepLink.',
      'Use the reasonCode provided in the context. Keep the title under 80 characters and the message under 320 characters.',
    ].join(' ');
  }

  buildUserPrompt(context: WellnessAIContext): string {
    return JSON.stringify({
      activity: context.activity,
      sleep: context.sleep,
      recovery: context.recovery,
      activityTrend: context.activityTrend,
      sleepTrend: context.sleepTrend,
      trend: context.reasonCode,
      state: context.state,
      reasonCode: context.reasonCode,
      consistencyScore: context.consistencyScore,
      candidates: context.candidates.map((candidate) => this.publicCandidate(candidate)),
      preferences: context.preferences,
      mode: context.candidates.length === 0 ? 'PERSONAL_CARE' : 'PROPERTY_FEATURE',
    });
  }

  private publicCandidate(candidate: AICandidate) {
    return {
      featureId: candidate.featureId,
      name: candidate.name,
      category: candidate.category,
      featureType: candidate.featureType,
    };
  }
}
