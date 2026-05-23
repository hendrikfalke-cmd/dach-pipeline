export type Priority = 'hot' | 'warm' | 'cold';

export interface ActiveDeal {
  id: string;
  project: string;
  company: string;
  industry: string;
  owner: string;
  ebitda: string;
  status: string;
  timing: string;
  strategy: string;
  origination: string;
  sponsors_interested: string;
  sponsors_declined: string;
  advisors: string;
  priority: Priority;
  created_at: string;
  updated_at: string;
}

export interface ExpectedDeal {
  id: string;
  project: string;
  company: string;
  industry: string;
  owner: string;
  ebitda: string;
  comment: string;
  timing: string;
  expected_strategy: string;
  origination: string;
  sponsors_interested: string;
  sponsors_declined: string;
  advisors: string;
  priority: Priority;
  created_at: string;
  updated_at: string;
}

export interface DeadDeal {
  id: string;
  project: string;
  company: string;
  industry: string;
  owner: string;
  ebitda: string;
  status: string;
  timing: string;
  strategy: string;
  origination: string;
  sponsors_interested: string;
  sponsors_declined: string;
  advisors: string;
  archive_reason: string;
  archived_from: string;
  created_at: string;
  updated_at: string;
  archived_at: string;
}

export type Deal = ActiveDeal | ExpectedDeal;
export type DealTable = 'active_deals' | 'expected_deals' | 'dead_deals';

export interface PipelineUpload {
  id: string;
  upload_type: 'pipeline' | 'meeting_notes';
  source_type: 'image' | 'text';
  image_url: string | null;
  raw_text: string | null;
  extracted_data: Record<string, unknown>;
  applied_changes: Record<string, unknown>;
  status: 'pending' | 'reviewed' | 'applied' | 'rejected';
  deals_added: number;
  deals_updated: number;
  deals_removed: number;
  meeting_context: string | null;
  created_at: string;
}

export interface MeetingNote {
  id: string;
  upload_id: string | null;
  raw_content: string;
  parsed_updates: Record<string, unknown>;
  affected_deal_ids: string[];
  meeting_date: string;
  meeting_with: string;
  deal_company: string;
  created_at: string;
}

export interface ParsedDeal {
  project: string;
  company: string;
  industry: string;
  owner: string;
  ebitda: string;
  status?: string;
  comment?: string;
  timing: string;
  strategy?: string;
  expected_strategy?: string;
  origination: string;
  sponsors_interested: string;
  sponsors_declined: string;
  advisors: string;
}

export interface ParsedPipelineData {
  active_deals: ParsedDeal[];
  expected_deals: ParsedDeal[];
}

export type DiffStatus = 'new' | 'changed' | 'removed' | 'unchanged';

export interface DealDiff {
  status: DiffStatus;
  company: string;
  table: DealTable;
  existingDeal?: Deal;
  parsedDeal?: ParsedDeal;
  changes?: FieldChange[];
  selected: boolean;
}

export interface FieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface NoteUpdate {
  match_type: 'existing' | 'new_deal' | 'unmatched_existing';
  company: string;
  deal_table: DealTable;
  confidence: 'high' | 'medium' | 'low';
  changes?: Record<string, {
    old_hint: string;
    new_value: string;
    reason: string;
  }>;
  new_deal_data?: Partial<ActiveDeal & ExpectedDeal>;
  selected: boolean;
  existingDeal?: Deal;
}

export interface ParsedNotesResponse {
  meeting_summary: string;
  meeting_with: string;
  updates: NoteUpdate[];
  unmatched_mentions: string[];
}

export interface ActivityItem {
  id: string;
  upload_type: string;
  source_type: string;
  meeting_context: string | null;
  deals_added: number;
  deals_updated: number;
  deals_removed: number;
  status: string;
  created_at: string;
  meeting_with: string | null;
  deal_company: string | null;
}

// Sponsor profile
export interface SponsorProfile {
  name: string;
  interestedDeals: (ActiveDeal | ExpectedDeal)[];
  declinedDeals: (ActiveDeal | ExpectedDeal)[];
  advisingDeals: (ActiveDeal | ExpectedDeal)[];
  deadDeals: DeadDeal[];
  totalDeals: number;
}
