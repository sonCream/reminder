import { NextResponse } from 'next/server'
import { createLoginToken, emailAllowed, normalizeEmail } from '@/lib/auth'
import { mailConfigured, sendMail } from '@/lib/mail'

export const dynamic = 'force-dynamic'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function loginUrl(request: Request, token: string): string {
  const origin = process.env.APP_DOMAIN
    ? `https://${process.env.APP_DOMAIN}`
    : new URL(request.url).origin
  return `${origin}/api/auth/verify?token=${encodeURIComponent(token)}`
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = normalizeEmail(String(body?.email ?? ''))

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: '이메일 주소를 확인해 주세요.' }, { status: 400 })
  }

  // ⚠️ 허용되지 않은 주소여도 같은 응답을 돌려준다.
  // 응답이 다르면 "이 주소는 등록돼 있다"는 사실이 새어 나간다.
  if (!emailAllowed(email)) {
    return NextResponse.json({ ok: true })
  }

  if (!mailConfigured()) {
    // ⚠️ 운영에서 링크를 응답에 실어 보내면 누구나 남의 주소로 로그인할 수 있다.
    //    메일을 못 보내는 상태면 차라리 로그인을 막는다.
    if (process.env.NODE_ENV === 'production') {
      console.error('[auth] SMTP 설정이 없어 로그인 메일을 보낼 수 없습니다.')
      return NextResponse.json(
        { error: '메일 발송이 설정되지 않았습니다. 관리자에게 문의해 주세요.' },
        { status: 503 },
      )
    }

    // 개발 중에는 SMTP 없이도 로그인할 수 있어야 한다.
    const devToken = await createLoginToken(email)
    const devUrl = loginUrl(request, devToken)
    console.log(`\n[auth] 로그인 링크 (${email})\n${devUrl}\n`)
    return NextResponse.json({ ok: true, devLink: devUrl })
  }

  const token = await createLoginToken(email)
  const url = loginUrl(request, token)

  try {
    await sendMail({
      to: email,
      subject: '리마인더 로그인 링크',
      text: `아래 링크를 눌러 로그인하세요. 15분 뒤 만료됩니다.\n\n${url}\n\n요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.`,
      html: `
        <div style="font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.6;color:#17161F">
          <h2 style="margin:0 0 16px;font-size:18px">리마인더 로그인</h2>
          <p style="margin:0 0 20px;color:#6E6B7E">아래 버튼을 눌러 로그인하세요. 15분 뒤 만료됩니다.</p>
          <a href="${url}" style="display:inline-block;padding:12px 20px;background:#A8571C;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">로그인하기</a>
          <p style="margin:24px 0 0;font-size:12px;color:#9C99AB">요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.</p>
        </div>`,
    })
  } catch (error) {
    console.error('[auth] 메일 발송 실패', error)
    return NextResponse.json(
      { error: '메일을 보내지 못했습니다. 서버의 SMTP 설정을 확인해 주세요.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
