import { CandidateFeature } from './candidate.types';
import { CandidateResolverService } from './candidate-resolver.service';

describe('CandidateResolverService', () => {
  const resolver = new CandidateResolverService();
  const now = new Date('2026-09-29T12:00:00.000Z');

  const features: CandidateFeature[] = [
    feature('facility_gym', 'property_001', 'GYM', 'Gym', true, true),
    feature('facility_pool', 'property_001', 'POOL', 'Swimming Pool', true, true),
    feature('service_spa', 'property_001', 'SPA', 'Spa', true, true),
    feature('outlet_restaurant', 'property_001', 'RESTAURANT', 'Restaurant', true, true),
    feature('service_spa_other', 'property_999', 'SPA', 'Other Spa', true, true),
    feature('facility_gym_disabled', 'property_001', 'GYM', 'Closed Gym', false, true),
    feature('facility_pool_closed', 'property_001', 'POOL', 'Closed Pool', true, false),
  ];

  it('excludes unavailable, disabled, and wrong-property features', () => {
    const resolved = resolver.resolve({
      state: 'RECOVERY_NEEDED',
      propertyId: 'property_001',
      features,
      history: [],
      preferences: [],
      dismissedFeatureIds: [],
      now,
      cooldownHours: 20,
    });

    expect(resolved.map((item) => item.featureId)).toEqual(['service_spa', 'facility_pool']);
  });

  it('avoids a feature that was recommended inside the cooldown', () => {
    const resolved = resolver.resolve({
      state: 'RECOVERY_NEEDED',
      propertyId: 'property_001',
      features,
      history: [{ featureId: 'service_spa', createdAt: new Date('2026-09-29T10:00:00.000Z') }],
      preferences: [],
      dismissedFeatureIds: [],
      now,
      cooldownHours: 20,
    });

    expect(resolved.map((item) => item.featureId)).toEqual(['facility_pool']);
  });

  it('ranks a preferred feature ahead of the default order', () => {
    const resolved = resolver.resolve({
      state: 'ACTIVE',
      propertyId: 'property_001',
      features,
      history: [],
      preferences: [{ featureId: 'facility_pool', preferenceScore: 0.9 }],
      dismissedFeatureIds: [],
      now,
      cooldownHours: 20,
    });

    expect(resolved[0]?.featureId).toBe('facility_pool');
  });
});

function feature(
  featureId: string,
  propertyId: string,
  featureType: string,
  name: string,
  enabled: boolean,
  available: boolean,
): CandidateFeature {
  return {
    featureId,
    propertyId,
    featureType,
    name,
    category: 'WELLNESS',
    enabled,
    available,
    deepLink: `app://feature/${featureId}`,
    tags: [],
  };
}
