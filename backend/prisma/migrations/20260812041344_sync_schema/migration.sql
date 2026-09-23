/*
  Warnings:

  - You are about to drop the `activity_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `attendance_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `campaign_metrics` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `client_calendar_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `client_contacts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `client_portal_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `client_portal_users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `clients` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `expenses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `holidays` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `invoice_lines` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `invoices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `leave_requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notification_preferences` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `office_geofences` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payroll_slips` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_milestones` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `projects` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `quotation_lines` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `quotations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `refresh_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `roles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `scheduled_posts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `social_connections` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `social_insights` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `task_attachments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `task_comments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `task_time_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tasks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `activity_logs` DROP FOREIGN KEY `activity_logs_userId_fkey`;

-- DropForeignKey
ALTER TABLE `attendance_records` DROP FOREIGN KEY `attendance_records_userId_fkey`;

-- DropForeignKey
ALTER TABLE `campaign_metrics` DROP FOREIGN KEY `campaign_metrics_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `client_calendar_events` DROP FOREIGN KEY `client_calendar_events_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `client_calendar_events` DROP FOREIGN KEY `client_calendar_events_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `client_contacts` DROP FOREIGN KEY `client_contacts_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `client_portal_configs` DROP FOREIGN KEY `client_portal_configs_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `client_portal_configs` DROP FOREIGN KEY `client_portal_configs_updatedBy_fkey`;

-- DropForeignKey
ALTER TABLE `client_portal_users` DROP FOREIGN KEY `client_portal_users_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `documents` DROP FOREIGN KEY `documents_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `documents` DROP FOREIGN KEY `documents_parentId_fkey`;

-- DropForeignKey
ALTER TABLE `documents` DROP FOREIGN KEY `documents_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `documents` DROP FOREIGN KEY `documents_uploadedBy_fkey`;

-- DropForeignKey
ALTER TABLE `expenses` DROP FOREIGN KEY `expenses_approvedBy_fkey`;

-- DropForeignKey
ALTER TABLE `expenses` DROP FOREIGN KEY `expenses_submittedBy_fkey`;

-- DropForeignKey
ALTER TABLE `invoice_lines` DROP FOREIGN KEY `invoice_lines_invoiceId_fkey`;

-- DropForeignKey
ALTER TABLE `invoices` DROP FOREIGN KEY `invoices_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `invoices` DROP FOREIGN KEY `invoices_createdBy_fkey`;

-- DropForeignKey
ALTER TABLE `invoices` DROP FOREIGN KEY `invoices_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `invoices` DROP FOREIGN KEY `invoices_quotationId_fkey`;

-- DropForeignKey
ALTER TABLE `leave_requests` DROP FOREIGN KEY `leave_requests_approverId_fkey`;

-- DropForeignKey
ALTER TABLE `leave_requests` DROP FOREIGN KEY `leave_requests_userId_fkey`;

-- DropForeignKey
ALTER TABLE `notification_preferences` DROP FOREIGN KEY `notification_preferences_userId_fkey`;

-- DropForeignKey
ALTER TABLE `notifications` DROP FOREIGN KEY `notifications_clientPortalUserId_fkey`;

-- DropForeignKey
ALTER TABLE `notifications` DROP FOREIGN KEY `notifications_userId_fkey`;

-- DropForeignKey
ALTER TABLE `payments` DROP FOREIGN KEY `payments_invoiceId_fkey`;

-- DropForeignKey
ALTER TABLE `payroll_slips` DROP FOREIGN KEY `payroll_slips_userId_fkey`;

-- DropForeignKey
ALTER TABLE `project_milestones` DROP FOREIGN KEY `project_milestones_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `projects` DROP FOREIGN KEY `projects_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `projects` DROP FOREIGN KEY `projects_managerId_fkey`;

-- DropForeignKey
ALTER TABLE `quotation_lines` DROP FOREIGN KEY `quotation_lines_quotationId_fkey`;

-- DropForeignKey
ALTER TABLE `quotations` DROP FOREIGN KEY `quotations_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `quotations` DROP FOREIGN KEY `quotations_createdBy_fkey`;

-- DropForeignKey
ALTER TABLE `quotations` DROP FOREIGN KEY `quotations_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `refresh_tokens` DROP FOREIGN KEY `refresh_tokens_userId_fkey`;

-- DropForeignKey
ALTER TABLE `scheduled_posts` DROP FOREIGN KEY `scheduled_posts_socialConnectionId_fkey`;

-- DropForeignKey
ALTER TABLE `social_connections` DROP FOREIGN KEY `social_connections_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `social_insights` DROP FOREIGN KEY `social_insights_socialConnectionId_fkey`;

-- DropForeignKey
ALTER TABLE `task_attachments` DROP FOREIGN KEY `task_attachments_commentId_fkey`;

-- DropForeignKey
ALTER TABLE `task_attachments` DROP FOREIGN KEY `task_attachments_taskId_fkey`;

-- DropForeignKey
ALTER TABLE `task_comments` DROP FOREIGN KEY `task_comments_parentId_fkey`;

-- DropForeignKey
ALTER TABLE `task_comments` DROP FOREIGN KEY `task_comments_taskId_fkey`;

-- DropForeignKey
ALTER TABLE `task_comments` DROP FOREIGN KEY `task_comments_userId_fkey`;

-- DropForeignKey
ALTER TABLE `task_time_logs` DROP FOREIGN KEY `task_time_logs_taskId_fkey`;

-- DropForeignKey
ALTER TABLE `task_time_logs` DROP FOREIGN KEY `task_time_logs_userId_fkey`;

-- DropForeignKey
ALTER TABLE `tasks` DROP FOREIGN KEY `tasks_assigneeId_fkey`;

-- DropForeignKey
ALTER TABLE `tasks` DROP FOREIGN KEY `tasks_createdBy_fkey`;

-- DropForeignKey
ALTER TABLE `tasks` DROP FOREIGN KEY `tasks_milestoneId_fkey`;

-- DropForeignKey
ALTER TABLE `tasks` DROP FOREIGN KEY `tasks_parentTaskId_fkey`;

-- DropForeignKey
ALTER TABLE `tasks` DROP FOREIGN KEY `tasks_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `users_roleId_fkey`;

-- DropTable
DROP TABLE `activity_logs`;

-- DropTable
DROP TABLE `attendance_records`;

-- DropTable
DROP TABLE `campaign_metrics`;

-- DropTable
DROP TABLE `client_calendar_events`;

-- DropTable
DROP TABLE `client_contacts`;

-- DropTable
DROP TABLE `client_portal_configs`;

-- DropTable
DROP TABLE `client_portal_users`;

-- DropTable
DROP TABLE `clients`;

-- DropTable
DROP TABLE `documents`;

-- DropTable
DROP TABLE `expenses`;

-- DropTable
DROP TABLE `holidays`;

-- DropTable
DROP TABLE `invoice_lines`;

-- DropTable
DROP TABLE `invoices`;

-- DropTable
DROP TABLE `leave_requests`;

-- DropTable
DROP TABLE `notification_preferences`;

-- DropTable
DROP TABLE `notifications`;

-- DropTable
DROP TABLE `office_geofences`;

-- DropTable
DROP TABLE `payments`;

-- DropTable
DROP TABLE `payroll_slips`;

-- DropTable
DROP TABLE `project_milestones`;

-- DropTable
DROP TABLE `projects`;

-- DropTable
DROP TABLE `quotation_lines`;

-- DropTable
DROP TABLE `quotations`;

-- DropTable
DROP TABLE `refresh_tokens`;

-- DropTable
DROP TABLE `roles`;

-- DropTable
DROP TABLE `scheduled_posts`;

-- DropTable
DROP TABLE `social_connections`;

-- DropTable
DROP TABLE `social_insights`;

-- DropTable
DROP TABLE `task_attachments`;

-- DropTable
DROP TABLE `task_comments`;

-- DropTable
DROP TABLE `task_time_logs`;

-- DropTable
DROP TABLE `tasks`;

-- DropTable
DROP TABLE `users`;

-- CreateTable
CREATE TABLE `itsme_companies` (
    `id` VARCHAR(191) NOT NULL,
    `registeredAddressId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `legalName` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `gstNumber` VARCHAR(191) NULL,
    `panNumber` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Kolkata',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_companies_registeredAddressId_idx`(`registeredAddressId`),
    INDEX `itsme_companies_isActive_idx`(`isActive`),
    INDEX `itsme_companies_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_addresses` (
    `id` VARCHAR(191) NOT NULL,
    `line1` VARCHAR(191) NOT NULL,
    `line2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'India',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `itsme_addresses_city_idx`(`city`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `itsme_permissions_code_key`(`code`),
    INDEX `itsme_permissions_module_idx`(`module`),
    UNIQUE INDEX `itsme_permissions_module_action_key`(`module`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_roles` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_roles_companyId_idx`(`companyId`),
    INDEX `itsme_roles_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `itsme_roles_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_role_permissions` (
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itsme_role_permissions_permissionId_idx`(`permissionId`),
    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_users` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'INVITED') NOT NULL DEFAULT 'INVITED',
    `gender` ENUM('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY') NULL,
    `dateOfBirth` DATE NULL,
    `employmentType` ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'FREELANCER') NULL,
    `department` VARCHAR(191) NULL,
    `designation` VARCHAR(191) NULL,
    `joiningDate` DATE NULL,
    `isRemote` BOOLEAN NOT NULL DEFAULT false,
    `lastLoginAt` DATETIME(3) NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `itsme_users_email_key`(`email`),
    UNIQUE INDEX `itsme_users_phone_key`(`phone`),
    INDEX `itsme_users_companyId_idx`(`companyId`),
    INDEX `itsme_users_roleId_idx`(`roleId`),
    INDEX `itsme_users_status_idx`(`status`),
    INDEX `itsme_users_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_employee_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `reportingManagerId` VARCHAR(191) NULL,
    `currentAddressId` VARCHAR(191) NULL,
    `permanentAddressId` VARCHAR(191) NULL,
    `employeeCode` VARCHAR(191) NULL,
    `bloodGroup` VARCHAR(191) NULL,
    `maritalStatus` ENUM('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER') NULL,
    `nationality` VARCHAR(191) NULL,
    `personalEmail` VARCHAR(191) NULL,
    `alternatePhone` VARCHAR(191) NULL,
    `emergencyContactName` VARCHAR(191) NULL,
    `emergencyContactPhone` VARCHAR(191) NULL,
    `emergencyContactRelation` VARCHAR(191) NULL,
    `panNumber` VARCHAR(191) NULL,
    `aadhaarNumber` VARCHAR(191) NULL,
    `passportNumber` VARCHAR(191) NULL,
    `probationEndDate` DATE NULL,
    `confirmationDate` DATE NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `itsme_employee_profiles_userId_key`(`userId`),
    UNIQUE INDEX `itsme_employee_profiles_employeeCode_key`(`employeeCode`),
    INDEX `itsme_employee_profiles_reportingManagerId_idx`(`reportingManagerId`),
    INDEX `itsme_employee_profiles_currentAddressId_idx`(`currentAddressId`),
    INDEX `itsme_employee_profiles_permanentAddressId_idx`(`permanentAddressId`),
    INDEX `itsme_employee_profiles_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_employee_bank_details` (
    `id` VARCHAR(191) NOT NULL,
    `employeeProfileId` VARCHAR(191) NOT NULL,
    `accountHolderName` VARCHAR(191) NOT NULL,
    `accountNumber` VARCHAR(191) NOT NULL,
    `bankName` VARCHAR(191) NOT NULL,
    `ifscCode` VARCHAR(191) NOT NULL,
    `branchName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `itsme_employee_bank_details_employeeProfileId_key`(`employeeProfileId`),
    INDEX `itsme_employee_bank_details_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_employee_skills` (
    `id` VARCHAR(191) NOT NULL,
    `employeeProfileId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `proficiency` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itsme_employee_skills_employeeProfileId_idx`(`employeeProfileId`),
    UNIQUE INDEX `itsme_employee_skills_employeeProfileId_name_key`(`employeeProfileId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(512) NOT NULL,
    `userAgent` TEXT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `itsme_refresh_tokens_token_key`(`token`),
    INDEX `itsme_refresh_tokens_userId_idx`(`userId`),
    INDEX `itsme_refresh_tokens_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_files` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `itsme_files_storageKey_key`(`storageKey`),
    INDEX `itsme_files_companyId_idx`(`companyId`),
    INDEX `itsme_files_uploadedById_idx`(`uploadedById`),
    INDEX `itsme_files_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_clients` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `accountManagerId` VARCHAR(191) NULL,
    `billingAddressId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `industry` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `gstNumber` VARCHAR(191) NULL,
    `panNumber` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_clients_companyId_idx`(`companyId`),
    INDEX `itsme_clients_accountManagerId_idx`(`accountManagerId`),
    INDEX `itsme_clients_billingAddressId_idx`(`billingAddressId`),
    INDEX `itsme_clients_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `itsme_clients_companyId_email_key`(`companyId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_client_contacts` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `designation` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_client_contacts_clientId_idx`(`clientId`),
    INDEX `itsme_client_contacts_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_client_portal_users` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `itsme_client_portal_users_email_key`(`email`),
    INDEX `itsme_client_portal_users_clientId_idx`(`clientId`),
    INDEX `itsme_client_portal_users_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_client_portal_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NOT NULL,
    `feature` ENUM('CAMPAIGN_LEADS', 'LEAD_RESPONSES', 'POST_INSIGHTS', 'POSTS_DELIVERED', 'ACTIVE_WORK', 'SCHEDULED_POSTS', 'SOCIAL_ANALYTICS', 'CONTENT_CALENDAR', 'INVOICES', 'QUOTATIONS', 'PAYMENT_STATUS', 'PROJECT_BUDGET', 'PACKAGE_USAGE', 'PROJECT_TIMELINE', 'MILESTONES', 'DELIVERABLES') NOT NULL,
    `isVisible` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `itsme_client_portal_permissions_clientId_idx`(`clientId`),
    INDEX `itsme_client_portal_permissions_updatedById_idx`(`updatedById`),
    UNIQUE INDEX `itsme_client_portal_permissions_clientId_feature_key`(`clientId`, `feature`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_client_calendar_events` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `postId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `isAllDay` BOOLEAN NOT NULL DEFAULT false,
    `colorHex` VARCHAR(7) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_client_calendar_events_clientId_idx`(`clientId`),
    INDEX `itsme_client_calendar_events_projectId_idx`(`projectId`),
    INDEX `itsme_client_calendar_events_postId_idx`(`postId`),
    INDEX `itsme_client_calendar_events_startAt_idx`(`startAt`),
    INDEX `itsme_client_calendar_events_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_projects` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `managerId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'ON_HOLD', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `startDate` DATE NULL,
    `deadline` DATE NULL,
    `budget` DECIMAL(14, 2) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `clientApprovalEnabled` BOOLEAN NOT NULL DEFAULT false,
    `colorHex` VARCHAR(7) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_projects_companyId_idx`(`companyId`),
    INDEX `itsme_projects_clientId_idx`(`clientId`),
    INDEX `itsme_projects_managerId_idx`(`managerId`),
    INDEX `itsme_projects_status_idx`(`status`),
    INDEX `itsme_projects_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_workspaces` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `colorHex` VARCHAR(7) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_workspaces_companyId_idx`(`companyId`),
    INDEX `itsme_workspaces_projectId_idx`(`projectId`),
    INDEX `itsme_workspaces_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `itsme_workspaces_projectId_name_key`(`projectId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_workspace_members` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `addedById` VARCHAR(191) NOT NULL,
    `memberRole` ENUM('LEAD', 'MEMBER', 'VIEWER') NOT NULL DEFAULT 'MEMBER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_workspace_members_workspaceId_idx`(`workspaceId`),
    INDEX `itsme_workspace_members_userId_idx`(`userId`),
    INDEX `itsme_workspace_members_addedById_idx`(`addedById`),
    INDEX `itsme_workspace_members_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `itsme_workspace_members_workspaceId_userId_key`(`workspaceId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_project_milestones` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `dueDate` DATE NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'MISSED') NOT NULL DEFAULT 'PENDING',
    `showToClient` BOOLEAN NOT NULL DEFAULT true,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_project_milestones_projectId_idx`(`projectId`),
    INDEX `itsme_project_milestones_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_tags` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `colorHex` VARCHAR(7) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_tags_companyId_idx`(`companyId`),
    INDEX `itsme_tags_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `itsme_tags_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_project_tags` (
    `projectId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,

    INDEX `itsme_project_tags_tagId_idx`(`tagId`),
    PRIMARY KEY (`projectId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_post_tags` (
    `postId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,

    INDEX `itsme_post_tags_tagId_idx`(`tagId`),
    PRIMARY KEY (`postId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_tasks` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NULL,
    `milestoneId` VARCHAR(191) NULL,
    `postId` VARCHAR(191) NULL,
    `parentTaskId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `assigneeId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'NEEDS_REVISION', 'ADMIN_APPROVED', 'CLIENT_PENDING', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'TODO',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `dueDate` DATE NULL,
    `estimatedHours` DECIMAL(6, 2) NULL,
    `showToClient` BOOLEAN NOT NULL DEFAULT false,
    `clientLabel` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_tasks_companyId_idx`(`companyId`),
    INDEX `itsme_tasks_projectId_idx`(`projectId`),
    INDEX `itsme_tasks_workspaceId_idx`(`workspaceId`),
    INDEX `itsme_tasks_milestoneId_idx`(`milestoneId`),
    INDEX `itsme_tasks_postId_idx`(`postId`),
    INDEX `itsme_tasks_createdById_idx`(`createdById`),
    INDEX `itsme_tasks_assigneeId_idx`(`assigneeId`),
    INDEX `itsme_tasks_status_idx`(`status`),
    INDEX `itsme_tasks_parentTaskId_idx`(`parentTaskId`),
    INDEX `itsme_tasks_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_task_time_logs` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `endedAt` DATETIME(3) NULL,
    `durationMinutes` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_task_time_logs_taskId_idx`(`taskId`),
    INDEX `itsme_task_time_logs_userId_idx`(`userId`),
    INDEX `itsme_task_time_logs_startedAt_idx`(`startedAt`),
    INDEX `itsme_task_time_logs_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_task_comments` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `content` TEXT NOT NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT true,
    `editedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_task_comments_taskId_idx`(`taskId`),
    INDEX `itsme_task_comments_userId_idx`(`userId`),
    INDEX `itsme_task_comments_parentId_idx`(`parentId`),
    INDEX `itsme_task_comments_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_task_attachments` (
    `taskId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itsme_task_attachments_fileId_idx`(`fileId`),
    PRIMARY KEY (`taskId`, `fileId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_task_comment_attachments` (
    `commentId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itsme_task_comment_attachments_fileId_idx`(`fileId`),
    PRIMARY KEY (`commentId`, `fileId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_posts` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `workspaceId` VARCHAR(191) NULL,
    `campaignId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `assigneeId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `caption` TEXT NULL,
    `postType` ENUM('STATIC', 'CAROUSEL', 'REEL', 'STORY', 'VIDEO', 'GIF', 'POLL', 'TEXT', 'LINK') NOT NULL DEFAULT 'STATIC',
    `status` ENUM('IDEA', 'DRAFT', 'IN_DESIGN', 'IN_REVIEW', 'NEEDS_REVISION', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'CANCELLED') NOT NULL DEFAULT 'IDEA',
    `deliverableType` ENUM('STATIC_POST', 'CAROUSEL', 'REEL', 'STORY', 'VIDEO', 'BLOG', 'AD_CREATIVE', 'DESIGN', 'MOTION_GRAPHIC', 'OTHER') NULL,
    `scheduledDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_posts_companyId_idx`(`companyId`),
    INDEX `itsme_posts_clientId_idx`(`clientId`),
    INDEX `itsme_posts_projectId_idx`(`projectId`),
    INDEX `itsme_posts_workspaceId_idx`(`workspaceId`),
    INDEX `itsme_posts_campaignId_idx`(`campaignId`),
    INDEX `itsme_posts_createdById_idx`(`createdById`),
    INDEX `itsme_posts_assigneeId_idx`(`assigneeId`),
    INDEX `itsme_posts_status_idx`(`status`),
    INDEX `itsme_posts_scheduledDate_idx`(`scheduledDate`),
    INDEX `itsme_posts_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_post_media` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,
    `mediaType` ENUM('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT') NOT NULL DEFAULT 'IMAGE',
    `position` INTEGER NOT NULL DEFAULT 0,
    `altText` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itsme_post_media_postId_idx`(`postId`),
    INDEX `itsme_post_media_fileId_idx`(`fileId`),
    UNIQUE INDEX `itsme_post_media_postId_fileId_key`(`postId`, `fileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_post_references` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `title` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itsme_post_references_postId_idx`(`postId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_post_targets` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `socialAccountId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `scheduledAt` DATETIME(3) NULL,
    `publishedAt` DATETIME(3) NULL,
    `platformPostId` VARCHAR(191) NULL,
    `failureReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `itsme_post_targets_postId_idx`(`postId`),
    INDEX `itsme_post_targets_socialAccountId_idx`(`socialAccountId`),
    INDEX `itsme_post_targets_status_idx`(`status`),
    INDEX `itsme_post_targets_scheduledAt_idx`(`scheduledAt`),
    UNIQUE INDEX `itsme_post_targets_postId_socialAccountId_key`(`postId`, `socialAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_post_timeline_activities` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` ENUM('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'REFERENCE_ADDED', 'MEDIA_ADDED', 'COMMENT_ADDED', 'APPROVED', 'REJECTED', 'SCHEDULED', 'PUBLISHED', 'PUBLISH_FAILED', 'TASK_LINKED') NOT NULL,
    `note` TEXT NULL,
    `fromValue` VARCHAR(191) NULL,
    `toValue` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itsme_post_timeline_activities_postId_createdAt_idx`(`postId`, `createdAt`),
    INDEX `itsme_post_timeline_activities_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_packages` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(14, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `billingCycle` ENUM('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_packages_companyId_idx`(`companyId`),
    INDEX `itsme_packages_createdById_idx`(`createdById`),
    INDEX `itsme_packages_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `itsme_packages_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_package_items` (
    `id` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `deliverableType` ENUM('STATIC_POST', 'CAROUSEL', 'REEL', 'STORY', 'VIDEO', 'BLOG', 'AD_CREATIVE', 'DESIGN', 'MOTION_GRAPHIC', 'OTHER') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `note` TEXT NULL,

    INDEX `itsme_package_items_packageId_idx`(`packageId`),
    UNIQUE INDEX `itsme_package_items_packageId_deliverableType_key`(`packageId`, `deliverableType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_client_packages` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `priceSnapshot` DECIMAL(14, 2) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_client_packages_companyId_idx`(`companyId`),
    INDEX `itsme_client_packages_clientId_idx`(`clientId`),
    INDEX `itsme_client_packages_projectId_idx`(`projectId`),
    INDEX `itsme_client_packages_packageId_idx`(`packageId`),
    INDEX `itsme_client_packages_status_idx`(`status`),
    INDEX `itsme_client_packages_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_client_package_usage` (
    `id` VARCHAR(191) NOT NULL,
    `clientPackageId` VARCHAR(191) NOT NULL,
    `deliverableType` ENUM('STATIC_POST', 'CAROUSEL', 'REEL', 'STORY', 'VIDEO', 'BLOG', 'AD_CREATIVE', 'DESIGN', 'MOTION_GRAPHIC', 'OTHER') NOT NULL,
    `allocatedCount` INTEGER NOT NULL DEFAULT 0,
    `deliveredCount` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `itsme_client_package_usage_clientPackageId_idx`(`clientPackageId`),
    UNIQUE INDEX `itsme_client_package_usage_clientPackageId_deliverableType_key`(`clientPackageId`, `deliverableType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_campaigns` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `quotationId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `objective` ENUM('AWARENESS', 'ENGAGEMENT', 'LEADS', 'TRAFFIC', 'CONVERSIONS', 'SALES', 'APP_INSTALLS', 'OTHER') NOT NULL DEFAULT 'AWARENESS',
    `status` ENUM('DRAFT', 'PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `budget` DECIMAL(14, 2) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `startDate` DATE NULL,
    `endDate` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `itsme_campaigns_quotationId_key`(`quotationId`),
    INDEX `itsme_campaigns_companyId_idx`(`companyId`),
    INDEX `itsme_campaigns_clientId_idx`(`clientId`),
    INDEX `itsme_campaigns_projectId_idx`(`projectId`),
    INDEX `itsme_campaigns_createdById_idx`(`createdById`),
    INDEX `itsme_campaigns_status_idx`(`status`),
    INDEX `itsme_campaigns_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_lists` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `campaignId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `listType` ENUM('INFLUENCER', 'VENDOR', 'LEAD', 'CONTACT', 'MEDIA', 'IDEA', 'CUSTOM') NOT NULL DEFAULT 'CUSTOM',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_lists_companyId_idx`(`companyId`),
    INDEX `itsme_lists_clientId_idx`(`clientId`),
    INDEX `itsme_lists_projectId_idx`(`projectId`),
    INDEX `itsme_lists_campaignId_idx`(`campaignId`),
    INDEX `itsme_lists_createdById_idx`(`createdById`),
    INDEX `itsme_lists_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_list_items` (
    `id` VARCHAR(191) NOT NULL,
    `listId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `handle` VARCHAR(191) NULL,
    `platform` ENUM('FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TWITTER_X', 'YOUTUBE', 'GOOGLE', 'TIKTOK', 'PINTEREST', 'SNAPCHAT', 'THREADS', 'WHATSAPP', 'TELEGRAM', 'REDDIT') NULL,
    `url` TEXT NULL,
    `attributes` JSON NULL,
    `note` TEXT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_list_items_listId_idx`(`listId`),
    INDEX `itsme_list_items_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_office_locations` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `addressId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `latitude` DECIMAL(10, 7) NOT NULL,
    `longitude` DECIMAL(10, 7) NOT NULL,
    `radiusMeters` INTEGER NOT NULL DEFAULT 200,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_office_locations_companyId_idx`(`companyId`),
    INDEX `itsme_office_locations_addressId_idx`(`addressId`),
    INDEX `itsme_office_locations_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `itsme_office_locations_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_attendance_records` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `approvedById` VARCHAR(191) NULL,
    `workDate` DATE NOT NULL,
    `clockInAt` DATETIME(3) NULL,
    `clockOutAt` DATETIME(3) NULL,
    `clockInLat` DECIMAL(10, 7) NULL,
    `clockInLng` DECIMAL(10, 7) NULL,
    `clockOutLat` DECIMAL(10, 7) NULL,
    `clockOutLng` DECIMAL(10, 7) NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'REMOTE', 'ON_LEAVE', 'HOLIDAY') NOT NULL DEFAULT 'PRESENT',
    `isRemote` BOOLEAN NOT NULL DEFAULT false,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_attendance_records_userId_idx`(`userId`),
    INDEX `itsme_attendance_records_approvedById_idx`(`approvedById`),
    INDEX `itsme_attendance_records_workDate_idx`(`workDate`),
    INDEX `itsme_attendance_records_status_idx`(`status`),
    INDEX `itsme_attendance_records_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `itsme_attendance_records_userId_workDate_key`(`userId`, `workDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_holidays` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `holidayDate` DATE NOT NULL,
    `isOptional` BOOLEAN NOT NULL DEFAULT false,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_holidays_companyId_idx`(`companyId`),
    INDEX `itsme_holidays_holidayDate_idx`(`holidayDate`),
    INDEX `itsme_holidays_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `itsme_holidays_companyId_holidayDate_name_key`(`companyId`, `holidayDate`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_leave_types` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `isPaid` BOOLEAN NOT NULL DEFAULT true,
    `defaultDays` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_leave_types_companyId_idx`(`companyId`),
    INDEX `itsme_leave_types_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `itsme_leave_types_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_leave_balances` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `leaveTypeId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `allocatedDays` DECIMAL(5, 1) NOT NULL DEFAULT 0,
    `usedDays` DECIMAL(5, 1) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `itsme_leave_balances_userId_idx`(`userId`),
    INDEX `itsme_leave_balances_leaveTypeId_idx`(`leaveTypeId`),
    UNIQUE INDEX `itsme_leave_balances_userId_leaveTypeId_year_key`(`userId`, `leaveTypeId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_leave_requests` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `leaveTypeId` VARCHAR(191) NOT NULL,
    `approverId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `totalDays` DECIMAL(4, 1) NOT NULL,
    `reason` TEXT NULL,
    `decisionNote` TEXT NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_leave_requests_userId_idx`(`userId`),
    INDEX `itsme_leave_requests_leaveTypeId_idx`(`leaveTypeId`),
    INDEX `itsme_leave_requests_approverId_idx`(`approverId`),
    INDEX `itsme_leave_requests_status_idx`(`status`),
    INDEX `itsme_leave_requests_startDate_idx`(`startDate`),
    INDEX `itsme_leave_requests_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_quotations` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `quotationNumber` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED') NOT NULL DEFAULT 'DRAFT',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `subTotal` DECIMAL(14, 2) NOT NULL,
    `discountPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxPercent` DECIMAL(5, 2) NOT NULL DEFAULT 18,
    `totalAmount` DECIMAL(14, 2) NOT NULL,
    `validUntil` DATE NOT NULL,
    `terms` TEXT NULL,
    `note` TEXT NULL,
    `portalVisible` BOOLEAN NOT NULL DEFAULT false,
    `pdfFileKey` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `convertedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `itsme_quotations_quotationNumber_key`(`quotationNumber`),
    INDEX `itsme_quotations_companyId_idx`(`companyId`),
    INDEX `itsme_quotations_clientId_idx`(`clientId`),
    INDEX `itsme_quotations_projectId_idx`(`projectId`),
    INDEX `itsme_quotations_createdById_idx`(`createdById`),
    INDEX `itsme_quotations_status_idx`(`status`),
    INDEX `itsme_quotations_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_quotation_lines` (
    `id` VARCHAR(191) NOT NULL,
    `quotationId` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NULL,
    `description` TEXT NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `unitPrice` DECIMAL(14, 2) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `itsme_quotation_lines_quotationId_idx`(`quotationId`),
    INDEX `itsme_quotation_lines_packageId_idx`(`packageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `quotationId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'VIEWED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'DRAFT',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `subTotal` DECIMAL(14, 2) NOT NULL,
    `discountPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxPercent` DECIMAL(5, 2) NOT NULL DEFAULT 18,
    `totalAmount` DECIMAL(14, 2) NOT NULL,
    `issueDate` DATE NOT NULL,
    `dueDate` DATE NOT NULL,
    `terms` TEXT NULL,
    `note` TEXT NULL,
    `portalVisible` BOOLEAN NOT NULL DEFAULT true,
    `pdfFileKey` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `itsme_invoices_quotationId_key`(`quotationId`),
    UNIQUE INDEX `itsme_invoices_invoiceNumber_key`(`invoiceNumber`),
    INDEX `itsme_invoices_companyId_idx`(`companyId`),
    INDEX `itsme_invoices_clientId_idx`(`clientId`),
    INDEX `itsme_invoices_projectId_idx`(`projectId`),
    INDEX `itsme_invoices_createdById_idx`(`createdById`),
    INDEX `itsme_invoices_status_idx`(`status`),
    INDEX `itsme_invoices_dueDate_idx`(`dueDate`),
    INDEX `itsme_invoices_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_invoice_lines` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `unitPrice` DECIMAL(14, 2) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `itsme_invoice_lines_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_payments` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `recordedById` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `method` ENUM('BANK_TRANSFER', 'CASH', 'CHEQUE', 'STRIPE', 'RAZORPAY', 'UPI', 'OTHER') NOT NULL,
    `transactionRef` VARCHAR(191) NULL,
    `gatewayName` VARCHAR(191) NULL,
    `gatewayPayload` JSON NULL,
    `note` TEXT NULL,
    `paidAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_payments_invoiceId_idx`(`invoiceId`),
    INDEX `itsme_payments_recordedById_idx`(`recordedById`),
    INDEX `itsme_payments_paidAt_idx`(`paidAt`),
    INDEX `itsme_payments_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_expenses` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `submittedById` VARCHAR(191) NOT NULL,
    `approvedById` VARCHAR(191) NULL,
    `receiptFileId` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED') NOT NULL DEFAULT 'PENDING',
    `decisionNote` TEXT NULL,
    `incurredAt` DATE NOT NULL,
    `reimbursedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_expenses_companyId_idx`(`companyId`),
    INDEX `itsme_expenses_projectId_idx`(`projectId`),
    INDEX `itsme_expenses_submittedById_idx`(`submittedById`),
    INDEX `itsme_expenses_approvedById_idx`(`approvedById`),
    INDEX `itsme_expenses_receiptFileId_idx`(`receiptFileId`),
    INDEX `itsme_expenses_status_idx`(`status`),
    INDEX `itsme_expenses_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_chat_conversations` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `chatType` ENUM('DIRECT', 'GROUP') NOT NULL,
    `name` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_chat_conversations_companyId_idx`(`companyId`),
    INDEX `itsme_chat_conversations_createdById_idx`(`createdById`),
    INDEX `itsme_chat_conversations_chatType_idx`(`chatType`),
    INDEX `itsme_chat_conversations_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_chat_participants` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `isGroupAdmin` BOOLEAN NOT NULL DEFAULT false,
    `lastReadAt` DATETIME(3) NULL,
    `mutedUntil` DATETIME(3) NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leftAt` DATETIME(3) NULL,

    INDEX `itsme_chat_participants_conversationId_idx`(`conversationId`),
    INDEX `itsme_chat_participants_userId_idx`(`userId`),
    UNIQUE INDEX `itsme_chat_participants_conversationId_userId_key`(`conversationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_chat_messages` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NULL,
    `replyToId` VARCHAR(191) NULL,
    `messageType` ENUM('TEXT', 'FILE', 'SYSTEM') NOT NULL DEFAULT 'TEXT',
    `content` TEXT NULL,
    `editedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_chat_messages_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    INDEX `itsme_chat_messages_senderId_idx`(`senderId`),
    INDEX `itsme_chat_messages_fileId_idx`(`fileId`),
    INDEX `itsme_chat_messages_replyToId_idx`(`replyToId`),
    INDEX `itsme_chat_messages_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_social_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `platform` ENUM('FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TWITTER_X', 'YOUTUBE', 'GOOGLE', 'TIKTOK', 'PINTEREST', 'SNAPCHAT', 'THREADS', 'WHATSAPP', 'TELEGRAM', 'REDDIT') NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `accountName` VARCHAR(191) NOT NULL,
    `accountType` VARCHAR(191) NULL,
    `accessToken` TEXT NOT NULL,
    `refreshToken` TEXT NULL,
    `tokenExpiresAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_social_accounts_companyId_idx`(`companyId`),
    INDEX `itsme_social_accounts_clientId_idx`(`clientId`),
    INDEX `itsme_social_accounts_tokenExpiresAt_idx`(`tokenExpiresAt`),
    INDEX `itsme_social_accounts_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `itsme_social_accounts_clientId_platform_externalId_key`(`clientId`, `platform`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_social_account_scopes` (
    `socialAccountId` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`socialAccountId`, `scope`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_social_account_metrics` (
    `id` VARCHAR(191) NOT NULL,
    `socialAccountId` VARCHAR(191) NOT NULL,
    `periodStart` DATE NOT NULL,
    `periodEnd` DATE NOT NULL,
    `reach` INTEGER NOT NULL DEFAULT 0,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `engagements` INTEGER NOT NULL DEFAULT 0,
    `postsPublished` INTEGER NOT NULL DEFAULT 0,
    `followerCount` INTEGER NOT NULL DEFAULT 0,
    `followerGrowth` INTEGER NOT NULL DEFAULT 0,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itsme_social_account_metrics_socialAccountId_idx`(`socialAccountId`),
    INDEX `itsme_social_account_metrics_periodStart_idx`(`periodStart`),
    UNIQUE INDEX `itsme_social_account_metrics_socialAccountId_periodStart_per_key`(`socialAccountId`, `periodStart`, `periodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_campaign_metrics` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `periodStart` DATE NOT NULL,
    `periodEnd` DATE NOT NULL,
    `spend` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `leads` INTEGER NOT NULL DEFAULT 0,
    `leadResponses` INTEGER NOT NULL DEFAULT 0,
    `conversions` INTEGER NOT NULL DEFAULT 0,
    `revenue` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itsme_campaign_metrics_campaignId_idx`(`campaignId`),
    INDEX `itsme_campaign_metrics_periodStart_idx`(`periodStart`),
    UNIQUE INDEX `itsme_campaign_metrics_campaignId_periodStart_periodEnd_key`(`campaignId`, `periodStart`, `periodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_documents` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `employeeUserId` VARCHAR(191) NULL,
    `parentId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` ENUM('CONTRACT', 'PROPOSAL', 'CREATIVE_ASSET', 'REPORT', 'BRAND_GUIDELINE', 'ID_PROOF', 'RESUME', 'OFFER_LETTER', 'EXPERIENCE_LETTER', 'CERTIFICATE', 'BANK_DETAIL', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `version` INTEGER NOT NULL DEFAULT 1,
    `isClientVisible` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `deletedBy` VARCHAR(191) NULL,

    INDEX `itsme_documents_companyId_idx`(`companyId`),
    INDEX `itsme_documents_fileId_idx`(`fileId`),
    INDEX `itsme_documents_clientId_idx`(`clientId`),
    INDEX `itsme_documents_projectId_idx`(`projectId`),
    INDEX `itsme_documents_employeeUserId_idx`(`employeeUserId`),
    INDEX `itsme_documents_parentId_idx`(`parentId`),
    INDEX `itsme_documents_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_notifications` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `clientPortalUserId` VARCHAR(191) NULL,
    `notificationType` ENUM('TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'TASK_COMMENT', 'PROJECT_CREATED', 'PROJECT_STATUS_CHANGED', 'POST_ASSIGNED', 'POST_STATUS_CHANGED', 'POST_SCHEDULED', 'POST_PUBLISHED', 'POST_PUBLISH_FAILED', 'ADDED_TO_WORKSPACE', 'ADDED_TO_CHAT_GROUP', 'CHAT_MESSAGE', 'CAMPAIGN_CREATED', 'PACKAGE_LIMIT_EXCEEDED', 'LEAVE_REQUESTED', 'LEAVE_STATUS_CHANGED', 'ATTENDANCE_FLAGGED', 'INVOICE_SENT', 'INVOICE_OVERDUE', 'PAYMENT_RECEIVED', 'QUOTATION_SENT', 'QUOTATION_ACCEPTED', 'EXPENSE_STATUS_CHANGED', 'DOCUMENT_UPLOADED', 'CLIENT_APPROVAL_REQUIRED', 'MENTION', 'SYSTEM_ALERT') NOT NULL,
    `channel` ENUM('IN_APP', 'EMAIL', 'PUSH') NOT NULL DEFAULT 'IN_APP',
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `entity` ENUM('COMPANY', 'USER', 'ROLE', 'CLIENT', 'PROJECT', 'WORKSPACE', 'TASK', 'POST', 'PACKAGE', 'CLIENT_PACKAGE', 'CAMPAIGN', 'LIST', 'INVOICE', 'QUOTATION', 'PAYMENT', 'ATTENDANCE', 'LEAVE', 'DOCUMENT', 'SOCIAL_ACCOUNT', 'EXPENSE', 'CHAT_CONVERSATION', 'CLIENT_PORTAL_PERMISSION') NULL,
    `entityId` VARCHAR(191) NULL,
    `actionUrl` TEXT NULL,
    `readAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itsme_notifications_userId_readAt_idx`(`userId`, `readAt`),
    INDEX `itsme_notifications_clientPortalUserId_readAt_idx`(`clientPortalUserId`, `readAt`),
    INDEX `itsme_notifications_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_notification_preferences` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `notificationType` ENUM('TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'TASK_COMMENT', 'PROJECT_CREATED', 'PROJECT_STATUS_CHANGED', 'POST_ASSIGNED', 'POST_STATUS_CHANGED', 'POST_SCHEDULED', 'POST_PUBLISHED', 'POST_PUBLISH_FAILED', 'ADDED_TO_WORKSPACE', 'ADDED_TO_CHAT_GROUP', 'CHAT_MESSAGE', 'CAMPAIGN_CREATED', 'PACKAGE_LIMIT_EXCEEDED', 'LEAVE_REQUESTED', 'LEAVE_STATUS_CHANGED', 'ATTENDANCE_FLAGGED', 'INVOICE_SENT', 'INVOICE_OVERDUE', 'PAYMENT_RECEIVED', 'QUOTATION_SENT', 'QUOTATION_ACCEPTED', 'EXPENSE_STATUS_CHANGED', 'DOCUMENT_UPLOADED', 'CLIENT_APPROVAL_REQUIRED', 'MENTION', 'SYSTEM_ALERT') NOT NULL,
    `inApp` BOOLEAN NOT NULL DEFAULT true,
    `email` BOOLEAN NOT NULL DEFAULT true,
    `push` BOOLEAN NOT NULL DEFAULT true,

    INDEX `itsme_notification_preferences_userId_idx`(`userId`),
    UNIQUE INDEX `itsme_notification_preferences_userId_notificationType_key`(`userId`, `notificationType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itsme_activity_logs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` ENUM('CREATE', 'UPDATE', 'SOFT_DELETE', 'RESTORE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'SEND', 'EXPORT', 'UPLOAD', 'DOWNLOAD', 'TOGGLE', 'ASSIGN', 'UNASSIGN') NOT NULL,
    `entity` ENUM('COMPANY', 'USER', 'ROLE', 'CLIENT', 'PROJECT', 'WORKSPACE', 'TASK', 'POST', 'PACKAGE', 'CLIENT_PACKAGE', 'CAMPAIGN', 'LIST', 'INVOICE', 'QUOTATION', 'PAYMENT', 'ATTENDANCE', 'LEAVE', 'DOCUMENT', 'SOCIAL_ACCOUNT', 'EXPENSE', 'CHAT_CONVERSATION', 'CLIENT_PORTAL_PERMISSION') NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `beforeState` JSON NULL,
    `afterState` JSON NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itsme_activity_logs_userId_idx`(`userId`),
    INDEX `itsme_activity_logs_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `itsme_activity_logs_action_idx`(`action`),
    INDEX `itsme_activity_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `itsme_companies` ADD CONSTRAINT `itsme_companies_registeredAddressId_fkey` FOREIGN KEY (`registeredAddressId`) REFERENCES `itsme_addresses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_roles` ADD CONSTRAINT `itsme_roles_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_role_permissions` ADD CONSTRAINT `itsme_role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `itsme_roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_role_permissions` ADD CONSTRAINT `itsme_role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `itsme_permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_users` ADD CONSTRAINT `itsme_users_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_users` ADD CONSTRAINT `itsme_users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `itsme_roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_employee_profiles` ADD CONSTRAINT `itsme_employee_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `itsme_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_employee_profiles` ADD CONSTRAINT `itsme_employee_profiles_reportingManagerId_fkey` FOREIGN KEY (`reportingManagerId`) REFERENCES `itsme_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_employee_profiles` ADD CONSTRAINT `itsme_employee_profiles_currentAddressId_fkey` FOREIGN KEY (`currentAddressId`) REFERENCES `itsme_addresses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_employee_profiles` ADD CONSTRAINT `itsme_employee_profiles_permanentAddressId_fkey` FOREIGN KEY (`permanentAddressId`) REFERENCES `itsme_addresses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_employee_bank_details` ADD CONSTRAINT `itsme_employee_bank_details_employeeProfileId_fkey` FOREIGN KEY (`employeeProfileId`) REFERENCES `itsme_employee_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_employee_skills` ADD CONSTRAINT `itsme_employee_skills_employeeProfileId_fkey` FOREIGN KEY (`employeeProfileId`) REFERENCES `itsme_employee_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_refresh_tokens` ADD CONSTRAINT `itsme_refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `itsme_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_files` ADD CONSTRAINT `itsme_files_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_files` ADD CONSTRAINT `itsme_files_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_clients` ADD CONSTRAINT `itsme_clients_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_clients` ADD CONSTRAINT `itsme_clients_accountManagerId_fkey` FOREIGN KEY (`accountManagerId`) REFERENCES `itsme_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_clients` ADD CONSTRAINT `itsme_clients_billingAddressId_fkey` FOREIGN KEY (`billingAddressId`) REFERENCES `itsme_addresses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_client_contacts` ADD CONSTRAINT `itsme_client_contacts_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `itsme_clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_client_portal_users` ADD CONSTRAINT `itsme_client_portal_users_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `itsme_clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_client_portal_permissions` ADD CONSTRAINT `itsme_client_portal_permissions_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `itsme_clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_client_portal_permissions` ADD CONSTRAINT `itsme_client_portal_permissions_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_client_calendar_events` ADD CONSTRAINT `itsme_client_calendar_events_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `itsme_clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_client_calendar_events` ADD CONSTRAINT `itsme_client_calendar_events_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `itsme_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_client_calendar_events` ADD CONSTRAINT `itsme_client_calendar_events_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `itsme_posts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_projects` ADD CONSTRAINT `itsme_projects_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_projects` ADD CONSTRAINT `itsme_projects_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `itsme_clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_projects` ADD CONSTRAINT `itsme_projects_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_workspaces` ADD CONSTRAINT `itsme_workspaces_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_workspaces` ADD CONSTRAINT `itsme_workspaces_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `itsme_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_workspace_members` ADD CONSTRAINT `itsme_workspace_members_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `itsme_workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_workspace_members` ADD CONSTRAINT `itsme_workspace_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `itsme_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_workspace_members` ADD CONSTRAINT `itsme_workspace_members_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_project_milestones` ADD CONSTRAINT `itsme_project_milestones_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `itsme_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_tags` ADD CONSTRAINT `itsme_tags_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_project_tags` ADD CONSTRAINT `itsme_project_tags_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `itsme_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_project_tags` ADD CONSTRAINT `itsme_project_tags_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `itsme_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_post_tags` ADD CONSTRAINT `itsme_post_tags_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `itsme_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_post_tags` ADD CONSTRAINT `itsme_post_tags_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `itsme_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_tasks` ADD CONSTRAINT `itsme_tasks_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_tasks` ADD CONSTRAINT `itsme_tasks_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `itsme_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_tasks` ADD CONSTRAINT `itsme_tasks_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `itsme_workspaces`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_tasks` ADD CONSTRAINT `itsme_tasks_milestoneId_fkey` FOREIGN KEY (`milestoneId`) REFERENCES `itsme_project_milestones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_tasks` ADD CONSTRAINT `itsme_tasks_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `itsme_posts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_tasks` ADD CONSTRAINT `itsme_tasks_parentTaskId_fkey` FOREIGN KEY (`parentTaskId`) REFERENCES `itsme_tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_tasks` ADD CONSTRAINT `itsme_tasks_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_tasks` ADD CONSTRAINT `itsme_tasks_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `itsme_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_task_time_logs` ADD CONSTRAINT `itsme_task_time_logs_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `itsme_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_task_time_logs` ADD CONSTRAINT `itsme_task_time_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_task_comments` ADD CONSTRAINT `itsme_task_comments_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `itsme_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_task_comments` ADD CONSTRAINT `itsme_task_comments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_task_comments` ADD CONSTRAINT `itsme_task_comments_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `itsme_task_comments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_task_attachments` ADD CONSTRAINT `itsme_task_attachments_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `itsme_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_task_attachments` ADD CONSTRAINT `itsme_task_attachments_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `itsme_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_task_comment_attachments` ADD CONSTRAINT `itsme_task_comment_attachments_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `itsme_task_comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_task_comment_attachments` ADD CONSTRAINT `itsme_task_comment_attachments_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `itsme_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_posts` ADD CONSTRAINT `itsme_posts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_posts` ADD CONSTRAINT `itsme_posts_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `itsme_clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_posts` ADD CONSTRAINT `itsme_posts_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `itsme_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_posts` ADD CONSTRAINT `itsme_posts_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `itsme_workspaces`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_posts` ADD CONSTRAINT `itsme_posts_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `itsme_campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_posts` ADD CONSTRAINT `itsme_posts_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_posts` ADD CONSTRAINT `itsme_posts_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `itsme_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_post_media` ADD CONSTRAINT `itsme_post_media_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `itsme_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_post_media` ADD CONSTRAINT `itsme_post_media_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `itsme_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_post_references` ADD CONSTRAINT `itsme_post_references_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `itsme_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_post_targets` ADD CONSTRAINT `itsme_post_targets_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `itsme_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_post_targets` ADD CONSTRAINT `itsme_post_targets_socialAccountId_fkey` FOREIGN KEY (`socialAccountId`) REFERENCES `itsme_social_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_post_timeline_activities` ADD CONSTRAINT `itsme_post_timeline_activities_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `itsme_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_post_timeline_activities` ADD CONSTRAINT `itsme_post_timeline_activities_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `itsme_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_packages` ADD CONSTRAINT `itsme_packages_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_packages` ADD CONSTRAINT `itsme_packages_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_package_items` ADD CONSTRAINT `itsme_package_items_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `itsme_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_client_packages` ADD CONSTRAINT `itsme_client_packages_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_client_packages` ADD CONSTRAINT `itsme_client_packages_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `itsme_clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_client_packages` ADD CONSTRAINT `itsme_client_packages_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `itsme_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_client_packages` ADD CONSTRAINT `itsme_client_packages_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `itsme_packages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_client_package_usage` ADD CONSTRAINT `itsme_client_package_usage_clientPackageId_fkey` FOREIGN KEY (`clientPackageId`) REFERENCES `itsme_client_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_campaigns` ADD CONSTRAINT `itsme_campaigns_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_campaigns` ADD CONSTRAINT `itsme_campaigns_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `itsme_clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_campaigns` ADD CONSTRAINT `itsme_campaigns_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `itsme_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_campaigns` ADD CONSTRAINT `itsme_campaigns_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `itsme_quotations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_campaigns` ADD CONSTRAINT `itsme_campaigns_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_lists` ADD CONSTRAINT `itsme_lists_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_lists` ADD CONSTRAINT `itsme_lists_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `itsme_clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_lists` ADD CONSTRAINT `itsme_lists_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `itsme_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_lists` ADD CONSTRAINT `itsme_lists_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `itsme_campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_lists` ADD CONSTRAINT `itsme_lists_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_list_items` ADD CONSTRAINT `itsme_list_items_listId_fkey` FOREIGN KEY (`listId`) REFERENCES `itsme_lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_office_locations` ADD CONSTRAINT `itsme_office_locations_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_office_locations` ADD CONSTRAINT `itsme_office_locations_addressId_fkey` FOREIGN KEY (`addressId`) REFERENCES `itsme_addresses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_attendance_records` ADD CONSTRAINT `itsme_attendance_records_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_attendance_records` ADD CONSTRAINT `itsme_attendance_records_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `itsme_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_holidays` ADD CONSTRAINT `itsme_holidays_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_leave_types` ADD CONSTRAINT `itsme_leave_types_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_leave_balances` ADD CONSTRAINT `itsme_leave_balances_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `itsme_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_leave_balances` ADD CONSTRAINT `itsme_leave_balances_leaveTypeId_fkey` FOREIGN KEY (`leaveTypeId`) REFERENCES `itsme_leave_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_leave_requests` ADD CONSTRAINT `itsme_leave_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_leave_requests` ADD CONSTRAINT `itsme_leave_requests_leaveTypeId_fkey` FOREIGN KEY (`leaveTypeId`) REFERENCES `itsme_leave_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_leave_requests` ADD CONSTRAINT `itsme_leave_requests_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `itsme_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_quotations` ADD CONSTRAINT `itsme_quotations_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_quotations` ADD CONSTRAINT `itsme_quotations_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `itsme_clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_quotations` ADD CONSTRAINT `itsme_quotations_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `itsme_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_quotations` ADD CONSTRAINT `itsme_quotations_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_quotation_lines` ADD CONSTRAINT `itsme_quotation_lines_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `itsme_quotations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_quotation_lines` ADD CONSTRAINT `itsme_quotation_lines_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `itsme_packages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_invoices` ADD CONSTRAINT `itsme_invoices_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_invoices` ADD CONSTRAINT `itsme_invoices_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `itsme_clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_invoices` ADD CONSTRAINT `itsme_invoices_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `itsme_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_invoices` ADD CONSTRAINT `itsme_invoices_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `itsme_quotations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_invoices` ADD CONSTRAINT `itsme_invoices_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_invoice_lines` ADD CONSTRAINT `itsme_invoice_lines_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `itsme_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_payments` ADD CONSTRAINT `itsme_payments_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `itsme_invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_payments` ADD CONSTRAINT `itsme_payments_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_expenses` ADD CONSTRAINT `itsme_expenses_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_expenses` ADD CONSTRAINT `itsme_expenses_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `itsme_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_expenses` ADD CONSTRAINT `itsme_expenses_submittedById_fkey` FOREIGN KEY (`submittedById`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_expenses` ADD CONSTRAINT `itsme_expenses_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `itsme_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_expenses` ADD CONSTRAINT `itsme_expenses_receiptFileId_fkey` FOREIGN KEY (`receiptFileId`) REFERENCES `itsme_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_chat_conversations` ADD CONSTRAINT `itsme_chat_conversations_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_chat_conversations` ADD CONSTRAINT `itsme_chat_conversations_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_chat_participants` ADD CONSTRAINT `itsme_chat_participants_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `itsme_chat_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_chat_participants` ADD CONSTRAINT `itsme_chat_participants_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `itsme_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_chat_messages` ADD CONSTRAINT `itsme_chat_messages_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `itsme_chat_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_chat_messages` ADD CONSTRAINT `itsme_chat_messages_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `itsme_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_chat_messages` ADD CONSTRAINT `itsme_chat_messages_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `itsme_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_chat_messages` ADD CONSTRAINT `itsme_chat_messages_replyToId_fkey` FOREIGN KEY (`replyToId`) REFERENCES `itsme_chat_messages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_social_accounts` ADD CONSTRAINT `itsme_social_accounts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_social_accounts` ADD CONSTRAINT `itsme_social_accounts_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `itsme_clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_social_account_scopes` ADD CONSTRAINT `itsme_social_account_scopes_socialAccountId_fkey` FOREIGN KEY (`socialAccountId`) REFERENCES `itsme_social_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_social_account_metrics` ADD CONSTRAINT `itsme_social_account_metrics_socialAccountId_fkey` FOREIGN KEY (`socialAccountId`) REFERENCES `itsme_social_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_campaign_metrics` ADD CONSTRAINT `itsme_campaign_metrics_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `itsme_campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_documents` ADD CONSTRAINT `itsme_documents_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `itsme_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_documents` ADD CONSTRAINT `itsme_documents_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `itsme_files`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_documents` ADD CONSTRAINT `itsme_documents_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `itsme_clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_documents` ADD CONSTRAINT `itsme_documents_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `itsme_projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_documents` ADD CONSTRAINT `itsme_documents_employeeUserId_fkey` FOREIGN KEY (`employeeUserId`) REFERENCES `itsme_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_documents` ADD CONSTRAINT `itsme_documents_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `itsme_documents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_notifications` ADD CONSTRAINT `itsme_notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `itsme_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_notifications` ADD CONSTRAINT `itsme_notifications_clientPortalUserId_fkey` FOREIGN KEY (`clientPortalUserId`) REFERENCES `itsme_client_portal_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_notification_preferences` ADD CONSTRAINT `itsme_notification_preferences_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `itsme_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itsme_activity_logs` ADD CONSTRAINT `itsme_activity_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `itsme_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
