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
  planYear?: number;
  planWard?: string;
  isBlockedThisYear?: boolean;
  blockReason?: string;
  hasCrossWardWarning?: boolean;
  warningReason?: string;
  isCrossWardCandidate?: boolean;
  isDuplicateAcrossWards?: boolean;
  crossWardInfo?: any;
  crossWardNote?: string;
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
  year?: number;
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
  isOverdue?: number | boolean;
  totalObjects?: number;
  createdAt: string;
  items?: BusinessObject[];
  crossWardConflicts?: any[];
  digitalSignature?: DigitalSignature;
  digitalSignatures?: DigitalSignature[];
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
  planId?: number;
  planQuarter?: string;
  planApprovedAt?: string;
  checklist?: string;
  checklistItems?: InspectionChecklistItem[];
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
  dueDate?: string;
  isOverdue?: number | boolean;
  isAdhoc?: number | boolean;
  createdAt: string;
}

export type AdhocRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AdhocInspectionRequest {
  id: number;
  objectId: number;
  objectName?: string;
  objectType?: BusinessObjectType;
  taxCode?: string;
  idNumber?: string;
  objectAddress?: string;
  representative?: string;
  objectWard?: string;
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

export interface CreateAdhocRequestDto {
  objectId: number;
  reason: string;
  relatedQuarter?: string;
  relatedYear?: number;
  ward?: string;
}

export type AlertType = 'overdue_inspection' | 'overdue_plan' | 'quota_below' | 'quota_above' | 'notice_letter_pending';
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
  userName?: string;
  username?: string;
  action: string;
  entityType: string;
  entityId?: number;
  ward?: string;
  beforeData?: string;
  afterData?: string;
  ipAddress?: string;
  detail?: string;
  createdAt: string;
}

export interface DiffItem {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
  oldDisplay: string;
  newDisplay: string;
  isChanged: boolean;
}

export interface AuditDiffResponse {
  success: boolean;
  log: {
    id: number;
    action: string;
    entityType: string;
    entityId?: number;
    ward?: string;
    ipAddress?: string;
    userName: string;
    createdAt: string;
  };
  summary: {
    totalFields: number;
    changedCount: number;
    isCreate: boolean;
    isDelete: boolean;
    isUpdate: boolean;
  };
  diff: DiffItem[];
}

export type ChecklistResult = 'pass' | 'fail';

export interface InspectionDomain {
  id: number;
  code: string;
  name: string;
  icon?: string;
  color?: string;
}

export interface InspectionChecklistItem {
  id?: number;
  inspectionId?: number;
  domainId: number;
  domainCode?: string;
  domainName?: string;
  domainIcon?: string;
  domainColor?: string;
  criteriaCode: string;
  criteriaName: string;
  result: ChecklistResult;
  violationCodeId?: number | null;
  notes?: string;
  createdAt?: string;
}

export interface DomainStats {
  domainId: number;
  domainCode: string;
  domainName: string;
  icon: string;
  color: string;
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

export interface Ward {
  id: number;
  code: string;
  name: string;
  lat: number;
  lng: number;
  totalObjects?: number;
  activeObjects?: number;
  assignedQuota?: number;
  totalInspections?: number;
  completedInspections?: number;
}

export interface BusinessNotice {
  id?: number;
  inspectionId: number;
  objectId?: number;
  sentByUserId?: number;
  method: 'van_ban_giay' | 'khac';
  sentAt: string;
  note?: string;
  fileUrl?: string;
  sentByName?: string;
}

export interface WardInspectionAlertItem {
  inspectionId: number;
  objectId: number;
  planId: number;
  ward: string;
  severity: number;
  status: string;
  completedAt: string;
  dueDate?: string;
  recommendationNote?: string;
  objectName: string;
  objectTaxCode?: string;
  objectAddress: string;
  objectType: string;
  objectRepresentative?: string;
  planQuarter: string;
  planYear: number;
  totalCriteria: number;
  passCount: number;
  failCount: number;
  passItems: Array<{
    id: number;
    criteriaCode: string;
    criteriaName: string;
    domainCode: string;
    domainName: string;
  }>;
  failItems: Array<{
    id: number;
    criteriaCode: string;
    criteriaName: string;
    domainCode: string;
    domainName: string;
    domainColor?: string;
    notes?: string;
  }>;
  hasNotice: boolean;
  needsNoticeLetter: boolean;
  notice?: BusinessNotice | null;
}

export interface WardInspectionAlertsResponse {
  success: boolean;
  ward: string;
  summary: {
    totalCompleted: number;
    totalWithViolations: number;
    pendingNoticesCount: number;
    sentNoticesCount: number;
  };
  data: WardInspectionAlertItem[];
}

