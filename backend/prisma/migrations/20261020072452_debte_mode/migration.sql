-- CreateTable
CREATE TABLE "DebateSession" (
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "reviews" JSONB NOT NULL DEFAULT '{}',
    "translations" JSONB NOT NULL DEFAULT '{}',
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebateSession_pkey" PRIMARY KEY ("userId","topicId","side","language")
);

-- AddForeignKey
ALTER TABLE "DebateSession" ADD CONSTRAINT "DebateSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
