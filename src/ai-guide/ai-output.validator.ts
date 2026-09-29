import { AICandidate } from './ai.types';

export interface ValidationFailure {
  ok: false;
  code:
    | 'MALFORMED_AI_RESPONSE'
    | 'UNKNOWN_FEATURE'
    | 'INVALID_DEEP_LINK'
    | 'MEDICAL_CLAIM'
    | 'SAFETY_VIOLATION';
  message: string;
}

export interface ValidatedRecommendation {
  type: string;
  category: string;
  featureId: string | null;
  featureName: string | null;
  deepLink: string | null;
  title: string;
  message: string;
  reasonCode: string;
  confidence: number;
  notification: {
    eligible: boolean;
    priority: 'LOW' | 'NORMAL' | 'HIGH';
    delivery: 'PUSH';
    scheduleType: 'IMMEDIATE' | 'DEFERRED';
  };
}

export type ValidationResult =
  | { ok: true; value: ValidatedRecommendation }
  | ValidationFailure;

const MEDICAL_CLAIM =
  /\b(diagnos(?:is|e|ed|ing)?|disease|medication|prescription|prescribe|diabetes|cancer|hypertension|blood pressure|disorder|illness|symptom|clinical|dosage|milligrams?|\bmg\b|consult (?:a |your )?(?:physician|doctor)|heart disease|medical condition|arrhythmia|treatment)\b/i;

const ALLOWED_CATEGORIES = new Set([
  'RECOVERY',
  'ACTIVITY',
  'SLEEP',
  'DINING',
  'GENERAL',
  'WELLNESS',
  'FITNESS',
]);

export class AIOutputValidator {
  validate(
    response: unknown,
    candidates: AICandidate[],
    expectedReasonCode: string,
  ): ValidationResult {
    if (!isRecord(response) || !isRecord(response.recommendation)) {
      return fail('MALFORMED_AI_RESPONSE', 'AI response is missing recommendation');
    }
    if (!isRecord(response.notification) || !isRecord(response.safety)) {
      return fail('MALFORMED_AI_RESPONSE', 'AI response is missing notification or safety');
    }

    const recommendation = response.recommendation;
    const notification = response.notification;
    const safety = response.safety;
    const featureId = recommendation.featureId;
    const title = recommendation.title;
    const message = recommendation.message;
    const type = recommendation.type;
    const category = recommendation.category;
    const hasCandidates = candidates.length > 0;

    if (
      typeof title !== 'string' ||
      typeof message !== 'string' ||
      typeof type !== 'string' ||
      typeof category !== 'string'
    ) {
      return fail('MALFORMED_AI_RESPONSE', 'AI recommendation fields are invalid');
    }
    if (!title.trim() || title.length > 80 || !message.trim() || message.length > 320) {
      return fail('MALFORMED_AI_RESPONSE', 'AI title or message is empty or too long');
    }
    if (!ALLOWED_CATEGORIES.has(category)) {
      return fail('MALFORMED_AI_RESPONSE', 'AI recommendation category is not allowed');
    }
    if (typeof recommendation.confidence !== 'number' || !Number.isFinite(recommendation.confidence)) {
      return fail('MALFORMED_AI_RESPONSE', 'AI confidence must be a number');
    }
    if (recommendation.confidence < 0 || recommendation.confidence > 1) {
      return fail('MALFORMED_AI_RESPONSE', 'AI confidence must be between 0 and 1');
    }
    if (recommendation.reasonCode !== expectedReasonCode) {
      return fail('MALFORMED_AI_RESPONSE', 'AI reason code does not match the decision engine');
    }
    if (safety.medicalAdvice !== false) {
      return fail('SAFETY_VIOLATION', 'AI response was flagged as medical advice');
    }
    if (MEDICAL_CLAIM.test(title) || MEDICAL_CLAIM.test(message)) {
      return fail('MEDICAL_CLAIM', 'AI response contains a medical claim');
    }

    let resolvedFeatureId: string | null = null;
    let featureName: string | null = null;
    let deepLink: string | null = null;

    if (hasCandidates) {
      if (typeof featureId !== 'string') {
        return fail('MALFORMED_AI_RESPONSE', 'AI recommendation fields are invalid');
      }
      const candidate = candidates.find((item) => item.featureId === featureId);
      if (!candidate) {
        return fail('UNKNOWN_FEATURE', 'AI selected a feature that was not supplied');
      }
      if (
        typeof recommendation.deepLink === 'string' &&
        recommendation.deepLink !== candidate.deepLink
      ) {
        return fail('INVALID_DEEP_LINK', 'AI deep link does not match the property feature');
      }
      resolvedFeatureId = candidate.featureId;
      featureName = candidate.name;
      deepLink = candidate.deepLink;
    } else if (featureId != null) {
      return fail('UNKNOWN_FEATURE', 'AI selected a feature when no candidates were supplied');
    }

    const priority = notification.priority;
    const delivery = notification.delivery;
    const scheduleType = notification.scheduleType;
    if (priority !== 'LOW' && priority !== 'NORMAL' && priority !== 'HIGH') {
      return fail('MALFORMED_AI_RESPONSE', 'AI notification priority is invalid');
    }
    if (delivery !== 'PUSH') {
      return fail('MALFORMED_AI_RESPONSE', 'AI notification delivery must be PUSH');
    }
    if (scheduleType !== 'IMMEDIATE' && scheduleType !== 'DEFERRED') {
      return fail('MALFORMED_AI_RESPONSE', 'AI notification schedule is invalid');
    }
    if (typeof notification.eligible !== 'boolean') {
      return fail('MALFORMED_AI_RESPONSE', 'AI notification eligibility is invalid');
    }

    return {
      ok: true,
      value: {
        type,
        category,
        featureId: resolvedFeatureId,
        featureName,
        deepLink,
        title: title.trim(),
        message: message.trim(),
        reasonCode: expectedReasonCode,
        confidence: recommendation.confidence,
        notification: {
          eligible: notification.eligible,
          priority,
          delivery: 'PUSH',
          scheduleType,
        },
      },
    };
  }
}

function fail(code: ValidationFailure['code'], message: string): ValidationFailure {
  return { ok: false, code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
