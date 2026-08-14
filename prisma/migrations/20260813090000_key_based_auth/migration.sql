-- 매직 링크(이메일)를 걷어내고 기기가 보관하는 무작위 키로 계정을 식별한다.
-- 이메일을 수집하지 않으므로 User.email 과 LoginToken 을 함께 없앤다.

-- DropTable
DROP TABLE IF EXISTS "LoginToken";

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "email";
ALTER TABLE "User" ADD COLUMN "keyHash" TEXT;

-- CreateIndex
-- keyHash 는 null 을 허용한다. 인증을 붙이기 전에 쌓인 데이터를 가진 'local' 계정은
-- 아직 키가 없는 상태로 남고, scripts/issue-key.ts 로 키를 발급해 인계한다.
-- Postgres 의 unique 인덱스는 null 을 중복으로 보지 않으므로 문제되지 않는다.
CREATE UNIQUE INDEX "User_keyHash_key" ON "User"("keyHash");
