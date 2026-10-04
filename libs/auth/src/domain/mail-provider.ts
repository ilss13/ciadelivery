export interface MailMessage {
  to: string;
  token: string;
}

export interface MailProvider {
  sendPasswordReset(message: MailMessage): Promise<void>;
}

export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
