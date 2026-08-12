import type { MetadataRoute } from 'next'

/// 홈 화면에 추가했을 때 앱처럼 보이게 하는 설정.
/// display: 'standalone' 이 주소창을 없앤다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '리마인더',
    short_name: '리마인더',
    description: '놓친 알림을 먼저 보여주는 리마인더',
    lang: 'ko',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F1F2F6',
    theme_color: '#F1F2F6',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      // maskable 은 안드로이드가 아이콘 모양대로 잘라낼 때 쓴다. 여백이 더 있는 버전.
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
