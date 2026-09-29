import { Injectable } from '@nestjs/common';
import {
  STATE_FEATURE_TYPES,
  STRONG_NEGATIVE_PREFERENCE,
} from '../common/wellness.constants';
import { CandidateFeature, ResolverInput } from './candidate.types';

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

    const eligible = input.features.filter((feature) => {
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
    });

    const typeOrder: string[] = [...allowed];
    return eligible
      .map((feature) => {
        const typeIndex = typeOrder.indexOf(feature.featureType);
        const typeScore =
          typeIndex === -1 ? 0 : (typeOrder.length - typeIndex) / typeOrder.length;
        const preferenceScore = preferences.get(feature.featureId) ?? 0;
        return { feature, score: typeScore + preferenceScore };
      })
      .sort(
        (left, right) =>
          right.score - left.score || left.feature.name.localeCompare(right.feature.name),
      )
      .map((item) => item.feature);
  }
}
