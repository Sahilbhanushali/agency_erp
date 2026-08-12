-- AlterTable
ALTER TABLE `itsme_companies` ADD COLUMN `bankAccountName` VARCHAR(191) NULL,
    ADD COLUMN `bankAccountNumber` VARCHAR(191) NULL,
    ADD COLUMN `bankIfsc` VARCHAR(191) NULL,
    ADD COLUMN `bankName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `itsme_invoices` DROP COLUMN `letterheadUrl`;

-- AlterTable
ALTER TABLE `itsme_quotations` DROP COLUMN `letterheadUrl`;
