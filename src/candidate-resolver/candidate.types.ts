import { WellnessState } from '../decision-engine/decision.types';

export interface CandidateFeature {
  featureId: string;
  propertyId: string;
  featureType: string;
  name: string;
  category: string;
  enabled: boolean;
  available: boolean;
  deepLink: string;
}

export interface RecommendationHistoryItem {
  featureId: string | null;
  createdAt: Date;
}

export interface PreferenceSignalInput {
  featureId: string;
  preferenceScore: number;
}

export interface ResolverInput {
  state: WellnessState;
  propertyId: string;
  features: CandidateFeature[];
  history: RecommendationHistoryItem[];
  preferences: PreferenceSignalInput[];
  dismissedFeatureIds: string[];
  now: Date;
  cooldownHours: number;
}
