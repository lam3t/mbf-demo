export type UserRole = 'admin' | 'leader_mbf' | 'officer_mbf' | 'officer_ward';

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

export type SignatureType = 'scan' | 'digital_token';

export interface DigitalCertificateInfo {
  serialNumber: string;
  issuer: string;
  subject?: string;
  validFrom?: string;
  validTo?: string;
  signedAt: string;
}

export interface DigitalSignature {
  id: number;
  planId: number;
  signedByUserId: number;
  signedByName?: string;
  signedByRole: string;
  signatureType: SignatureType;
  signatureImageUrl?: string;
  certificateInfo?: string | DigitalCertificateInfo;
  createdAt: string;
}

export interface Plan {
  id: number;
  quarter: string;
  year: number;
  ward: string;
  status: PlanStatus;
  rejectReason?: string;
  signedDocumentUrl?: string;
  signedDocumentUploadedAt?: string;
  submittedBy?: number;
  submittedByName?: string;
  submittedAt?: string;
  approvedBy?: number;
  approvedByName?: string;
  approvedAt?: string;
  dueDate?: string;
  isOverdue?: number;
  totalObjects?: number;
  createdAt: string;
  digitalSignature?: DigitalSignature;
  digitalSignatures?: DigitalSignature[];
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
  planId?: number;
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
  dueDate?: string;
  isOverdue?: number;
  isAdhoc?: number;
  completedAt?: string;
  isLocked: number;
  checklistItems?: InspectionChecklistItem[];
  createdAt: string;
}

export type AdhocRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AdhocInspectionRequest {
  id: number;
  objectId: number;
  objectName?: string;
  objectType?: string;
  taxCode?: string;
  idNumber?: string;
  objectAddress?: string;
  representative?: string;
  wardRequestedBy: string;
  reason: string;
  status: AdhocRequestStatus;
  rejectReason?: string;
  requestedBy: number;
  requestedByName?: string;
  requestedAt: string;
  approvedBy?: number;
  approvedByName?: string;
  approvedAt?: string;
  relatedQuarter: string;
  relatedYear: number;
  inspectionId?: number;
  createdAt: string;
}

export interface InspectionDomain {
  id: number;
  code: string;
  name: string;
  icon?: string;
  color?: string;
}

export type ChecklistResult = 'pass' | 'fail';

export interface InspectionChecklistItem {
  id?: number;
  inspectionId: number;
  domainId: number;
  domainCode?: string;
  domainName?: string;
  criteriaCode: string;
  criteriaName: string;
  result: ChecklistResult;
  violationCodeId?: number;
  notes?: string;
  createdAt?: string;
}

export interface DomainStats {
  domainId: number;
  domainCode: string;
  domainName: string;
  icon?: string;
  color?: string;
  totalChecked: number;
  totalPass: number;
  totalFail: number;
  passRate: number;
  failRate: number;
  completionRate: number;
}

export interface RankingItem {
  rank: number;
  ward: string;
  target: number;
  completed: number;
  overdue: number;
  rate: number;
  status: string;
  domainName?: string;
}

export type AlertType = 'overdue_inspection' | 'overdue_plan' | 'quota_below' | 'quota_above';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: number;
  type: AlertType;
  relatedEntityType?: string;
  relatedEntityId?: number;
  ward?: string;
  message: string;
  severity: AlertSeverity;
  isRead: number;
  createdAt: string;
}

export interface SystemConfig {
  key: string;
  value: string;
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


