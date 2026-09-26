-- Password reset tokens, kept separate from invite tokens so a reset cannot
-- invalidate a pending invite. Additive: two nullable columns and one index.
-- AlterTable
ALTER TABLE `itsme_users` ADD COLUMN `passwordResetTokenExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `passwordResetTokenHash` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `itsme_users_passwordResetTokenHash_key` ON `itsme_users`(`passwordResetTokenHash`);

