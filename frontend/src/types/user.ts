export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "INVITED";
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN" | "FREELANCER";

export interface Role {
  id: string;
  companyId: string | null;
  name: string;
  displayName: string;
}

export interface EmployeeProfile {
  id: string;
  employeeCode: string | null;
  bloodGroup: string | null;
  nationality: string | null;
  personalEmail: string | null;
  alternatePhone: string | null;
}

export interface User {
  id: string;
  companyId: string | null;
  roleId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  gender: Gender | null;
  dateOfBirth: string | null;
  employmentType: EmploymentType | null;
  department: string | null;
  designation: string | null;
  joiningDate: string | null;
  isRemote: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: Role;
  employeeProfile: EmployeeProfile | null;
}

export interface CreateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  roleId: string;
  companyId?: string;
  gender?: Gender;
  dateOfBirth?: string;
  employmentType?: EmploymentType;
  department?: string;
  designation?: string;
  joiningDate?: string;
  isRemote?: boolean;
}

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, "password" | "companyId">> & {
  status?: UserStatus;
};
