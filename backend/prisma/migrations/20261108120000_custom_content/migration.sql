-- CreateTable
CREATE TABLE "CustomContent" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomContent_mode_itemId_key" ON "CustomContent"("mode", "itemId");

-- CreateIndex
CREATE INDEX "CustomContent_mode_createdAt_idx" ON "CustomContent"("mode", "createdAt");
