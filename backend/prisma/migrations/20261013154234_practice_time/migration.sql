-- CreateTable
CREATE TABLE "PracticeDay" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PracticeDay_pkey" PRIMARY KEY ("userId","day")
);

-- AddForeignKey
ALTER TABLE "PracticeDay" ADD CONSTRAINT "PracticeDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
