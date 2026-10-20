/*
  Warnings:

  - You are about to drop the `RoleplaySession` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RoleplaySession" DROP CONSTRAINT "RoleplaySession_userId_fkey";

-- DropTable
DROP TABLE "RoleplaySession";

-- CreateTable
CREATE TABLE "CharacterSession" (
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "reviews" JSONB NOT NULL DEFAULT '{}',
    "translations" JSONB NOT NULL DEFAULT '{}',
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterSession_pkey" PRIMARY KEY ("userId","characterId","language")
);

-- AddForeignKey
ALTER TABLE "CharacterSession" ADD CONSTRAINT "CharacterSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
