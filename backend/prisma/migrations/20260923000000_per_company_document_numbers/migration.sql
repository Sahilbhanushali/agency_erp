-- Document numbers are generated per company, so a global unique index made the
-- second tenant's first invoice/quotation fail. Scope both uniques to the company.
DROP INDEX `itsme_invoices_invoiceNumber_key` ON `itsme_invoices`;
CREATE UNIQUE INDEX `itsme_invoices_companyId_invoiceNumber_key` ON `itsme_invoices`(`companyId`, `invoiceNumber`);

DROP INDEX `itsme_quotations_quotationNumber_key` ON `itsme_quotations`;
CREATE UNIQUE INDEX `itsme_quotations_companyId_quotationNumber_key` ON `itsme_quotations`(`companyId`, `quotationNumber`);
