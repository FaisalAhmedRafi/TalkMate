-- CreateTable
CREATE TABLE "RoleplaySession" (
    "userId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "reviews" JSONB NOT NULL DEFAULT '{}',
    "translations" JSONB NOT NULL DEFAULT '{}',
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleplaySession_pkey" PRIMARY KEY ("userId","scenarioId","language")
);

-- AddForeignKey
ALTER TABLE "RoleplaySession" ADD CONSTRAINT "RoleplaySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
