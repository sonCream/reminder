import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * 브라우저가 푸시 구독에 쓸 VAPID 공개키를 내려준다.
 *
 * `NEXT_PUBLIC_*` 변수를 쓰지 않는 이유:
 * 그 값들은 `next build` 시점에 코드 안으로 박힌다. 도커로 이미지를 구울 때는
 * .env 가 없으므로 undefined 로 굳어버린다. 실행 시점에 읽어서 내려주면
 * 같은 이미지를 개발·운영 어디에나 쓸 수 있고, 키를 바꿔도 재빌드가 필요 없다.
 *
 * 공개키는 이름 그대로 공개돼도 되는 값이다. 비밀은 VAPID_PRIVATE_KEY 쪽이다.
 */
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null
  return NextResponse.json({ key })
}
