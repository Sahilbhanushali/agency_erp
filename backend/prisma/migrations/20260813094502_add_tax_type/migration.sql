-- AlterTable
ALTER TABLE `itsme_invoices` ADD COLUMN `taxType` ENUM('CGST_SGST', 'IGST') NOT NULL DEFAULT 'CGST_SGST';

-- AlterTable
ALTER TABLE `itsme_quotations` ADD COLUMN `taxType` ENUM('CGST_SGST', 'IGST') NOT NULL DEFAULT 'CGST_SGST';
