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
  currency: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
}

export interface CompanyPayload {
  name: string;
  legalName?: string;
  email?: string;
  phone?: string;
  website?: string;
  gstNumber?: string;
  panNumber?: string;
  currency?: string;
  timezone?: string;
  isActive?: boolean;
}
