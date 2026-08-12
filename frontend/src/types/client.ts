export interface Client {
  id: string;
  companyId: string;
  name: string;
  email: string;
  industry: string | null;
  website: string | null;
  logoUrl: string | null;
  phone: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  accountManagerId: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientPayload {
  name: string;
  email: string;
  companyId?: string;
  industry?: string;
  website?: string;
  logoUrl?: string;
  phone?: string;
  gstNumber?: string;
  panNumber?: string;
  accountManagerId?: string;
  note?: string;
}

export type UpdateClientPayload = Partial<Omit<CreateClientPayload, "companyId">> & {
  isActive?: boolean;
};
