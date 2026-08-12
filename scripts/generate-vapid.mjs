// VAPID 키 한 쌍을 만든다. 한 번만 만들고 계속 재사용한다.
//
// ⚠️ 키를 바꾸면 기존 푸시 구독이 전부 무효가 되어, 모든 기기에서 알림을 다시 허용해야 한다.
//    운영에 올린 뒤에는 절대 재발급하지 않는다.
import webpush from 'web-push'

const { publicKey, privateKey } = webpush.generateVAPIDKeys()

console.log(`
아래 세 줄을 .env 에 넣으세요.

VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}
`)
