import { sendMail } from '../mail'
import type { Notifier, NotificationPayload } from './types'

/// 보조 알림. 푸시를 못 받는 상황을 위한 예비 수단이다.
export class EmailNotifier implements Notifier {
  readonly channel = 'email'

  async send(payload: NotificationPayload): Promise<void> {
    const to = process.env.MAIL_TO ?? process.env.SMTP_USER
    if (!to) throw new Error('받는 주소가 없습니다. MAIL_TO 또는 SMTP_USER를 설정하세요.')

    await sendMail({ to, subject: payload.title, text: payload.body || payload.title })
  }
}
