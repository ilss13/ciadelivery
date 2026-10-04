import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, AppConfig, JsonLogger } from '@ciadelivery/shared';
import { MailMessage, MailProvider } from '../domain/mail-provider';

@Injectable()
export class LoggingMailProvider implements MailProvider {
  private readonly logger = new JsonLogger();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async sendPasswordReset(message: MailMessage): Promise<void> {
    const includeToken =
      this.config.logPasswordReset &&
      (this.config.nodeEnv === 'local' || this.config.nodeEnv === 'development');
    if (includeToken) {
      this.logger.log(
        `Password reset for ${message.to} value ${message.token}`,
        'LoggingMailProvider',
      );
      return;
    }

    this.logger.log(
      `Password reset mail dispatched to ${message.to}`,
      'LoggingMailProvider',
    );
  }
}
