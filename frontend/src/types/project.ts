export type ProjectStatus = "DRAFT" | "ACTIVE" | "ON_HOLD" | "IN_REVIEW" | "COMPLETED" | "ARCHIVED" | "CANCELLED";

export interface Project {
  id: string;
  companyId: string;
  clientId: string;
  managerId: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  deadline: string | null;
  budget: string | null;
  currency: string;
  clientApprovalEnabled: boolean;
  colorHex: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string };
  manager: { id: string; firstName: string; lastName: string; email: string };
}

export interface CreateProjectPayload {
  title: string;
  description?: string;
  clientId: string;
  managerId: string;
  companyId?: string;
  status?: ProjectStatus;
  startDate?: string;
  deadline?: string;
  budget?: number;
  currency?: string;
  clientApprovalEnabled?: boolean;
  colorHex?: string;
}

export type UpdateProjectPayload = Partial<Omit<CreateProjectPayload, "companyId">>;
