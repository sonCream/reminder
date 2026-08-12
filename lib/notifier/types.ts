/// 발송 한 건에 필요한 정보.
export interface NotificationPayload {
  userId: string
  reminderId: number
  title: string
  body: string
  /// 알림을 눌렀을 때 열 경로.
  url?: string
  /// 앱 아이콘에 숫자로 표시할 남은 개수. 푸시 채널에서만 의미가 있다.
  /// (알림 자체의 badge 아이콘과 헷갈리지 않도록 이름을 구분했다.)
  badgeCount?: number
}

/// 발송 수단 하나를 나타낸다.
///
/// 워커는 이 인터페이스만 알고, 실제 구현은 설정으로 갈아끼운다.
/// 덕분에 VAPID 키나 SMTP 계정이 없어도 console 구현으로 개발을 계속할 수 있고,
/// 나중에 카카오 알림톡을 붙일 때도 여기에 한 파일만 추가하면 된다.
export interface Notifier {
  readonly channel: string
  send(payload: NotificationPayload): Promise<void>
}
