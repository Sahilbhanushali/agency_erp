export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "INVITED";
export type Gender = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN" | "FREELANCER";
export type MaritalStatus = "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED" | "OTHER";

export interface Permission {
  id: string;
  code: string;
  module: string;
  action: string;
  description: string | null;
}

export interface Role {
  id: string;
  companyId: string | null;
  name: string;
  displayName: string;
  description?: string | null;
  isSystem?: boolean;
  permissions?: { permission: Permission }[];
  _count?: { users: number };
}

export interface CreateRolePayload {
  companyId?: string;
  name: string;
  displayName: string;
  description?: string;
  permissionIds: string[];
}

export type UpdateRolePayload = Partial<Omit<CreateRolePayload, "companyId" | "name">>;

export interface Address {
  id: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
}

export interface AddressInput {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface EmployeeBankDetail {
  id: string;
  accountHolderName: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  branchName: string | null;
}

export interface EmployeeBankDetailPayload {
  accountHolderName: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  branchName?: string;
}

export interface EmployeeSkill {
  id: string;
  name: string;
  proficiency: number | null;
}

export interface EmployeeSkillPayload {
  name: string;
  proficiency?: number;
}

export interface EmployeeProfile {
  id: string;
  reportingManagerId: string | null;
  currentAddressId: string | null;
  permanentAddressId: string | null;
  employeeCode: string | null;
  bloodGroup: string | null;
  maritalStatus: MaritalStatus | null;
  nationality: string | null;
  personalEmail: string | null;
  alternatePhone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  panNumber: string | null;
  aadhaarNumber: string | null;
  passportNumber: string | null;
  probationEndDate: string | null;
  confirmationDate: string | null;
  note: string | null;
  currentAddress: Address | null;
  permanentAddress: Address | null;
  bankDetail: EmployeeBankDetail | null;
  skills: EmployeeSkill[];
}

export interface EmployeeProfilePayload {
  reportingManagerId?: string;
  employeeCode?: string;
  bloodGroup?: string;
  maritalStatus?: MaritalStatus;
  nationality?: string;
  personalEmail?: string;
  alternatePhone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  panNumber?: string;
  aadhaarNumber?: string;
  passportNumber?: string;
  probationEndDate?: string;
  confirmationDate?: string;
  note?: string;
  currentAddress?: AddressInput;
  permanentAddress?: AddressInput;
}

export type DocumentCategory =
  | "CONTRACT"
  | "PROPOSAL"
  | "CREATIVE_ASSET"
  | "REPORT"
  | "BRAND_GUIDELINE"
  | "ID_PROOF"
  | "RESUME"
  | "OFFER_LETTER"
  | "EXPERIENCE_LETTER"
  | "CERTIFICATE"
  | "BANK_DETAIL"
  | "OTHER";

export interface EmployeeDocument {
  id: string;
  name: string;
  description: string | null;
  category: DocumentCategory;
  isClientVisible: boolean;
  createdAt: string;
  file: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  };
}

export interface User {
  id: string;
  companyId: string | null;
  roleId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  gender: Gender | null;
  dateOfBirth: string | null;
  employmentType: EmploymentType | null;
  department: string | null;
  designation: string | null;
  joiningDate: string | null;
  isRemote: boolean;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  role: Role;
  employeeProfile: EmployeeProfile | null;
}

export interface CreateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
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

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, "companyId">> & {
  status?: UserStatus;
};
