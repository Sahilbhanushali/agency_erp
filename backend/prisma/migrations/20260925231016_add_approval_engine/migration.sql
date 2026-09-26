-- Centralized approval engine: requests plus an append-only decision log.
-- Additive only: two new tables and their foreign keys. Nothing existing is altered.
-- CreateTable
CREATE TABLE `itsme_approval_requests` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `entity` ENUM('COMPANY', 'USER', 'ROLE', 'CLIENT', 'PROJECT', 'WORKSPACE', 'TASK', 'POST', 'PACKAGE', 'CLIENT_PACKAGE', 'CAMPAIGN', 'LIST', 'INVOICE', 'QUOTATION', 'PAYMENT', 'ATTENDANCE', 'LEAVE', 'DOCUMENT', 'SOCIAL_ACCOUNT', 'EXPENSE', 'CHAT_CONVERSATION', 'CLIENT_PORTAL_PERMISSION') NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `assignedToId` VARCHAR(191) NULL,
    `clientPortalUserId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `dueAt` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `itsme_approval_requests_companyId_idx`(`companyId`),
    INDEX `itsme_approval_requests_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `itsme_approval_requests_assignedToId_status_idx`(`assignedToId`, `status`),
    INDEX `itsme_approval_requests_clientPortalUserId_status_idx`(`clientPortalUserId`, `status`),
    INDEX `itsme_approval_requests_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_approval_decisions` (
    `id` VARCHAR(191) NOT NULL,
    `approvalRequestId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `clientPortalUserId` VARCHAR(191) NULL,
    `decision` ENUM('APPROVE', 'REJECT', 'REQUEST_CHANGES', 'COMMENT') NOT NULL,
    `comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itsme_approval_decisions_approvalRequestId_createdAt_idx`(`approvalRequestId`, `createdAt`),
    INDEX `itsme_approval_decisions_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `itsme_approval_requests` ADD CONSTRAINT `itsme_approval_requests_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_approval_requests` ADD CONSTRAINT `itsme_approval_requests_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_approval_requests` ADD CONSTRAINT `itsme_approval_requests_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `itsme_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_approval_requests` ADD CONSTRAINT `itsme_approval_requests_clientPortalUserId_fkey` FOREIGN KEY (`clientPortalUserId`) REFERENCES `itsme_client_portal_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_approval_decisions` ADD CONSTRAINT `itsme_approval_decisions_approvalRequestId_fkey` FOREIGN KEY (`approvalRequestId`) REFERENCES `itsme_approval_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_approval_decisions` ADD CONSTRAINT `itsme_approval_decisions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `itsme_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_approval_decisions` ADD CONSTRAINT `itsme_approval_decisions_clientPortalUserId_fkey` FOREIGN KEY (`clientPortalUserId`) REFERENCES `itsme_client_portal_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

