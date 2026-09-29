import { HttpException, HttpStatus } from '@nestjs/common';

export interface AppErrorBody {
  code: string;
  message: string;
  details: unknown[];
}

export class AppException extends HttpException {
  constructor(
    code: string,
    message: string,
    status: HttpStatus,
    details: unknown[] = [],
  ) {
    const body: AppErrorBody = { code, message, details };
    super(body, status);
  }
}
