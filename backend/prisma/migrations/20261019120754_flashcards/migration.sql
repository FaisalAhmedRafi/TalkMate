-- CreateTable
CREATE TABLE "FlashcardDeck" (
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "cards" JSONB NOT NULL,
    "status" JSONB NOT NULL DEFAULT '[]',
    "flagged" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardDeck_pkey" PRIMARY KEY ("userId","topicId","language")
);

-- AddForeignKey
ALTER TABLE "FlashcardDeck" ADD CONSTRAINT "FlashcardDeck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
