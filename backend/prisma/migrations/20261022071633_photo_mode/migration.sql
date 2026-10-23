-- CreateTable
CREATE TABLE "PhotoProgress" (
    "userId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "lastScore" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoProgress_pkey" PRIMARY KEY ("userId","photoId","language")
);

-- AddForeignKey
ALTER TABLE "PhotoProgress" ADD CONSTRAINT "PhotoProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
