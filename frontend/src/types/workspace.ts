/** How the member participates in this workspace — distinct from their company role. */
export type WorkspaceMemberRole = "LEAD" | "MEMBER" | "VIEWER";

/** The member's company-wide RBAC role, e.g. Project Manager. */
export interface MemberCompanyRole {
  id: string;
  name: string;
  displayName: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  memberRole: WorkspaceMemberRole | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: MemberCompanyRole | null;
  };
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
  memberRole?: WorkspaceMemberRole;
}
