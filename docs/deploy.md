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
git clone https://github.com/sonCream/reminder.git && cd reminder
```

> 저장소가 **비공개**라면 위 명령이 인증을 요구한다. 두 가지 방법이 있다.
>
> **(A) 배포 키 — 서버에 권장.** EC2에서 키를 만들고 공개키를 저장소에 등록한다.
> ```bash
> ssh-keygen -t ed25519 -C "ec2-deploy" -f ~/.ssh/id_ed25519 -N ""
> cat ~/.ssh/id_ed25519.pub
> ```
> 출력된 값을 GitHub → 저장소 → Settings → Deploy keys → Add deploy key 에 붙여넣고
> (쓰기 권한은 주지 않는다), 이후 SSH 주소로 clone 한다.
> ```bash
> git clone git@github.com:sonCream/reminder.git && cd reminder
> ```
>
> **(B) 개인 액세스 토큰.** 간단하지만 토큰이 `.git/config` 에 남으므로 임시로만 쓴다.

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
| `NOTIFIER_CHANNELS` | `push` |
| `SMTP_USER` / `SMTP_PASS` | Gmail 주소와 **앱 비밀번호** ⚠️ 로그인에 필수 |
| `AUTH_OWNER_EMAIL` | 기존 데이터를 넘겨받을 주소 ⚠️ 아래 참고 |
| `AUTH_ALLOWED_EMAILS` | 로그인 허용 주소(쉼표 구분). 비우면 누구나 가입 |

⚠️ **SMTP 를 설정하지 않으면 로그인 자체가 불가능하다.**
매직 링크는 메일로만 전달된다. 운영에서는 메일을 못 보낼 때 링크를 응답에 싣지 않고
503 을 돌려주므로(그렇게 하지 않으면 누구나 남의 주소로 로그인할 수 있다),
SMTP 없이 배포하면 본인도 못 들어간다.

Gmail 은 2단계 인증을 켠 뒤 **앱 비밀번호**를 발급받아 `SMTP_PASS` 에 넣는다.
계정 비밀번호로는 로그인되지 않는다.

⚠️ **`AUTH_OWNER_EMAIL` 을 반드시 지정한다.**
인증을 붙이기 전에 쌓인 리마인더는 `local` 계정에 묶여 있고,
이 주소로 처음 로그인하는 사람이 그 데이터를 넘겨받는다.
비워 두면 **먼저 로그인한 아무나** 가져간다.

⚠️ **VAPID 키는 개발용을 재사용하지 않는다.** 로컬에서 `npm run vapid`로 새로 만들어 옮긴다.
그리고 **한 번 정한 뒤에는 절대 바꾸지 않는다.** 바꾸는 순간 모든 기기의 알림 구독이 무효가 되어, 사용자가 전부 다시 허용해야 한다.

⚠️ `.env`는 커밋하지 않는다.

## 3. 마이그레이션

```bash
docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
```

⚠️ **`migrate dev`가 아니라 `migrate deploy`다.**
`dev`는 스키마가 어긋났다고 판단하면 데이터를 지우고 다시 만들 수 있다. 운영에서 쓰면 안 된다.

> 로그인 기능을 처음 올릴 때는 이 단계에서 `User` · `Session` · `LoginToken` 테이블이 만들어지고,
> 기존 데이터를 받아줄 `local` 자리 표시 계정이 함께 생성된다.

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
