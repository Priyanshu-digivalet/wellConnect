import { Injectable } from '@nestjs/common';
import {
  GENTLE_FEATURE_TAGS,
  INTENSE_FEATURE_TAGS,
  STATE_FEATURE_TYPES,
  STRONG_NEGATIVE_PREFERENCE,
} from '../common/wellness.constants';
import { CandidateFeature, ResolverInput } from './candidate.types';

type LifestyleHints = ResolverInput['lifestyleHints'];

@Injectable()
export class CandidateResolverService {
  resolve(input: ResolverInput): CandidateFeature[] {
    const allowed = STATE_FEATURE_TYPES[input.state];
    const allowedTypes = new Set<string>(allowed);
    const cooldownMs = input.cooldownHours * 60 * 60 * 1000;
    const recentFeatureIds = new Set(
      input.history
        .filter(
          (item) =>
            item.featureId != null &&
            input.now.getTime() - item.createdAt.getTime() < cooldownMs,
        )
        .map((item) => item.featureId as string),
    );
    const preferences = new Map(
      input.preferences.map((item) => [item.featureId, item.preferenceScore]),
    );
    const dismissed = new Set(input.dismissedFeatureIds);

    const eligible = input.features.filter((feature) =>
      this.isEligible(feature, input, allowedTypes, recentFeatureIds, dismissed, preferences),
    );

    // If cooldown exhausted all candidates, still recommend from the property catalog
    // (important when health-data syncs frequently or metrics are sparse).
    const pool =
      eligible.length > 0
        ? eligible
        : input.features.filter((feature) =>
            this.isEligible(feature, input, allowedTypes, new Set(), dismissed, preferences),
          );

    const typeOrder: string[] = [...allowed];
    return pool
      .map((feature) => {
        const typeIndex = typeOrder.indexOf(feature.featureType);
        const typeScore =
          typeIndex === -1 ? 0 : (typeOrder.length - typeIndex) / typeOrder.length;
        const preferenceScore = preferences.get(feature.featureId) ?? 0;
        const lifestyleBoost = this.lifestyleBoost(feature, input.lifestyleHints);
        return { feature, score: typeScore + preferenceScore + lifestyleBoost };
      })
      .sort(
        (left, right) =>
          right.score - left.score || left.feature.name.localeCompare(right.feature.name),
      )
      .map((item) => item.feature);
  }

  private isEligible(
    feature: CandidateFeature,
    input: ResolverInput,
    allowedTypes: Set<string>,
    recentFeatureIds: Set<string>,
    dismissed: Set<string>,
    preferences: Map<string, number>,
  ): boolean {
    if (feature.propertyId !== input.propertyId) {
      return false;
    }
    if (!feature.enabled || !feature.available) {
      return false;
    }
    if (!allowedTypes.has(feature.featureType)) {
      return false;
    }
    if (!feature.deepLink.startsWith('app://')) {
      return false;
    }
    if (recentFeatureIds.has(feature.featureId)) {
      return false;
    }
    if (dismissed.has(feature.featureId)) {
      return false;
    }
    if ((preferences.get(feature.featureId) ?? 0) <= STRONG_NEGATIVE_PREFERENCE) {
      return false;
    }
    return true;
  }

  private lifestyleBoost(
    feature: CandidateFeature,
    hints: LifestyleHints,
  ): number {
    if (!hints) {
      return 0;
    }
    const tags = feature.tags.map((tag) => tag.toLowerCase());
    const gentle = tags.some((tag) => GENTLE_FEATURE_TAGS.has(tag));
    const intense = tags.some((tag) => INTENSE_FEATURE_TAGS.has(tag));
    if (hints.preferGentleActivities && gentle) {
      return 0.2;
    }
    if (!hints.preferGentleActivities && intense && tags.length > 0) {
      return 0.08;
    }
    return 0;
  }
}
