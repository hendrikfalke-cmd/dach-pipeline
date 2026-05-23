import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const systemPrompt = `You are a data extraction assistant. Given a screenshot of an Excel spreadsheet containing a DACH private credit deal pipeline, extract all deal rows into structured JSON.

Return ONLY valid JSON matching this schema:
{
  "active_deals": [
    {
      "project": "string",
      "company": "string",
      "industry": "string",
      "owner": "string",
      "ebitda": "string (e.g. '16m', '20-25m')",
      "status": "string",
      "timing": "string",
      "strategy": "string (MDF|SLF|SLF/MDF|LCF)",
      "origination": "string",
      "sponsors_interested": "string (comma-separated)",
      "sponsors_declined": "string (comma-separated)",
      "advisors": "string"
    }
  ],
  "expected_deals": [...]
}

Rules:
- Extract ALL visible rows, do not skip any
- Preserve exact company names and sponsor names
- If a cell is empty, use empty string ""
- Distinguish between "Active pipeline" and "Expected deals" sections
- For EBITDA, keep the original format (e.g. "16m", "20-25m", "8-10m")`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const bytes = await image.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mediaType = image.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: 'Extract all deals from this pipeline screenshot. Return structured JSON only.',
            },
          ],
        },
      ],
      system: systemPrompt,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse response' }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Parse pipeline error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
