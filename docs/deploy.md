# 배포 절차

EC2 서버에 접속한 상태에서 하는 작업이다.

**선행 조건** — [aws-setup.md](./aws-setup.md)의 ①~⑤가 끝나 있어야 한다.

- [ ] EC2 실행 중, 탄력적 IP 연결됨
- [ ] `reminder.creamhouse.net` 이 공개 DNS에서 조회됨
- [ ] RDS 생성됨, 엔드포인트 주소 확보
- [ ] 서버에 Docker 설치 및 `docker --version` 확인됨

---

## 1. 코드 배치

```bash
ssh -i key.pem ubuntu@<탄력적 IP>
git clone <저장소> reminder && cd reminder
```

## 2. `.env` 작성

```bash
cp .env.production.example .env
nano .env
```

채워야 할 값:

| 키 | 값 |
|---|---|
| `APP_DOMAIN` | `reminder.creamhouse.net` |
| `DATABASE_URL` | RDS 엔드포인트 (`?sslmode=require` 포함) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | **운영용으로 새로 발급** |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 위 공개키와 같은 값 |
| `NOTIFIER_CHANNELS` | `push` |

⚠️ **VAPID 키는 개발용을 재사용하지 않는다.** 로컬에서 `npm run vapid`로 새로 만들어 옮긴다.
그리고 **한 번 정한 뒤에는 절대 바꾸지 않는다.** 바꾸는 순간 모든 기기의 알림 구독이 무효가 되어, 사용자가 전부 다시 허용해야 한다.

⚠️ `.env`는 커밋하지 않는다.

## 3. 마이그레이션

```bash
docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
```

⚠️ **`migrate dev`가 아니라 `migrate deploy`다.**
`dev`는 스키마가 어긋났다고 판단하면 데이터를 지우고 다시 만들 수 있다. 운영에서 쓰면 안 된다.

## 4. 기동

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

빌드가 메모리 부족으로 죽으면 스왑을 추가한다. t3.small(2GB)에서 `next build`가 빠듯할 수 있다.

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
```

## 5. 인증서 발급 확인

```bash
docker compose -f docker-compose.prod.yml logs -f caddy
```

Caddy가 Let's Encrypt에서 인증서를 받아오는 로그가 보이면 성공이다.
실패한다면 원인은 대개 셋 중 하나다.

| 증상 | 원인 |
|---|---|
| DNS 확인 실패 | 도메인이 공개 DNS에 없거나 다른 IP를 가리킨다 |
| 연결 시간 초과 | 보안 그룹에서 **80 포트**가 막혀 있다 |
| 발급 횟수 초과 | 재시도를 너무 많이 했다. Let's Encrypt는 횟수 제한이 있으니 원인을 고친 뒤 다시 시도한다 |

---

## 6. 최종 확인

여기가 이 프로젝트의 진짜 검증이다.

1. PC 브라우저에서 `https://reminder.creamhouse.net` → **자물쇠 표시** 확인
2. **폰**으로 접속 → 공유 → **홈 화면에 추가**
3. 홈 화면 아이콘으로 실행 (주소창이 없어야 한다)
4. 설정 → **알림 켜기** → 권한 허용 → **테스트 알림 보내기**
5. 2분 뒤 리마인더를 만들고 **앱을 완전히 종료**
6. **알림이 오면 성공**

6번이 핵심이다. 앱이 꺼져 있는데도 알림이 온다는 것은,
PWA가 스스로 알림을 울리지 못하는 한계를 **서버 스케줄러로 넘었다**는 증명이다.

---

## 운영 메모

**배포 갱신**

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

**로그 보기**

```bash
docker compose -f docker-compose.prod.yml logs -f worker
```

**상태 확인**

```bash
docker compose -f docker-compose.prod.yml ps
```

**주의사항**

- `caddy_data` 볼륨에 인증서가 들어 있다. 지우면 재발급을 받는데 **Let's Encrypt는 발급 횟수 제한**이 있다.
- 데이터베이스는 RDS의 **자동 백업**에 의존한다. 보관 기간을 확인해둔다.
- Free plan 계정은 **6개월 뒤 자동으로 닫히고 리소스가 종료된다.** 계속 운영하려면 그 전에 유료 전환이 필요하다. 복구 기한은 90일이다.
