-- HSN/SAC on the company, and CGST+SGST vs IGST on quotations and invoices.
-- Additive only: the new columns are nullable or carry a default, so existing rows are unaffected.
ALTER TABLE `itsme_companies` ADD COLUMN `hsnNumber` VARCHAR(191) NULL;
ALTER TABLE `itsme_invoices` ADD COLUMN `taxType` ENUM('CGST_SGST', 'IGST') NOT NULL DEFAULT 'CGST_SGST';
ALTER TABLE `itsme_quotations` ADD COLUMN `taxType` ENUM('CGST_SGST', 'IGST') NOT NULL DEFAULT 'CGST_SGST';
