// 앱 아이콘을 만든다. 디자인을 바꾸면 이 파일만 고치고 다시 실행하면 된다.
//   npm run icons
import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const ACCENT = '#A8571C'

/// 시계 문자판. maskable 아이콘은 바깥쪽이 잘려나가므로 여백(pad)을 더 준다.
function svg({ pad = 0 } = {}) {
  const size = 512
  const c = size / 2
  const r = (size / 2 - 96) * (1 - pad)
  const stroke = 34 * (1 - pad)
  const handLong = r * 0.58
  const handShort = r * 0.4

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${ACCENT}"/>
    <g fill="none" stroke="#FFFFFF" stroke-width="${stroke}" stroke-linecap="round">
      <circle cx="${c}" cy="${c}" r="${r}"/>
      <path d="M${c} ${c - handLong} L${c} ${c}"/>
      <path d="M${c} ${c} L${c + handShort} ${c + handShort * 0.5}"/>
    </g>
  </svg>`
}

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, pad: 0 },
  { file: 'public/icons/icon-512.png', size: 512, pad: 0 },
  { file: 'public/icons/icon-maskable-512.png', size: 512, pad: 0.22 },
  { file: 'public/apple-touch-icon.png', size: 180, pad: 0 },
]

await mkdir('public/icons', { recursive: true })

for (const t of targets) {
  await sharp(Buffer.from(svg({ pad: t.pad })))
    .resize(t.size, t.size)
    .png()
    .toFile(t.file)
  console.log(`${t.file} (${t.size}px)`)
}
