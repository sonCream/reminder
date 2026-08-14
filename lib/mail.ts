import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

/**
 * 메일 발송. 로그인 링크와 보조 알림이 같이 쓴다.
 *
 * Gmail 은 2단계 인증을 켠 뒤 발급한 '앱 비밀번호'를 요구한다.
 * 계정 비밀번호로는 로그인되지 않는다.
 */

let transport: Transporter | null = null

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
}

function getTransport(): Transporter {
  if (transport) return transport
  const port = Number(process.env.SMTP_PORT ?? 465)
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
    },
  })
  return transport
}

export interface MailInput {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendMail(mail: MailInput): Promise<void> {
  if (!mailConfigured()) {
    throw new Error('SMTP 설정이 없습니다. .env 의 SMTP_USER / SMTP_PASS 를 채워 주세요.')
  }
  await getTransport().sendMail({
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
    ...mail,
  })
}
