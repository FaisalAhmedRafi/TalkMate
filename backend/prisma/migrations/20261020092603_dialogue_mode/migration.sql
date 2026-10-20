/*
  Warnings:

  - You are about to drop the `DebateSession` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DebateSession" DROP CONSTRAINT "DebateSession_userId_fkey";

-- DropTable
DROP TABLE "DebateSession";
