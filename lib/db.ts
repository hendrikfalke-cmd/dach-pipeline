import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL!);

const VALID_TABLES = new Set([
  'active_deals',
  'expected_deals',
  'dead_deals',
  'pipeline_uploads',
  'meeting_notes',
  // CRM tables
  'crm_institutions',
  'crm_contacts',
  'crm_interactions',
  'crm_synthesized_profiles',
]);

export function validateTable(table: string): string {
  if (!VALID_TABLES.has(table)) throw new Error(`Invalid table: ${table}`);
  return table;
}