export type UserRole = 'admin' | 'leader_pa04' | 'officer_pa04' | 'officer_ward';

export interface User {
  id: number;
  username: string;
  passwordHash?: string;
  fullName: string;
  role: UserRole;
  unit: string;
  isActive: number;
  createdAt: string;
}

export interface JwtPayload {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  unit: string;
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
  createdBy?: number;
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
  submittedAt?: string;
  approvedBy?: number;
  approvedAt?: string;
  createdAt: string;
}

export interface PlanItem {
  id: number;
  planId: number;
  objectId: number;
  createdAt: string;
}

export type InspectionStatus = 'not_started' | 'in_progress' | 'completed';

export interface Inspection {
  id: number;
  objectId: number;
  planId: number;
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
  action: string;
  entityType: string;
  entityId?: number;
  detail?: string;
  createdAt: string;
}
