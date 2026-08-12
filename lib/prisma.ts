import { PrismaClient } from '@prisma/client'

// Next.js 개발 모드는 파일이 바뀔 때마다 모듈을 다시 읽는다.
// 그때마다 새 PrismaClient를 만들면 커넥션이 계속 쌓여 DB가 먼저 죽는다.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
