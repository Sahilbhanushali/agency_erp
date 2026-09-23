import type { Address, AddressInput } from "./user";

export interface Company {
  id: string;
  name: string;
  legalName: string | null;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  hsnNumber: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  currency: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  registeredAddressId: string | null;
  registeredAddress: Address | null;
}

export interface CompanyPayload {
  name: string;
  legalName?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  website?: string;
  gstNumber?: string;
  panNumber?: string;
  hsnNumber?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  currency?: string;
  timezone?: string;
  isActive?: boolean;
  registeredAddress?: AddressInput;
}
