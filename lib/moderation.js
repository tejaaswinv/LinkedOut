import { aiJson } from './ai';

const PHONE = /(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL = /\bhttps?:\/\/\S+/gi;
const EMPLOYEE_ID = /\b(?:employee|emp|staff)\s*(?:id|no\.?|number)?\s*[:#-]?\s*[A-Z0-9-]{4,}\b/gi;
const THREAT = /\b(?:kill|murder|shoot|stab|bomb|hurt)\s+(?:him|her|them|my boss|my manager|that manager)\b/i;

export function deterministicRedact(input = '') {
  let text = input.trim();
  const findings = [];

  const replace = (regex, label) => {
    if (regex.test(text)) findings.push(label);
    regex.lastIndex = 0;
    text = text.replace(regex, `[${label} removed]`);
  };

  replace(EMAIL, 'email');
  replace(PHONE, 'phone');
  replace(URL, 'link');
  replace(EMPLOYEE_ID, 'employee ID');

  return { text, findings };
}

export async function moderateReview({ body, companyName, roleTitle, location }) {
  const deterministic = deterministicRedact(body);
  if (THREAT.test(deterministic.text)) {
    return {
      status: 'rejected',
      safeText: deterministic.text,
      reason: 'Threatening or violent content',
      flags: [...deterministic.findings, 'threat'],
      source: 'deterministic'
    };
  }

  const system = `You moderate LinkedOut, a pseudonymous workplace-review network.
Protect criticism of companies and workplace conditions. Do NOT suppress negative opinions merely because they are harsh.
Flag content only when it contains: personal contact data; doxxing; a clearly identifiable non-public coworker/manager named or uniquely identified; threats; hate targeting protected traits; sexual exploitation; spam; or a severe allegation of criminal/medical/sexual misconduct about an identifiable individual that needs human review.
Company names, broad job titles, departments, office locations, workload complaints, management criticism, salary discussion, layoffs, nepotism claims about the organization, and descriptions of workplace behavior are generally allowed.
Return strict JSON with keys: decision ("approve"|"review"|"reject"), safe_text, reason, flags (array of short strings). If names of private individuals appear, redact them in safe_text with [person removed]. Do not invent facts.`;

  const user = JSON.stringify({
    company: companyName,
    role: roleTitle,
    location,
    text: deterministic.text
  });

  try {
    const result = await aiJson({ system, user, temperature: 0, maxTokens: 700 });
    if (!result) {
      const strict = process.env.MODERATION_MODE === 'strict';
      return {
        status: strict ? 'pending' : 'approved',
        safeText: deterministic.text,
        reason: strict ? 'AI moderation unavailable' : 'Deterministic moderation passed',
        flags: deterministic.findings,
        source: 'fallback'
      };
    }

    const decision = ['approve', 'review', 'reject'].includes(result.decision) ? result.decision : 'review';
    return {
      status: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'pending',
      safeText: typeof result.safe_text === 'string' && result.safe_text.trim() ? result.safe_text.trim() : deterministic.text,
      reason: String(result.reason || 'Moderation completed').slice(0, 500),
      flags: Array.isArray(result.flags) ? result.flags.slice(0, 12).map(String) : deterministic.findings,
      source: 'ai'
    };
  } catch (error) {
    const strict = process.env.MODERATION_MODE === 'strict';
    return {
      status: strict ? 'pending' : 'approved',
      safeText: deterministic.text,
      reason: strict ? `AI moderation failed: ${error.message}` : 'AI unavailable; deterministic moderation passed',
      flags: deterministic.findings,
      source: 'fallback'
    };
  }
}
