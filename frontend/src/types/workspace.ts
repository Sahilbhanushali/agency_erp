export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  memberRole: string | null;
  user: { id: string; firstName: string; lastName: string; email: string };
}

export interface Workspace {
  id: string;
  companyId: string;
  projectId: string;
  name: string;
  description: string | null;
  colorHex: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  members: WorkspaceMember[];
}

export interface CreateWorkspacePayload {
  projectId: string;
  name: string;
  description?: string;
  colorHex?: string;
}

export type UpdateWorkspacePayload = Partial<Omit<CreateWorkspacePayload, "projectId">> & {
  isActive?: boolean;
};

export interface AddMemberPayload {
  userId: string;
  memberRole?: string;
}
