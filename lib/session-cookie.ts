/// 미들웨어(Edge 런타임)와 서버 양쪽에서 쓰는 값이라 별도 파일로 둔다.
/// lib/auth.ts 는 Prisma 를 끌고 오기 때문에 미들웨어에서 import 할 수 없다.
export const SESSION_COOKIE = 'reminder_session'
