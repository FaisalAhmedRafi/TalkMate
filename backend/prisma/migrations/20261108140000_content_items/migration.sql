-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "position" INTEGER,
    "data" JSONB NOT NULL,
    "seeded" BOOLEAN NOT NULL DEFAULT false,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_mode_itemId_key" ON "ContentItem"("mode", "itemId");

-- CreateIndex
CREATE INDEX "ContentItem_mode_position_idx" ON "ContentItem"("mode", "position");

-- Keep what the admin panel already saved: elements added from the panel ...
INSERT INTO "ContentItem" ("id", "mode", "itemId", "data", "seeded", "edited", "deleted", "createdBy", "createdAt", "updatedAt")
SELECT "id", "mode", "itemId", "data", false, false, false, "createdBy", "createdAt", "createdAt" FROM "CustomContent";

-- ... and edited built-in elements (that table only exists if the previous migration was applied).
-- Built-in elements that were deleted there are not copied: the first start inserts them again and they can be deleted again.
DO $$
BEGIN
  IF to_regclass('public."BuiltinOverride"') IS NOT NULL THEN
    INSERT INTO "ContentItem" ("id", "mode", "itemId", "data", "seeded", "edited", "deleted", "createdBy", "createdAt", "updatedAt")
    SELECT "id", "mode", "itemId", "data", true, true, false, "updatedBy", "updatedAt", "updatedAt"
    FROM "BuiltinOverride" WHERE "deleted" = false AND "data" IS NOT NULL
    ON CONFLICT ("mode", "itemId") DO NOTHING;
    DROP TABLE "BuiltinOverride";
  END IF;
END $$;

-- DropTable
DROP TABLE "CustomContent";
