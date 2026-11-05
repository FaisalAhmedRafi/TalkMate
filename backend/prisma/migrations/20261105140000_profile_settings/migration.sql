-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'UTC+00:00',
ADD COLUMN     "emailSpecialOffers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailLearning" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "appSpecialOffers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "appLearning" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "optOutAiTraining" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "optOutProfiling" BOOLEAN NOT NULL DEFAULT false;
