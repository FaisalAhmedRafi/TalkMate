-- CreateTable
CREATE TABLE "BuiltinOverride" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuiltinOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuiltinOverride_mode_itemId_key" ON "BuiltinOverride"("mode", "itemId");

-- CreateIndex
CREATE INDEX "BuiltinOverride_mode_idx" ON "BuiltinOverride"("mode");
