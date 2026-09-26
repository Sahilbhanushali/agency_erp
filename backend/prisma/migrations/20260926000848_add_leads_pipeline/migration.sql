-- Leads and the sales pipeline, plus an append-only lead activity log.
-- Additive: two new tables; the ALTERs only append LEAD and APPROVAL to an
-- existing enum, leaving all prior values and rows untouched.
-- AlterTable
ALTER TABLE `itsme_activity_logs` MODIFY `entity` ENUM('COMPANY', 'USER', 'ROLE', 'CLIENT', 'PROJECT', 'WORKSPACE', 'TASK', 'POST', 'PACKAGE', 'CLIENT_PACKAGE', 'CAMPAIGN', 'LIST', 'INVOICE', 'QUOTATION', 'PAYMENT', 'ATTENDANCE', 'LEAVE', 'DOCUMENT', 'SOCIAL_ACCOUNT', 'EXPENSE', 'CHAT_CONVERSATION', 'CLIENT_PORTAL_PERMISSION', 'LEAD', 'APPROVAL') NOT NULL;

-- AlterTable
ALTER TABLE `itsme_approval_requests` MODIFY `entity` ENUM('COMPANY', 'USER', 'ROLE', 'CLIENT', 'PROJECT', 'WORKSPACE', 'TASK', 'POST', 'PACKAGE', 'CLIENT_PACKAGE', 'CAMPAIGN', 'LIST', 'INVOICE', 'QUOTATION', 'PAYMENT', 'ATTENDANCE', 'LEAVE', 'DOCUMENT', 'SOCIAL_ACCOUNT', 'EXPENSE', 'CHAT_CONVERSATION', 'CLIENT_PORTAL_PERMISSION', 'LEAD', 'APPROVAL') NOT NULL;

-- AlterTable
ALTER TABLE `itsme_notifications` MODIFY `entity` ENUM('COMPANY', 'USER', 'ROLE', 'CLIENT', 'PROJECT', 'WORKSPACE', 'TASK', 'POST', 'PACKAGE', 'CLIENT_PACKAGE', 'CAMPAIGN', 'LIST', 'INVOICE', 'QUOTATION', 'PAYMENT', 'ATTENDANCE', 'LEAVE', 'DOCUMENT', 'SOCIAL_ACCOUNT', 'EXPENSE', 'CHAT_CONVERSATION', 'CLIENT_PORTAL_PERMISSION', 'LEAD', 'APPROVAL') NULL;

-- CreateTable
CREATE TABLE `itsme_leads` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `source` ENUM('WEBSITE', 'REFERRAL', 'SOCIAL', 'COLD_OUTREACH', 'EVENT', 'INBOUND_CALL', 'PARTNER', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `industry` VARCHAR(191) NULL,
    `estimatedValue` DECIMAL(14, 2) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `status` ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST') NOT NULL DEFAULT 'NEW',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `notes` TEXT NULL,
    `nextFollowUpAt` DATETIME(3) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `convertedClientId` VARCHAR(191) NULL,
    `lostReason` TEXT NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `itsme_leads_convertedClientId_key`(`convertedClientId`),
    INDEX `itsme_leads_companyId_idx`(`companyId`),
    INDEX `itsme_leads_ownerId_idx`(`ownerId`),
    INDEX `itsme_leads_status_idx`(`status`),
    INDEX `itsme_leads_nextFollowUpAt_idx`(`nextFollowUpAt`),
    INDEX `itsme_leads_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_lead_activities` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `type` ENUM('NOTE', 'CALL', 'EMAIL', 'MEETING', 'STATUS_CHANGED', 'ASSIGNED', 'FOLLOW_UP_SET', 'CONVERTED') NOT NULL,
    `note` TEXT NULL,
    `fromValue` VARCHAR(191) NULL,
    `toValue` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itsme_lead_activities_leadId_createdAt_idx`(`leadId`, `createdAt`),
    INDEX `itsme_lead_activities_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `itsme_leads` ADD CONSTRAINT `itsme_leads_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_leads` ADD CONSTRAINT `itsme_leads_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `itsme_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_leads` ADD CONSTRAINT `itsme_leads_convertedClientId_fkey` FOREIGN KEY (`convertedClientId`) REFERENCES `itsme_clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_lead_activities` ADD CONSTRAINT `itsme_lead_activities_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `itsme_leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_lead_activities` ADD CONSTRAINT `itsme_lead_activities_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `itsme_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

