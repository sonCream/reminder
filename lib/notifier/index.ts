import type { Notifier } from './types'
import { ConsoleNotifier } from './console'
import { EmailNotifier } from './email'
import { PushNotifier } from './push'

export type { Notifier, NotificationPayload } from './types'

const registry: Record<string, () => Notifier> = {
  console: () => new ConsoleNotifier(),
  email: () => new EmailNotifier(),
  push: () => new PushNotifier(),
}

const cache = new Map<string, Notifier>()

/// 채널 이름으로 발송 수단을 가져온다.
export function getNotifier(channel: string): Notifier {
  const cached = cache.get(channel)
  if (cached) return cached

  const make = registry[channel]
  if (!make) throw new Error(`알 수 없는 발송 채널입니다: ${channel}`)

  const notifier = make()
  cache.set(channel, notifier)
  return notifier
}

/// .env의 NOTIFIER_CHANNELS로 켜둔 채널 목록.
/// 개발 초기에는 console 하나만 켜두면 VAPID/SMTP 없이 스케줄러를 검증할 수 있다.
export function enabledChannels(): string[] {
  return (process.env.NOTIFIER_CHANNELS ?? 'console')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
