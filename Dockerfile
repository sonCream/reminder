# 개발용 이미지. 운영 이미지는 배포 주차에 멀티스테이지로 따로 만든다.
FROM node:22-alpine

# Prisma 엔진이 alpine에서 openssl을 요구한다.
RUN apk add --no-cache openssl

WORKDIR /app

# 의존성 레이어를 분리해서 소스만 바뀔 때 재설치가 일어나지 않게 한다.
#
# ⚠️ prisma 디렉터리를 npm ci 보다 먼저 복사해야 한다.
#    package.json 의 postinstall 이 `prisma generate` 를 부르는데,
#    스키마가 없으면 그 자리에서 설치가 통째로 실패한다.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
