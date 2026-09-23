-- AlterTable
ALTER TABLE `itsme_users` ADD COLUMN `inviteTokenExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `inviteTokenHash` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `itsme_users_inviteTokenHash_key` ON `itsme_users`(`inviteTokenHash`);
