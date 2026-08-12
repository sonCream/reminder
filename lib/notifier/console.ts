import type { Notifier, NotificationPayload } from './types'

/// 아무 설정 없이 동작하는 발송 수단.
/// 스케줄러가 제 시각에 깨어나는지만 검증하고 싶을 때 쓴다.
export class ConsoleNotifier implements Notifier {
  readonly channel = 'console'

  async send(payload: NotificationPayload): Promise<void> {
    const at = new Date().toISOString()
    console.log(`[알림 ${at}] #${payload.reminderId} ${payload.title} — ${payload.body}`)
  }
}
