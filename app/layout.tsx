import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '리마인더',
  description: '놓친 알림을 먼저 보여주는 리마인더',
  // 홈 화면에 추가했을 때 앱처럼 보이게 하는 설정
  appleWebApp: {
    capable: true,
    title: '리마인더',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 폰에서 입력칸을 눌렀을 때 화면이 확대되지 않게 한다. 앱 느낌을 깨는 대표적인 동작.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F1F2F6' },
    { media: '(prefers-color-scheme: dark)', color: '#0F0E14' },
  ],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
