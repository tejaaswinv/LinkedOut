import { NextResponse } from 'next/server';
import { z } from 'zod';
import { aiJson } from '../../../../lib/ai';

const schema = z.object({
  kind: z.enum(['redflag','translate']),
  text: z.string().trim().min(3).max(8000)
});

const corporateMap = [
  [/fast[- ]paced/i, 'High urgency or workload may be expected'],
  [/rockstar|ninja|guru/i, 'Role expectations may be unusually broad or vague'],
  [/go above and beyond/i, 'Extra-role work or overtime may be normalized'],
  [/wear many hats/i, 'The role may combine several jobs'],
  [/family/i, 'Boundary-setting may be culturally difficult'],
  [/ownership/i, 'Responsibility may be high relative to authority']
];

function fallback(kind, text) {
  const hits = corporateMap.filter(([r]) => r.test(text)).map(([,m]) => m);
  if (kind === 'redflag') {
    return { risk: Math.min(95, hits.length ? 45 + hits.length * 12 : 28), findings: hits, explanation: hits.length ? 'These phrases can signal expectations worth clarifying in an interview.' : 'No obvious cliché red flags were detected. Context still matters.' };
  }
  const hit = corporateMap.find(([r]) => r.test(text));
  return { translation: hit ? hit[1] : 'This sounds fairly neutral. Ask for concrete expectations, hours, scope and reporting structure.' };
}

export async function POST(request) {
  let input;
  try { input = schema.parse(await request.json()); }
  catch (error) { return NextResponse.json({ error: error.errors?.[0]?.message || 'Invalid request.' }, { status: 400 }); }

  const system = input.kind === 'redflag'
    ? `You analyze job-description language for LinkedOut. Do not claim a workplace is toxic from wording alone. Identify ambiguous phrases, potential workload/boundary risks, and concrete interview questions. Return JSON: risk (0-100), findings (array max 6), explanation (<=70 words), questions (array max 5).`
    : `You are LinkedOut's Corporate Speak Translator. Translate vague workplace language into a cautious plain-English interpretation without asserting hidden intent as fact. Return JSON: translation (<=80 words), questions (array max 4).`;

  try {
    const result = await aiJson({ system, user: input.text, temperature: 0.2, maxTokens: 600 });
    return NextResponse.json(result || fallback(input.kind, input.text));
  } catch {
    return NextResponse.json(fallback(input.kind, input.text));
  }
}
