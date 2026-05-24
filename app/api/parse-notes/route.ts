import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { sql } from '@/lib/db';

const systemPrompt = `You are a deal pipeline analyst assistant. You receive meeting notes from a private credit / direct lending professional, along with their current deal pipeline.

Your job is to:
1. Read the meeting notes carefully
2. Identify which existing deals in the pipeline are mentioned or affected
3. Extract specific, actionable updates for each affected deal
4. Identify any completely new deals mentioned that aren't in the pipeline yet
5. Return structured JSON with proposed changes

IMPORTANT RULES:
- Match deals by company name (be flexible with abbreviations and spelling)
- Only propose changes where the notes contain NEW information
- Do NOT overwrite existing data with less specific information
- For status updates, APPEND to existing status rather than replacing (unless the new status clearly supersedes the old one)
- For sponsors_interested / sponsors_declined, ADD new names, don't remove existing
- If the notes mention a new sponsor showing interest, add to sponsors_interested
- If the notes mention a sponsor passing or declining, add to sponsors_declined
- Preserve EBITDA format (e.g. "16m", "20-25m")
- If notes are ambiguous about which deal is referenced, flag it with "confidence": "low" so the user can verify

Return ONLY valid JSON matching this schema:
{
  "meeting_summary": "Brief 1-2 sentence summary of the meeting/notes",
  "meeting_with": "Person or firm discussed with (if identifiable)",
  "updates": [
    {
      "match_type": "existing",
      "company": "Company name as it appears in the pipeline",
      "deal_table": "active_deals" or "expected_deals",
      "confidence": "high" or "medium" or "low",
      "changes": {
        "field_name": {
          "old_hint": "what you think the current value is (for verification)",
          "new_value": "the proposed new value",
          "reason": "brief explanation of why this change is proposed"
        }
      }
    },
    {
      "match_type": "new_deal",
      "company": "New Company Name",
      "deal_table": "expected_deals",
      "confidence": "high",
      "new_deal_data": {
        "project": "",
        "company": "New Company Name",
        "industry": "...",
        "owner": "...",
        "ebitda": "...",
        "comment": "...",
        "timing": "TBD",
        "expected_strategy": "",
        "origination": "Source from meeting notes",
        "sponsors_interested": "",
        "sponsors_declined": "",
        "advisors": ""
      }
    }
  ],
  "unmatched_mentions": [
    "Any company or deal references that couldn't be matched to the pipeline"
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    // Fetch current deals for context
    const [activeDeals, expectedDeals] = await Promise.all([
      sql(`SELECT * FROM active_deals`),
      sql(`SELECT * FROM expected_deals`),
    ]);

    const formData = await request.formData();
    const notesText = formData.get('text') as string | null;
    const image = formData.get('image') as File | null;
    const meetingContext = formData.get('context') as string | null;

    if (!notesText && !image) {
      return NextResponse.json({ error: 'No notes text or image provided' }, { status: 400 });
    }

    const dealContext = `
Here is the current deal pipeline:

ACTIVE DEALS:
${(activeDeals || []).map(d => `- ${d.company} (${d.project}): EBITDA ${d.ebitda}, Status: ${d.status}, Timing: ${d.timing}`).join('\n')}

EXPECTED DEALS:
${(expectedDeals || []).map(d => `- ${d.company} (${d.project}): EBITDA ${d.ebitda}, Comment: ${d.comment}, Timing: ${d.timing}`).join('\n')}

---

MEETING NOTES:
${meetingContext ? `Context: ${meetingContext}\n` : ''}
${notesText || '(See attached image of handwritten notes)'}

---

Analyze these notes and return proposed updates to the pipeline.`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    type MessageContent = Anthropic.Messages.ContentBlockParam;
    const content: MessageContent[] = [];

    if (image) {
      const bytes = await image.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      const mediaType = image.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      });
    }

    content.push({ type: 'text', text: dealContext });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
      system: systemPrompt,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse response' }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Attach existing deal data to each update for the review UI
    // Use fuzzy matching: exact first, then includes, then check both tables
    const allDeals = [...(activeDeals || []), ...(expectedDeals || [])];
    for (const update of parsed.updates || []) {
      if (update.match_type === 'existing') {
        const preferredList = update.deal_table === 'active_deals' ? activeDeals : expectedDeals;
        const companyLower = (update.company || '').toLowerCase().trim();

        // Try exact match in preferred table
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let match = (preferredList || []).find(
          (d: any) => (d.company || '').toLowerCase().trim() === companyLower
        );

        // Try fuzzy (includes) in preferred table
        if (!match) {
          match = (preferredList || []).find(
            (d: any) =>
              (d.company || '').toLowerCase().includes(companyLower) ||
              companyLower.includes((d.company || '').toLowerCase().trim())
          );
        }

        // Try all deals (both tables)
        if (!match) {
          match = allDeals.find(
            (d: any) =>
              (d.company || '').toLowerCase().trim() === companyLower ||
              (d.company || '').toLowerCase().includes(companyLower) ||
              companyLower.includes((d.company || '').toLowerCase().trim())
          );
          // Update the table reference if found in the other table
          if (match) {
            const matchId = match.id;
            const isActive = (activeDeals || []).some((d: any) => d.id === matchId);
            update.deal_table = isActive ? 'active_deals' : 'expected_deals';
          }
        }

        if (match) {
          update.existing_deal = match;
        } else {
          // No match found — convert to "new_deal" so the user can add it
          update.match_type = 'unmatched_existing';
          update.original_match_type = 'existing';
          // Build new_deal_data from the changes
          const newDealData: Record<string, string> = {
            company: update.company || '',
            project: '',
            industry: '',
            owner: '',
            ebitda: '',
            comment: '',
            timing: 'TBD',
            expected_strategy: '',
            origination: '',
            sponsors_interested: '',
            sponsors_declined: '',
            advisors: '',
          };
          // Apply the proposed changes as initial values
          if (update.changes) {
            for (const [field, change] of Object.entries(update.changes as Record<string, { new_value?: string }>)) {
              if (change.new_value) {
                newDealData[field] = change.new_value;
              }
            }
          }
          update.new_deal_data = newDealData;
          update.deal_table = 'expected_deals';
        }
      }
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Parse notes error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
