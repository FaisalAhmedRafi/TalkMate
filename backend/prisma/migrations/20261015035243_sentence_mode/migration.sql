-- CreateTable
CREATE TABLE "SentenceProgress" (
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "bestScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SentenceProgress_pkey" PRIMARY KEY ("userId","skillId")
);

-- AddForeignKey
ALTER TABLE "SentenceProgress" ADD CONSTRAINT "SentenceProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
