export type PipelineStatus =
  | 'NEW' | 'WORKING' | 'VISIT_PLANNED' | 'VISITED_TEST_DRIVE' | 'SOLD' | 'LOST';

export type LeadResult =
  | 'NO_ANSWER' | 'CLIENT_BUSY' | 'WRONG_NUMBER' | 'INFO_GIVEN_VISIT_EXPECTED'
  | 'INFO_GIVEN_THINKING' | 'INTERESTED' | 'NOT_INTERESTED' | 'LEFT_INFO_BY_MISTAKE'
  | 'ANOTHER_REGION' | 'VISIT_PLANNED' | 'TEST_DRIVE_COMPLETED' | 'SOLD';

export type LeadSource =
  | 'META' | 'TELEGRAM' | 'INSTAGRAM_ORGANIC' | 'TELEGRAM_ORGANIC' | 'WALK_IN'
  | 'PHONE_CALL' | 'REFERRAL' | 'EXISTING_CUSTOMER' | 'MANUAL' | 'OTHER';

export interface PoolLead {
  id: string;
  priority: 'NORMAL' | 'PRIORITY';
  customerName: string | null;
  phone: string;
  brand: string;
  model: string | null;
  source: LeadSource;
  dealership: string;
  region: string;
  createdAt: string;
}

export interface ListLead {
  id: string;
  priority: 'NORMAL' | 'PRIORITY';
  customerName: string | null;
  phone: string;
  brand: string;
  model: string | null;
  dealership: string;
  pipelineStatus: PipelineStatus;
  lastResult: LeadResult | null;
  nextFollowUpAt: string | null;
  attempts: number;
  assignedManager: string | null;
  createdAt: string;
}

export interface TodayCounts {
  newLeads: number;
  needFirstCall: number;
  callbacksToday: number;
  overdue: number;
  visitExpected: number;
  visitsPlannedToday: number;
}

export interface LeadDetail {
  id: string;
  pipelineStatus: PipelineStatus;
  lastResult: LeadResult | null;
  nextFollowUpAt: string | null;
  expectedVisitAt: string | null;
  customer: { name: string | null; primaryPhone: string; phones: { phone: string }[] };
  brand: { name: string };
  dealership: { dealershipName: string; cityRegion: string };
  modelInterest: string | null;
  source: LeadSource;
  campaign: string | null;
  assignedUser: { id: string; name: string } | null;
  comments: { id: string; text: string; author: string; createdAt: string }[];
  attempts: { id: string; attemptNo: number; result: LeadResult; createdAt: string }[];
  activities: { id: string; event: string; createdAt: string; oldValue: string | null; newValue: string | null }[];
  assignments: { id: string; assignmentType: string; createdAt: string }[];
  appointments: { id: string; date: string; time: string | null; status: string }[];
  formAnswers: { id: string; questionLabelSnapshot: string; answer: string }[];
}
