import nodemailer from 'nodemailer'
import type { Notifier, NotificationPayload } from './types'

/// Gmail SMTP 기반 보조 알림.
///
/// Gmail은 2단계 인증을 켠 뒤 발급한 '앱 비밀번호'를 요구한다.
/// 계정 비밀번호로는 로그인되지 않는다(구글이 저보안 앱 접속을 차단했다).
export class EmailNotifier implements Notifier {
  readonly channel = 'email'

  private transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: Number(process.env.SMTP_PORT ?? 465) === 465,
    auth: {
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
    },
  })

  async send(payload: NotificationPayload): Promise<void> {
    const to = process.env.MAIL_TO ?? process.env.SMTP_USER
    if (!to) throw new Error('받는 주소가 없습니다. MAIL_TO 또는 SMTP_USER를 설정하세요.')

    await this.transport.sendMail({
      from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
      to,
      subject: payload.title,
      text: payload.body,
    })
  }
}
