import { SCHEMA_VERSION } from '../common/wellness.constants';

export interface FcmPayloadInput {
  title: string;
  body: string;
  notificationId: string;
  recommendationId: string;
  type: string;
  featureId: string | null;
  deepLink: string | null;
}

export interface FcmPayload {
  notification: {
    title: string;
    body: string;
  };
  data: {
    notificationId: string;
    recommendationId: string;
    type: string;
    featureId: string;
    deepLink: string;
    schemaVersion: string;
  };
}

export function buildFcmPayload(input: FcmPayloadInput): FcmPayload {
  return {
    notification: {
      title: input.title,
      body: input.body,
    },
    data: {
      notificationId: input.notificationId,
      recommendationId: input.recommendationId,
      type: input.type,
      featureId: input.featureId ?? '',
      deepLink: input.deepLink ?? '',
      schemaVersion: SCHEMA_VERSION,
    },
  };
}
