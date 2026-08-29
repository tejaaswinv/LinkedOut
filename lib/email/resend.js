function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function verificationEmailHtml({ code, contextName, verificationKind }) {
  const safeCode = escapeHtml(code);
  const safeContext = escapeHtml(contextName);
  const kindLabel = verificationKind === 'student' ? 'student affiliation' : 'workplace';

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#101828;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e7ec;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 30px 16px;">
                <div style="font-size:28px;font-weight:800;letter-spacing:-1.2px;color:#0a66c2;">Linked<span style="background:#0a66c2;color:#fff;border-radius:4px;padding:0 4px;margin-left:2px;">out</span></div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 30px 30px;">
                <div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#0a66c2;text-transform:uppercase;">Private verification</div>
                <h1 style="margin:10px 0 8px;font-size:26px;line-height:1.25;">Verify your ${kindLabel}</h1>
                <p style="margin:0 0 20px;color:#475467;font-size:15px;line-height:1.6;">Use this one-time code to verify your affiliation with <strong>${safeContext}</strong>.</p>
                <div style="background:#eef6ff;border:1px solid #cfe5ff;border-radius:12px;text-align:center;padding:20px 16px;margin:20px 0;">
                  <div style="font-size:12px;color:#667085;margin-bottom:7px;">Your 6-digit code</div>
                  <div style="font-size:36px;letter-spacing:8px;font-weight:800;color:#0a66c2;">${safeCode}</div>
                </div>
                <p style="margin:0;color:#667085;font-size:13px;line-height:1.55;">This code expires in 10 minutes. LinkedOut never displays or stores your verification email in plain text. If you did not request this code, you can ignore this message.</p>
              </td>
            </tr>
          </table>
          <p style="max-width:560px;margin:14px auto 0;color:#98a2b3;font-size:11px;line-height:1.5;">Anonymous to the public. Verified to LinkedOut.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendVerificationCode({ to, code, contextName, verificationKind }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.VERIFICATION_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false, reason: 'not_configured' };

  const kindLabel = verificationKind === 'student' ? 'university' : 'workplace';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Your LinkedOut ${kindLabel} verification code`,
      text: `Your LinkedOut verification code for ${contextName} is ${code}. It expires in 10 minutes. If you did not request this code, ignore this email.`,
      html: verificationEmailHtml({ code, contextName, verificationKind })
    })
  });

  let providerBody = null;
  try { providerBody = await response.json(); } catch {}

  if (!response.ok) {
    const providerMessage = providerBody?.message || providerBody?.error?.message || '';
    console.error('Resend verification email failed', {
      status: response.status,
      providerMessage,
      verificationKind
    });
    if (response.status === 403) {
      throw new Error('Verification email could not be sent because the LinkedOut sender domain is not verified in Resend yet.');
    }
    throw new Error('Verification email could not be sent. Please try again in a moment.');
  }

  return { sent: true, id: providerBody?.id || null };
}
