export type WeeklyDigestPayload = {weekEnding:string; missing:string[]; late:{campus:string;submittedAt:string}[]};
export type TemplateEmail = {full_name:string;reason:string|null;kind?:string;payload?:unknown};
const escape = (value:string) => value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const ukDate = (value:string,time=false) => {
  const parsed=new Date(time ? value : `${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) throw new Error('Invalid digest date.');
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',day:'numeric',month:'long',year:'numeric',...(time?{hour:'2-digit',minute:'2-digit',hourCycle:'h23' as const}:{})}).format(parsed);
};
function shell(title:string,preheader:string,body:string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>@media(max-width:600px){.content{padding:28px 22px!important}.heading{font-size:28px!important}}</style></head><body style="margin:0;background:#f7f6f2;color:#20231f;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #dedfd8"><tr><td class="content" style="padding:36px 40px;border-top:4px solid #dfbd53"><p style="margin:0 0 32px;font-size:12px;font-weight:bold;letter-spacing:2px;color:#687168">KHARIS ON CAMPUS</p><h1 class="heading" style="margin:0 0 24px;font-size:32px;line-height:1.15;letter-spacing:-1px;font-weight:600">${escape(title)}</h1>${body}<p style="margin:32px 0 8px"><a href="https://kocm.vercel.app/login" style="display:inline-block;background:#dfbd53;color:#20231f;padding:14px 22px;text-decoration:none;font-size:14px;font-weight:bold;border-radius:4px">Open KOC platform</a></p></td></tr><tr><td style="padding:22px 40px;border-top:1px solid #dedfd8;font-size:12px;line-height:1.6;color:#687168">KOC platform · Faith and fellowship through university life.<br><a href="https://kocm.vercel.app" style="color:#687168">kocm.vercel.app</a></td></tr></table></td></tr></table></body></html>`;
}
const paragraph = (text:string) => `<p style="margin:0 0 20px;font-size:15px;line-height:1.65">${escape(text)}</p>`;
export function renderAccountEmail(email:TemplateEmail):{subject:string;text:string;html:string} {
  const greeting=`Hello ${email.full_name || 'there'},`;
  if ((email.kind ?? 'rejection') === 'rejection') {
    const intro='Your application for a KOC platform account has not been approved.';
    const guidance='If you have questions, please contact your KOC leadership team.';
    const reason=email.reason ? `Reason: ${email.reason}` : '';
    return {subject:'Your KOC account application',text:`${greeting}\n\n${intro}${reason?`\n\n${reason}`:''}\n\n${guidance}\n\nhttps://kocm.vercel.app/login\n\nKOC platform team`,html:shell('Your account application',intro,paragraph(greeting)+paragraph(intro)+(reason?paragraph(reason):'')+paragraph(guidance))};
  }
  if(email.kind==='report_reminder'||email.kind==='missing_report'){
    const payload=email.payload as {scope?:unknown;scopeName?:unknown;weekEnding?:unknown}|undefined;
    if(!payload||!['campus','cluster'].includes(String(payload.scope))||typeof payload.scopeName!=='string'||!payload.scopeName.trim()||payload.scopeName.length>200||typeof payload.weekEnding!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(payload.weekEnding))throw new Error('Invalid reminder payload.');
    const date=ukDate(payload.weekEnding),missing=email.kind==='missing_report';
    const title=missing?'Your weekly report is missing':'Weekly report reminder';
    const intro=`Your ${payload.scope} report for ${payload.scopeName}, week ending Friday ${date}, ${missing?'has not been submitted':'is due at 22:00 UK time on Friday'}.`;
    const guidance=missing?'Please submit as soon as possible. Missing means not submitted, not zero attendance or activity. Leadership has been notified.':'Please sign in and submit your weekly report before the 22:00 UK time deadline. If you have already submitted, check that you selected the correct reporting week.';
    return {subject:`${title} — ${date}`,text:`${greeting}\n\n${intro}\n\n${guidance}\n\nhttps://kocm.vercel.app/dashboard\n\nKOC platform team`,html:shell(title,intro,paragraph(greeting)+paragraph(intro)+paragraph(guidance))};
  }
  if (email.kind !== 'weekly_digest') throw new Error('Unsupported email kind.');
  const payload=email.payload as WeeklyDigestPayload | undefined;
  if (!payload || !/^\d{4}-\d{2}-\d{2}$/.test(payload.weekEnding) || !Array.isArray(payload.missing) || !payload.missing.every(item=>typeof item==='string') || !Array.isArray(payload.late) || !payload.late.every(item=>typeof item?.campus==='string' && typeof item?.submittedAt==='string')) throw new Error('Invalid digest payload.');
  const date=ukDate(payload.weekEnding);
  const intro=`Weekly reporting review for Friday ${date}. Reports were due at 22:00 UK time; this review was prepared after the 23:00 UK time check.`;
  const note='Missing means a report was not submitted; it is not zero attendance or activity.';
  const missing=payload.missing.length?payload.missing.map(campus=>`${campus} — not submitted`).join('\n'):'No missing reports.';
  const late=payload.late.length?payload.late.map(item=>`${item.campus} — ${ukDate(item.submittedAt,true)} UK time`).join('\n'):'No late submissions.';
  const list=(items:string[])=>`<ul style="margin:0 0 24px;padding-left:20px;font-size:15px;line-height:1.65">${items.map(item=>`<li>${escape(item)}</li>`).join('')}</ul>`;
  const heading=(text:string)=>`<h2 style="margin:28px 0 12px;font-size:19px;font-weight:600">${escape(text)}</h2>`;
  const body=paragraph(greeting)+paragraph(intro)+heading(`Missing reports (${payload.missing.length})`)+(payload.missing.length?list(payload.missing.map(item=>`${item} — not submitted`)):paragraph(missing))+paragraph(note)+heading(`Late submissions (${payload.late.length})`)+(payload.late.length?list(payload.late.map(item=>`${item.campus} — ${ukDate(item.submittedAt,true)} UK time`)):paragraph(late));
  return {subject:`KOC weekly reporting review — ${date}`,text:`${greeting}\n\n${intro}\n\nMissing reports (${payload.missing.length})\n${missing}\n\n${note}\n\nLate submissions (${payload.late.length})\n${late}\n\nReview reports and download records: https://kocm.vercel.app/dashboard\n\nKOC platform team`,html:shell('Weekly reporting review',`Missing and late reports for ${date}.`,body)};
}
