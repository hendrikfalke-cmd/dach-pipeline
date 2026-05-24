import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const { action, institutionName, notes, interactions } = await req.json();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // ── extract ───────────────────────────────────────────────────────────────
  // Pulls structured investment signals from a single set of raw meeting notes.
  if (action === 'extract') {
    if (!notes?.trim()) {
      return NextResponse.json({ signals: [] }, { headers: CORS });
    }

    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a private credit origination expert. Extract investment signals from these meeting notes for ${institutionName || 'a sponsor'}.

NOTES:
${notes}

Return a JSON array of signals. Each item:
{ "type": "likes" | "avoids" | "structure" | "size" | "sector" | "timing" | "relationship", "text": "concise signal description" }

Examples:
- { "type": "likes", "text": "Asset-heavy businesses in DACH region" }
- { "type": "avoids", "text": "Software / SaaS businesses" }
- { "type": "structure", "text": "Prefers unitranche, min 5y tenor" }
- { "type": "size", "text": "€10–50m ticket size" }

Return ONLY a valid JSON array, no markdown, no other text.`,
        },
      ],
    });

    try {
      const raw = msg.content[0];
      if (raw.type !== 'text') throw new Error('no text');
      // Strip any accidental markdown fences
      const clean = raw.text.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
      const signals = JSON.parse(clean);
      return NextResponse.json({ signals }, { headers: CORS });
    } catch {
      return NextResponse.json({ signals: [] }, { headers: CORS });
    }
  }

  // ── synthesize ────────────────────────────────────────────────────────────
  // Produces a full synthesized investment profile from all recorded interactions.
  if (action === 'synthesize') {
    if (!interactions?.length) {
      return NextResponse.json(
        { error: 'No interactions to synthesize from' },
        { status: 400, headers: CORS }
      );
    }

    const interactionText = (interactions as Array<{
      date: string;
      type: string;
      summary: string;
      raw_notes: string;
      signals: Array<{ type: string; text: string }>;
    }>)
      .map(
        (i) =>
          `[${i.date} – ${i.type}]\nSummary: ${i.summary}\nNotes: ${i.raw_notes}\nSignals: ${(i.signals || []).map((s) => `${s.type}: ${s.text}`).join('; ')}`
      )
      .join('\n\n---\n\n');

    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are a private credit origination expert. Synthesize a comprehensive investment profile for ${institutionName || 'this sponsor'} based on all recorded interactions.

INTERACTIONS:
${interactionText}

Return a JSON object with exactly these fields (use bullet points with • inside the text fields):
{
  "investment_thesis": "2–3 sentence overview of their investment philosophy and approach",
  "strong_likes": "bullet-point list of what they actively look for (sectors, size, geographies, etc.)",
  "avoids": "bullet-point list of deal types, sectors or structures they won't do",
  "preferred_structures": "preferred debt structures, tenors, covenants, pricing expectations",
  "typical_deal": "typical deal size, hold period, co-investment appetite",
  "coverage_note": "internal relationship quality assessment and suggested next steps"
}

Return ONLY valid JSON, no markdown fences, no other text.`,
        },
      ],
    });

    try {
      const raw = msg.content[0];
      if (raw.type !== 'text') throw new Error('no text');
      const clean = raw.text.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
      const profile = JSON.parse(clean);
      return NextResponse.json({ profile }, { headers: CORS });
    } catch (e) {
      console.error('[CRM AI synthesize parse error]', e);
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500, headers: CORS }
      );
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: CORS });
}
