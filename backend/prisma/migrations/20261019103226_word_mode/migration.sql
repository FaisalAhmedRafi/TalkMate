-- CreateTable
CREATE TABLE "WordProgress" (
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "lesson" JSONB,
    "step" INTEGER NOT NULL DEFAULT 0,
    "scores" JSONB NOT NULL DEFAULT '[]',
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "bestScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WordProgress_pkey" PRIMARY KEY ("userId","wordId","language")
);

-- AddForeignKey
ALTER TABLE "WordProgress" ADD CONSTRAINT "WordProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
