-- CreateTable
CREATE TABLE `roles` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `permissions` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `avatar` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'INVITED') NOT NULL DEFAULT 'INVITED',
    `gender` ENUM('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY') NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `address` TEXT NULL,
    `employmentType` ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'FREELANCER') NULL,
    `department` VARCHAR(191) NULL,
    `designation` VARCHAR(191) NULL,
    `joiningDate` DATETIME(3) NULL,
    `baseSalary` DECIMAL(12, 2) NULL,
    `isRemote` BOOLEAN NOT NULL DEFAULT false,
    `annualLeaveBalance` INTEGER NOT NULL DEFAULT 18,
    `sickLeaveBalance` INTEGER NOT NULL DEFAULT 10,
    `casualLeaveBalance` INTEGER NOT NULL DEFAULT 6,
    `compensatoryLeaveBalance` INTEGER NOT NULL DEFAULT 0,
    `lastLoginAt` DATETIME(3) NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    INDEX `users_roleId_idx`(`roleId`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(512) NOT NULL,
    `userAgent` TEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_key`(`token`),
    INDEX `refresh_tokens_userId_idx`(`userId`),
    INDEX `refresh_tokens_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clients` (
    `id` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `industry` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `billingAddress` TEXT NULL,
    `gstNumber` VARCHAR(191) NULL,
    `panNumber` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `accountManagerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `clients_email_key`(`email`),
    INDEX `clients_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_contacts` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `designation` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `client_contacts_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_portal_users` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `client_portal_users_email_key`(`email`),
    INDEX `client_portal_users_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_portal_configs` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `updatedBy` VARCHAR(191) NOT NULL,
    `showCampaignLeads` BOOLEAN NOT NULL DEFAULT false,
    `showLeadResponses` BOOLEAN NOT NULL DEFAULT false,
    `showPostInsights` BOOLEAN NOT NULL DEFAULT false,
    `showPostsDelivered` BOOLEAN NOT NULL DEFAULT false,
    `showActiveWork` BOOLEAN NOT NULL DEFAULT false,
    `showScheduledPosts` BOOLEAN NOT NULL DEFAULT false,
    `showSocialAnalytics` BOOLEAN NOT NULL DEFAULT false,
    `showInvoices` BOOLEAN NOT NULL DEFAULT true,
    `showQuotations` BOOLEAN NOT NULL DEFAULT true,
    `showPaymentStatus` BOOLEAN NOT NULL DEFAULT true,
    `showProjectBudget` BOOLEAN NOT NULL DEFAULT false,
    `showProjectTimeline` BOOLEAN NOT NULL DEFAULT false,
    `showMilestones` BOOLEAN NOT NULL DEFAULT true,
    `showDeliverables` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `client_portal_configs_clientId_key`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_calendar_events` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `isAllDay` BOOLEAN NOT NULL DEFAULT false,
    `color` VARCHAR(191) NULL DEFAULT '#6366f1',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `client_calendar_events_clientId_idx`(`clientId`),
    INDEX `client_calendar_events_startDate_idx`(`startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `managerId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'ON_HOLD', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `startDate` DATETIME(3) NULL,
    `deadline` DATETIME(3) NULL,
    `budget` DECIMAL(12, 2) NULL,
    `billableRate` DECIMAL(10, 2) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `clientApprovalEnabled` BOOLEAN NOT NULL DEFAULT false,
    `color` VARCHAR(191) NULL DEFAULT '#6366f1',
    `tags` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `projects_clientId_idx`(`clientId`),
    INDEX `projects_managerId_idx`(`managerId`),
    INDEX `projects_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_milestones` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'MISSED') NOT NULL DEFAULT 'PENDING',
    `showToClient` BOOLEAN NOT NULL DEFAULT true,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `project_milestones_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tasks` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `milestoneId` VARCHAR(191) NULL,
    `parentTaskId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `assigneeId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'NEEDS_REVISION', 'ADMIN_APPROVED', 'CLIENT_PENDING', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'TODO',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `dueDate` DATETIME(3) NULL,
    `estimatedHours` DECIMAL(6, 2) NULL,
    `loggedHours` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `showToClient` BOOLEAN NOT NULL DEFAULT false,
    `clientLabel` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tasks_projectId_idx`(`projectId`),
    INDEX `tasks_assigneeId_idx`(`assigneeId`),
    INDEX `tasks_status_idx`(`status`),
    INDEX `tasks_parentTaskId_idx`(`parentTaskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_time_logs` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `endedAt` DATETIME(3) NULL,
    `durationMin` INTEGER NULL,
    `isBillable` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `task_time_logs_taskId_idx`(`taskId`),
    INDEX `task_time_logs_userId_idx`(`userId`),
    INDEX `task_time_logs_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_comments` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT true,
    `parentId` VARCHAR(191) NULL,
    `editedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `task_comments_taskId_idx`(`taskId`),
    INDEX `task_comments_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NULL,
    `commentId` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `s3Key` VARCHAR(191) NOT NULL,
    `s3Url` TEXT NOT NULL,
    `uploadedBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `task_attachments_taskId_idx`(`taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `office_geofences` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `latitude` DECIMAL(10, 7) NOT NULL,
    `longitude` DECIMAL(10, 7) NOT NULL,
    `radiusM` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_records` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `clockIn` DATETIME(3) NULL,
    `clockOut` DATETIME(3) NULL,
    `clockInLat` DECIMAL(10, 7) NULL,
    `clockInLng` DECIMAL(10, 7) NULL,
    `clockOutLat` DECIMAL(10, 7) NULL,
    `clockOutLng` DECIMAL(10, 7) NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'REMOTE', 'ON_LEAVE', 'HOLIDAY') NOT NULL DEFAULT 'PRESENT',
    `isRemote` BOOLEAN NOT NULL DEFAULT false,
    `workingMinutes` INTEGER NULL,
    `overtimeMinutes` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `approvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `attendance_records_userId_idx`(`userId`),
    INDEX `attendance_records_date_idx`(`date`),
    INDEX `attendance_records_status_idx`(`status`),
    UNIQUE INDEX `attendance_records_userId_date_key`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `holidays` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `isOptional` BOOLEAN NOT NULL DEFAULT false,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `holidays_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_requests` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `approverId` VARCHAR(191) NULL,
    `leaveType` ENUM('ANNUAL', 'SICK', 'CASUAL', 'MATERNITY', 'PATERNITY', 'UNPAID', 'COMPENSATORY', 'OTHER') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'AUTO_APPROVED') NOT NULL DEFAULT 'PENDING',
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `totalDays` DECIMAL(4, 1) NOT NULL,
    `reason` TEXT NULL,
    `rejectionNote` TEXT NULL,
    `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actionAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `leave_requests_userId_idx`(`userId`),
    INDEX `leave_requests_status_idx`(`status`),
    INDEX `leave_requests_startDate_idx`(`startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotations` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `quotationNumber` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED') NOT NULL DEFAULT 'DRAFT',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `subTotal` DECIMAL(12, 2) NOT NULL,
    `discountPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxPercent` DECIMAL(5, 2) NOT NULL DEFAULT 18,
    `taxAmount` DECIMAL(12, 2) NOT NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `validUntil` DATETIME(3) NOT NULL,
    `termsAndConditions` TEXT NULL,
    `notes` TEXT NULL,
    `portalVisible` BOOLEAN NOT NULL DEFAULT false,
    `pdfUrl` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `convertedToInvoiceAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `quotations_quotationNumber_key`(`quotationNumber`),
    INDEX `quotations_clientId_idx`(`clientId`),
    INDEX `quotations_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotation_lines` (
    `id` VARCHAR(191) NOT NULL,
    `quotationId` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `quantity` DECIMAL(8, 2) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `totalPrice` DECIMAL(12, 2) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `quotation_lines_quotationId_idx`(`quotationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `quotationId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'VIEWED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'DRAFT',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `subTotal` DECIMAL(12, 2) NOT NULL,
    `discountPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxPercent` DECIMAL(5, 2) NOT NULL DEFAULT 18,
    `taxAmount` DECIMAL(12, 2) NOT NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `dueDate` DATETIME(3) NOT NULL,
    `issueDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `termsAndConditions` TEXT NULL,
    `notes` TEXT NULL,
    `portalVisible` BOOLEAN NOT NULL DEFAULT true,
    `pdfUrl` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `overdueNotifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoices_quotationId_key`(`quotationId`),
    UNIQUE INDEX `invoices_invoiceNumber_key`(`invoiceNumber`),
    INDEX `invoices_clientId_idx`(`clientId`),
    INDEX `invoices_status_idx`(`status`),
    INDEX `invoices_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_lines` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `quantity` DECIMAL(8, 2) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `totalPrice` DECIMAL(12, 2) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `invoice_lines_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `method` ENUM('BANK_TRANSFER', 'CASH', 'CHEQUE', 'STRIPE', 'RAZORPAY', 'UPI', 'OTHER') NOT NULL,
    `transactionId` VARCHAR(191) NULL,
    `gatewayName` VARCHAR(191) NULL,
    `gatewayPayload` JSON NULL,
    `note` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NOT NULL,
    `recordedBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payments_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_slips` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `status` ENUM('PROCESSING', 'GENERATED', 'APPROVED', 'PAID', 'HELD') NOT NULL DEFAULT 'PROCESSING',
    `basicSalary` DECIMAL(12, 2) NOT NULL,
    `overtime` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `bonus` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `allowances` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `grossPay` DECIMAL(12, 2) NOT NULL,
    `taxDeduction` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `pf` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `esic` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `leaveDed` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `otherDeductions` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalDeductions` DECIMAL(12, 2) NOT NULL,
    `netPay` DECIMAL(12, 2) NOT NULL,
    `workingDays` INTEGER NOT NULL,
    `presentDays` INTEGER NOT NULL,
    `leaveDays` INTEGER NOT NULL,
    `overtimeHours` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `pdfUrl` VARCHAR(191) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payroll_slips_userId_idx`(`userId`),
    INDEX `payroll_slips_status_idx`(`status`),
    UNIQUE INDEX `payroll_slips_userId_month_year_key`(`userId`, `month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` VARCHAR(191) NOT NULL,
    `submittedBy` VARCHAR(191) NOT NULL,
    `approvedBy` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `receiptUrl` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED') NOT NULL DEFAULT 'PENDING',
    `rejectionNote` TEXT NULL,
    `incurredAt` DATETIME(3) NOT NULL,
    `reimbursedAt` DATETIME(3) NULL,
    `projectId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `expenses_submittedBy_idx`(`submittedBy`),
    INDEX `expenses_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_connections` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `platform` ENUM('FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TWITTER_X', 'YOUTUBE', 'GOOGLE', 'TIKTOK') NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `accountName` VARCHAR(191) NOT NULL,
    `accountType` VARCHAR(191) NULL,
    `accessToken` TEXT NOT NULL,
    `refreshToken` TEXT NULL,
    `tokenExpiresAt` DATETIME(3) NULL,
    `scopes` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastSyncAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `social_connections_clientId_idx`(`clientId`),
    INDEX `social_connections_tokenExpiresAt_idx`(`tokenExpiresAt`),
    UNIQUE INDEX `social_connections_clientId_platform_accountId_key`(`clientId`, `platform`, `accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scheduled_posts` (
    `id` VARCHAR(191) NOT NULL,
    `socialConnectionId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `caption` TEXT NOT NULL,
    `mediaUrls` JSON NOT NULL,
    `hashtags` JSON NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `scheduledAt` DATETIME(3) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `platformPostId` VARCHAR(191) NULL,
    `failureReason` TEXT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `scheduled_posts_socialConnectionId_idx`(`socialConnectionId`),
    INDEX `scheduled_posts_status_idx`(`status`),
    INDEX `scheduled_posts_scheduledAt_idx`(`scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_insights` (
    `id` VARCHAR(191) NOT NULL,
    `socialConnectionId` VARCHAR(191) NOT NULL,
    `platform` ENUM('FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TWITTER_X', 'YOUTUBE', 'GOOGLE', 'TIKTOK') NOT NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `reach` INTEGER NOT NULL DEFAULT 0,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `engagements` INTEGER NOT NULL DEFAULT 0,
    `engagementRate` DECIMAL(6, 4) NOT NULL DEFAULT 0,
    `postsPublished` INTEGER NOT NULL DEFAULT 0,
    `followerCount` INTEGER NOT NULL DEFAULT 0,
    `followerGrowth` INTEGER NOT NULL DEFAULT 0,
    `adSpend` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `adImpressions` INTEGER NOT NULL DEFAULT 0,
    `adClicks` INTEGER NOT NULL DEFAULT 0,
    `costPerClick` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `leadsGenerated` INTEGER NOT NULL DEFAULT 0,
    `leadResponses` INTEGER NOT NULL DEFAULT 0,

    INDEX `social_insights_socialConnectionId_idx`(`socialConnectionId`),
    INDEX `social_insights_periodStart_idx`(`periodStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `campaign_metrics` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `campaignName` VARCHAR(191) NOT NULL,
    `platform` ENUM('FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TWITTER_X', 'YOUTUBE', 'GOOGLE', 'TIKTOK') NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `leads` INTEGER NOT NULL DEFAULT 0,
    `responses` INTEGER NOT NULL DEFAULT 0,
    `conversions` INTEGER NOT NULL DEFAULT 0,
    `spend` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `revenue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `campaign_metrics_clientId_idx`(`clientId`),
    INDEX `campaign_metrics_periodStart_idx`(`periodStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `uploadedBy` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` ENUM('CONTRACT', 'PROPOSAL', 'CREATIVE_ASSET', 'REPORT', 'INVOICE_ATTACHMENT', 'BRAND_GUIDELINE', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `mimeType` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `s3Key` VARCHAR(191) NOT NULL,
    `s3Url` TEXT NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `parentId` VARCHAR(191) NULL,
    `isClientVisible` BOOLEAN NOT NULL DEFAULT false,
    `tags` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `documents_clientId_idx`(`clientId`),
    INDEX `documents_projectId_idx`(`projectId`),
    INDEX `documents_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `clientPortalUserId` VARCHAR(191) NULL,
    `type` ENUM('TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'TASK_COMMENT', 'PROJECT_CREATED', 'PROJECT_STATUS_CHANGED', 'LEAVE_REQUESTED', 'LEAVE_STATUS_CHANGED', 'INVOICE_SENT', 'INVOICE_OVERDUE', 'PAYMENT_RECEIVED', 'QUOTATION_SENT', 'QUOTATION_ACCEPTED', 'ATTENDANCE_FLAGGED', 'PAYROLL_GENERATED', 'DOCUMENT_UPLOADED', 'CLIENT_APPROVAL_REQUIRED', 'SOCIAL_POST_PUBLISHED', 'SOCIAL_POST_FAILED', 'MENTION', 'SYSTEM_ALERT') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `entity` ENUM('USER', 'CLIENT', 'PROJECT', 'TASK', 'TASK_COMMENT', 'INVOICE', 'QUOTATION', 'PAYMENT', 'PAYROLL', 'ATTENDANCE', 'LEAVE', 'DOCUMENT', 'SOCIAL_CONNECTION', 'SCHEDULED_POST', 'EXPENSE', 'ROLE', 'CLIENT_PORTAL_CONFIG') NULL,
    `entityId` VARCHAR(191) NULL,
    `actionUrl` VARCHAR(191) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `channel` ENUM('IN_APP', 'EMAIL', 'PUSH', 'SMS') NOT NULL DEFAULT 'IN_APP',
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_isRead_idx`(`userId`, `isRead`),
    INDEX `notifications_clientPortalUserId_idx`(`clientPortalUserId`),
    INDEX `notifications_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_preferences` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'TASK_COMMENT', 'PROJECT_CREATED', 'PROJECT_STATUS_CHANGED', 'LEAVE_REQUESTED', 'LEAVE_STATUS_CHANGED', 'INVOICE_SENT', 'INVOICE_OVERDUE', 'PAYMENT_RECEIVED', 'QUOTATION_SENT', 'QUOTATION_ACCEPTED', 'ATTENDANCE_FLAGGED', 'PAYROLL_GENERATED', 'DOCUMENT_UPLOADED', 'CLIENT_APPROVAL_REQUIRED', 'SOCIAL_POST_PUBLISHED', 'SOCIAL_POST_FAILED', 'MENTION', 'SYSTEM_ALERT') NOT NULL,
    `inApp` BOOLEAN NOT NULL DEFAULT true,
    `email` BOOLEAN NOT NULL DEFAULT true,
    `push` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `notification_preferences_userId_type_key`(`userId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'SEND', 'EXPORT', 'IMPORT', 'ARCHIVE', 'RESTORE', 'UPLOAD', 'DOWNLOAD', 'TOGGLE', 'ASSIGN', 'UNASSIGN') NOT NULL,
    `entity` ENUM('USER', 'CLIENT', 'PROJECT', 'TASK', 'TASK_COMMENT', 'INVOICE', 'QUOTATION', 'PAYMENT', 'PAYROLL', 'ATTENDANCE', 'LEAVE', 'DOCUMENT', 'SOCIAL_CONNECTION', 'SCHEDULED_POST', 'EXPENSE', 'ROLE', 'CLIENT_PORTAL_CONFIG') NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_logs_userId_idx`(`userId`),
    INDEX `activity_logs_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `activity_logs_action_idx`(`action`),
    INDEX `activity_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_contacts` ADD CONSTRAINT `client_contacts_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_portal_users` ADD CONSTRAINT `client_portal_users_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_portal_configs` ADD CONSTRAINT `client_portal_configs_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_portal_configs` ADD CONSTRAINT `client_portal_configs_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_calendar_events` ADD CONSTRAINT `client_calendar_events_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_calendar_events` ADD CONSTRAINT `client_calendar_events_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_milestones` ADD CONSTRAINT `project_milestones_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_milestoneId_fkey` FOREIGN KEY (`milestoneId`) REFERENCES `project_milestones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_parentTaskId_fkey` FOREIGN KEY (`parentTaskId`) REFERENCES `tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_time_logs` ADD CONSTRAINT `task_time_logs_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_time_logs` ADD CONSTRAINT `task_time_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_comments` ADD CONSTRAINT `task_comments_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_comments` ADD CONSTRAINT `task_comments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_comments` ADD CONSTRAINT `task_comments_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `task_comments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_attachments` ADD CONSTRAINT `task_attachments_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_attachments` ADD CONSTRAINT `task_attachments_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `task_comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_lines` ADD CONSTRAINT `quotation_lines_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `quotations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `quotations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_lines` ADD CONSTRAINT `invoice_lines_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_slips` ADD CONSTRAINT `payroll_slips_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_submittedBy_fkey` FOREIGN KEY (`submittedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_approvedBy_fkey` FOREIGN KEY (`approvedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_connections` ADD CONSTRAINT `social_connections_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduled_posts` ADD CONSTRAINT `scheduled_posts_socialConnectionId_fkey` FOREIGN KEY (`socialConnectionId`) REFERENCES `social_connections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_insights` ADD CONSTRAINT `social_insights_socialConnectionId_fkey` FOREIGN KEY (`socialConnectionId`) REFERENCES `social_connections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaign_metrics` ADD CONSTRAINT `campaign_metrics_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_uploadedBy_fkey` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `documents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_clientPortalUserId_fkey` FOREIGN KEY (`clientPortalUserId`) REFERENCES `client_portal_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_preferences` ADD CONSTRAINT `notification_preferences_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
