export type UserRole = 'admin' | 'leader_tnt' | 'officer_tnt' | 'officer_ward';

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  unit: string;
  email?: string;
  isActive: number;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

export type BusinessObjectType = 'enterprise' | 'household' | 'individual';
export type BusinessObjectStatus = 'active' | 'suspended';

export interface BusinessObject {
  id: number;
  type: BusinessObjectType;
  taxCode?: string;
  idNumber?: string;
  name: string;
  representative?: string;
  address: string;
  ward: string;
  status: BusinessObjectStatus;
  lastCheckedYear?: number;
  planId?: number;
  planQuarter?: string;
  planWard?: string;
  createdBy?: number;
  createdByName?: string;
  createdAt: string;
}

export interface QuotaConfig {
  id: number;
  ward: string;
  quarter: string;
  minCount: number;
  maxCount: number;
}

export interface CutoffConfig {
  id: number;
  quarter: string;
  cutoffDateTime: string;
}

export type PlanStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface Plan {
  id: number;
  quarter: string;
  ward: string;
  status: PlanStatus;
  rejectReason?: string;
  submittedBy?: number;
  submittedByName?: string;
  submittedAt?: string;
  approvedBy?: number;
  approvedByName?: string;
  approvedAt?: string;
  totalObjects?: number;
  createdAt: string;
  items?: BusinessObject[];
}

export type InspectionStatus = 'not_started' | 'in_progress' | 'completed';

export interface Inspection {
  id: number;
  objectId: number;
  objectName?: string;
  objectType?: BusinessObjectType;
  representative?: string;
  taxCode?: string;
  idNumber?: string;
  objectAddress?: string;
  planId: number;
  planQuarter?: string;
  planApprovedAt?: string;
  checklist?: string;
  violationCodes?: string;
  evidenceFiles?: string;
  recommendationNote?: string;
  recommendationTags?: string;
  status: InspectionStatus;
  lat?: number;
  lng?: number;
  ward: string;
  severity: number;
  completedAt?: string;
  isLocked: number;
  isOverdue?: number;
  createdAt: string;
}

export interface ViolationCatalog {
  id: number;
  code: string;
  name: string;
}

export interface RecommendationTagCatalog {
  id: number;
  code: string;
  name: string;
}

export interface AuditLog {
  id: number;
  userId?: number;
  userName?: string;
  username?: string;
  action: string;
  entityType: string;
  entityId?: number;
  detail?: string;
  createdAt: string;
}
