import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { buildFcmPayload, FcmPayloadInput } from './fcm-payload';

export interface FcmSendResult {
  ok: boolean;
  providerMessageId?: string;
  errorCode?: string;
}

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private ready = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.config.get<string>('firebaseProjectId') ?? '';
    const clientEmail = this.config.get<string>('firebaseClientEmail') ?? '';
    const privateKey = (this.config.get<string>('firebasePrivateKey') ?? '').replace(
      /\\n/g,
      '\n',
    );
    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('fcm_not_configured');
      return;
    }
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    }
    this.ready = true;
    this.logger.log('fcm_configured');
  }

  isConfigured(): boolean {
    return this.ready;
  }

  async send(token: string, input: FcmPayloadInput): Promise<FcmSendResult> {
    if (!this.ready) {
      return { ok: false, errorCode: 'FCM_NOT_CONFIGURED' };
    }
    const payload = buildFcmPayload(input);
    try {
      const providerMessageId = await getMessaging().send({
        token,
        notification: payload.notification,
        data: payload.data,
        android: { priority: 'high' },
      });
      this.logger.log(
        `fcm_success notificationId=${input.notificationId} providerMessageId=${providerMessageId}`,
      );
      return { ok: true, providerMessageId };
    } catch (error) {
      const errorCode = readErrorCode(error);
      this.logger.error(
        `fcm_failure notificationId=${input.notificationId} code=${errorCode}`,
      );
      return { ok: false, errorCode };
    }
  }
}

function readErrorCode(error: unknown): string {
  if (typeof error === 'object' && error && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return 'FCM_SEND_FAILED';
}
