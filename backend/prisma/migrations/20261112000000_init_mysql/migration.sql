-- Baseline for MySQL 8 (replaces the PostgreSQL migration history).

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `avatar` LONGTEXT NULL,
    `timeZone` VARCHAR(191) NOT NULL DEFAULT 'UTC+00:00',
    `passwordHash` VARCHAR(191) NULL,
    `googleId` VARCHAR(191) NULL,
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `emailSpecialOffers` BOOLEAN NOT NULL DEFAULT true,
    `emailLearning` BOOLEAN NOT NULL DEFAULT true,
    `appSpecialOffers` BOOLEAN NOT NULL DEFAULT true,
    `appLearning` BOOLEAN NOT NULL DEFAULT true,
    `optOutAiTraining` BOOLEAN NOT NULL DEFAULT false,
    `optOutProfiling` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `referralCode` VARCHAR(191) NULL,
    `referredById` VARCHAR(191) NULL,
    `referralRewarded` BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_googleId_key`(`googleId`),
    UNIQUE INDEX `User_referralCode_key`(`referralCode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailVerification` (
    `userId` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_userId_idx`(`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Progress` (
    `userId` VARCHAR(191) NOT NULL,
    `xp` INTEGER NOT NULL DEFAULT 0,
    `streak` INTEGER NOT NULL DEFAULT 0,
    `longest` INTEGER NOT NULL DEFAULT 0,
    `messages` INTEGER NOT NULL DEFAULT 0,
    `lastDay` VARCHAR(191) NULL,
    `premium` BOOLEAN NOT NULL DEFAULT false,
    `language` VARCHAR(191) NOT NULL DEFAULT 'Spanish',
    `level` VARCHAR(191) NOT NULL DEFAULT 'Beginner',
    `nativeLanguage` VARCHAR(191) NOT NULL DEFAULT 'English',
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PracticeEntry` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `day` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `PracticeEntry_userId_day_idx`(`userId`, `day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PracticeDay` (
    `userId` VARCHAR(191) NOT NULL,
    `day` VARCHAR(191) NOT NULL,
    `seconds` INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (`userId`, `day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SentenceProgress` (
    `userId` VARCHAR(191) NOT NULL,
    `skillId` VARCHAR(191) NOT NULL,
    `bestScore` DOUBLE NOT NULL DEFAULT 0,
    `lastScore` DOUBLE NOT NULL DEFAULT 0,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `passed` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`userId`, `skillId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DialogueProgress` (
    `userId` VARCHAR(191) NOT NULL,
    `topicId` VARCHAR(191) NOT NULL,
    `bestScore` DOUBLE NOT NULL DEFAULT 0,
    `lastScore` DOUBLE NOT NULL DEFAULT 0,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `passed` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`userId`, `topicId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DebateSession` (
    `userId` VARCHAR(191) NOT NULL,
    `topicId` VARCHAR(191) NOT NULL,
    `side` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `messages` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `reviews` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `translations` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `count` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`userId`, `topicId`, `side`, `language`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CharacterSession` (
    `userId` VARCHAR(191) NOT NULL,
    `characterId` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `messages` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `reviews` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `translations` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `count` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`userId`, `characterId`, `language`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Personalization` (
    `userId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `frequency` VARCHAR(191) NULL,
    `goal` VARCHAR(191) NULL,
    `style` VARCHAR(191) NULL,
    `ageRange` VARCHAR(191) NULL,
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `userId` VARCHAR(191) NOT NULL,
    `months` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `currentPeriodEnd` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WordProgress` (
    `userId` VARCHAR(191) NOT NULL,
    `wordId` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `lesson` JSON NULL,
    `step` INTEGER NOT NULL DEFAULT 0,
    `scores` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `finished` BOOLEAN NOT NULL DEFAULT false,
    `passed` BOOLEAN NOT NULL DEFAULT false,
    `bestScore` DOUBLE NOT NULL DEFAULT 0,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`userId`, `wordId`, `language`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FlashcardDeck` (
    `userId` VARCHAR(191) NOT NULL,
    `topicId` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `cards` JSON NOT NULL,
    `status` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `flagged` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`userId`, `topicId`, `language`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoleplaySession` (
    `userId` VARCHAR(191) NOT NULL,
    `scenarioId` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `messages` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `reviews` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `translations` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `count` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`userId`, `scenarioId`, `language`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `tutor` VARCHAR(191) NOT NULL DEFAULT 'Emma',
    `messages` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `reviews` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `translations` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `count` INTEGER NOT NULL DEFAULT 0,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `ChatSession_userId_language_archived_idx`(`userId`, `language`, `archived`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CallSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `tutor` VARCHAR(191) NOT NULL DEFAULT 'Kai',
    `messages` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `reviews` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `translations` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `count` INTEGER NOT NULL DEFAULT 0,
    `seconds` INTEGER NOT NULL DEFAULT 0,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `CallSession_userId_language_archived_idx`(`userId`, `language`, `archived`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PhotoProgress` (
    `userId` VARCHAR(191) NOT NULL,
    `photoId` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `bestScore` INTEGER NOT NULL DEFAULT 0,
    `lastScore` INTEGER NOT NULL DEFAULT 0,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `passed` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`userId`, `photoId`, `language`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportMessage` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `SupportMessage_createdAt_idx`(`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentItem` (
    `id` VARCHAR(191) NOT NULL,
    `mode` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `position` INTEGER NULL,
    `data` JSON NOT NULL,
    `original` JSON NULL,
    `seeded` BOOLEAN NOT NULL DEFAULT false,
    `edited` BOOLEAN NOT NULL DEFAULT false,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `ContentItem_mode_itemId_key`(`mode`, `itemId`),
    INDEX `ContentItem_mode_position_idx`(`mode`, `position`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_referredById_fkey` FOREIGN KEY (`referredById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailVerification` ADD CONSTRAINT `EmailVerification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Progress` ADD CONSTRAINT `Progress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PracticeEntry` ADD CONSTRAINT `PracticeEntry_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PracticeDay` ADD CONSTRAINT `PracticeDay_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SentenceProgress` ADD CONSTRAINT `SentenceProgress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DialogueProgress` ADD CONSTRAINT `DialogueProgress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebateSession` ADD CONSTRAINT `DebateSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CharacterSession` ADD CONSTRAINT `CharacterSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Personalization` ADD CONSTRAINT `Personalization_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WordProgress` ADD CONSTRAINT `WordProgress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FlashcardDeck` ADD CONSTRAINT `FlashcardDeck_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoleplaySession` ADD CONSTRAINT `RoleplaySession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatSession` ADD CONSTRAINT `ChatSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CallSession` ADD CONSTRAINT `CallSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PhotoProgress` ADD CONSTRAINT `PhotoProgress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportMessage` ADD CONSTRAINT `SupportMessage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
