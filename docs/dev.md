# 로컬 개발 메모

## 실행

```bash
docker compose up -d          # db + app + worker
docker compose logs -f worker # 알림 발송 확인
```

`http://localhost:3000` 으로 접속한다. 로그인이 없고 앱이 열리면서 계정 키를 스스로 만든다.

## ⚠️ 의존성을 추가했을 때

컨테이너의 `node_modules` 는 **바인드 마운트가 아니라 별도 볼륨**이다.
(Windows 에서 바인드 마운트로 두면 파일이 수만 개라 매우 느려진다.)

그래서 호스트에서 `npm install` 을 해도 **컨테이너 안에는 반영되지 않는다.**
`Module not found` 가 나면 이것이다.

```bash
npm install <패키지>                      # 호스트 (타입 검사·에디터용)
docker compose exec app npm install       # 컨테이너 (실행용)
docker compose restart app
```

Prisma 스키마를 바꿨을 때도 마찬가지다.

```bash
npx prisma migrate dev --name <이름>
docker compose exec app npx prisma generate
docker compose restart app worker
```

## ⚠️ 새 파일을 만들었을 때

Windows 바인드 마운트에서는 파일 변경 감지가 온전하지 않다.
`docker-compose.yml` 에 폴링을 켜 두었지만, **새로 만든 파일이나 디렉터리는 놓칠 때가 있다.**
화면이 그대로면 컨테이너를 재시작한다.

```bash
docker compose restart app
```

## 검증 스크립트

```bash
npm run check:repeat    # 반복 날짜 계산 (말일·윤년·주말 건너뛰기)
npx tsc --noEmit        # 타입 검사
```

## 테스트 데이터

```bash
npx tsx scripts/seed-demo.ts            # 리마인더 3건 (지난 것 1건 포함)
npx tsx scripts/check-repeat-e2e.ts     # 반복 전진 확인용
npx tsx worker/index.ts --once          # 워커 1회 실행
```

## 초기화

```bash
docker compose down -v      # ⚠️ DB 데이터까지 삭제
docker compose up -d
npx prisma migrate deploy
```

## 폰에서 확인하려면

`localhost` 는 PC 브라우저에서만 예외적으로 보안 컨텍스트로 취급된다.
폰에서 `192.168.x.x` 로 접속하면 서비스 워커가 등록되지 않아
설치·알림·키 저장이 모두 동작하지 않는다.

폰 테스트는 배포된 주소에서 하거나, Cloudflare Tunnel 같은 도구로 HTTPS 주소를 만들어야 한다.
