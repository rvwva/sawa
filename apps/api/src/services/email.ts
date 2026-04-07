/**
 * Mindlign Email Service — SendGrid
 * ================================
 * Professional bilingual (English / Arabic) transactional emails via SendGrid.
 * All four notification types:
 *   1. Cycle invitation  — sent to employees when a cycle is activated
 *   2. Reminder          — sent 3 days and 1 day before deadline (via scheduler)
 *   3. Cycle closed      — sent to exec/HR with headline metrics
 *   4. Team pulse        — sent to all participants when results are published
 */

import sgMail from "@sendgrid/mail";
import { logger } from "../lib/logger";

sgMail.setApiKey(process.env.SENDGRID_API_KEY ?? "");

const FROM = {
  email: process.env.EMAIL_FROM      ?? "noreply@sawa.app",
  name:  process.env.EMAIL_FROM_NAME ?? "Mindlign",
};

// ─── Parameter interfaces ─────────────────────────────────────────────────────

export interface CycleInviteParams {
  recipientEmails:  string[];
  organisationName: string;
  organisationNameAr?: string;
  assessmentName:   string;
  assessmentNameAr?: string;
  cycleTitle:       string;
  assessmentUrl:    string;
  endsAt:           Date;
}

export interface CycleReminderParams extends CycleInviteParams {
  daysRemaining: number;   // 3 or 1
}

export interface CycleClosedParams {
  recipientEmail:   string;
  recipientName?:   string;
  organisationName: string;
  organisationNameAr?: string;
  cycleTitle:       string;
  assessmentName:   string;
  assessmentNameAr?: string;
  respondentCount:  number;
  avgScore:         number | null;
  topDimension?:    string;
  lowestDimension?: string;
  dashboardUrl:     string;
}

export interface TeamPulseParams {
  recipientEmails:  string[];
  organisationName: string;
  organisationNameAr?: string;
  cycleTitle:       string;
  assessmentName:   string;
  assessmentNameAr?: string;
}

export interface WeeklyReportParams {
  recipientEmail:   string;
  recipientName:    string;
  organisationName: string;
  periodLabel:      string;
  dashboardUrl:     string;
  highlights: {
    totalRespondents: number;
    avgScore:         number | null;
    topDimension?:    string;
    lowestDimension?: string;
  };
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmtEn(d: Date): string {
  return d.toLocaleDateString("en-SA", {
    year: "numeric", month: "long", day: "numeric",
    timeZone: "Asia/Riyadh",
  });
}

function fmtAr(d: Date): string {
  return d.toLocaleDateString("ar-SA", {
    year: "numeric", month: "long", day: "numeric",
    timeZone: "Asia/Riyadh",
  });
}

// ─── Shared CSS ───────────────────────────────────────────────────────────────

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
       background:#f0f2f5;color:#111827;-webkit-font-smoothing:antialiased}
  .w{max-width:600px;margin:24px auto;background:#fff;border-radius:20px;
     overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10)}
  .hdr{background:linear-gradient(135deg,#d97c2a 0%,#a85a14 100%);
       padding:36px 40px;text-align:center}
  .hdr-logo{color:#fff;font-size:28px;font-weight:800;letter-spacing:-.5px}
  .hdr-sub{color:rgba(255,255,255,.80);font-size:12px;margin-top:8px;line-height:1.6}
  .en{padding:32px 40px 20px}
  .en p{line-height:1.75;color:#374151;margin-bottom:14px;font-size:15px}
  .ar{padding:28px 40px 24px;background:#fafafa;
      border-top:2px dashed #e5e7eb;
      direction:rtl;font-family:'Noto Sans Arabic',Tahoma,Arial,sans-serif}
  .ar p{line-height:2;color:#374151;margin-bottom:14px;font-size:15px}
  .cta-row{text-align:center;padding:6px 0 22px}
  .cta{display:inline-block;background:#d97c2a;color:#fff !important;
       text-decoration:none;padding:14px 36px;border-radius:12px;
       font-weight:700;font-size:15px;letter-spacing:.1px}
  .cta:hover{background:#b85f1a}
  .badge{display:inline-block;background:#fef3c7;border:1px solid #f59e0b;
         border-radius:8px;padding:10px 16px;font-size:13px;color:#92400e;
         margin:6px 0 18px;width:100%}
  .badge-ar{display:inline-block;background:#fef3c7;border:1px solid #f59e0b;
            border-radius:8px;padding:10px 16px;font-size:13px;color:#92400e;
            margin:6px 0 18px;width:100%;
            font-family:'Noto Sans Arabic',Tahoma,Arial,sans-serif}
  .stats{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;
         padding:8px 0 22px}
  .stat{background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;
        padding:18px 26px;text-align:center;min-width:110px}
  .sv{font-size:36px;font-weight:800;color:#d97c2a;line-height:1}
  .sl{font-size:11px;color:#6b7280;margin-top:6px;font-weight:500}
  .sl-ar{font-size:11px;color:#6b7280;margin-top:6px;font-weight:500;
         font-family:'Noto Sans Arabic',Tahoma,Arial,sans-serif}
  .dim{background:#f3f4f6;border-radius:8px;padding:10px 16px;
       font-size:13px;color:#374151;margin:4px 0 16px}
  .dim-ar{background:#f3f4f6;border-radius:8px;padding:10px 16px;
          font-size:13px;color:#374151;margin:4px 0 16px;
          font-family:'Noto Sans Arabic',Tahoma,Arial,sans-serif;direction:rtl}
  .mute{font-size:12px;color:#9ca3af;line-height:1.7;margin-top:8px}
  .link{font-size:12px;color:#9ca3af;word-break:break-all;margin-top:6px}
  .ftr{padding:20px 40px;text-align:center;font-size:11px;color:#9ca3af;
       line-height:1.9;border-top:1px solid #f3f4f6}
  .urgent-bar{background:#fef2f2;border-top:3px solid #f87171;
              padding:12px 40px;text-align:center;
              font-size:13px;font-weight:600;color:#b91c1c}
`;

// ─── HTML wrapper ─────────────────────────────────────────────────────────────

function html(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="w">
    <div class="hdr">
      <div class="hdr-logo">Mindlign</div>
      <div class="hdr-sub">
        Workplace Culture &amp; People Intelligence<br>
        ثقافة بيئة العمل والذكاء البشري
      </div>
    </div>
    ${body}
    <div class="ftr">
      &copy; Mindlign &middot; Riyadh, Saudi Arabia &middot; الرياض، المملكة العربية السعودية<br>
      This email is confidential and intended only for the named recipient.<br>
      هذه الرسالة سرية وموجهة للمستلم المحدد فقط.
    </div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CYCLE INVITATION
// ─────────────────────────────────────────────────────────────────────────────

export async function sendCycleInvite(params: CycleInviteParams): Promise<void> {
  const orgEn = params.organisationName;
  const orgAr = params.organisationNameAr ?? params.organisationName;
  const asmEn = params.assessmentName;
  const asmAr = params.assessmentNameAr ?? params.assessmentName;

  const body = `
    <div class="en">
      <p>Hi there,</p>
      <p>
        <strong>${orgEn}</strong> is inviting you to complete the
        <strong>${params.cycleTitle}</strong> assessment.
      </p>
      <p>
        This is an anonymous <strong>${asmEn}</strong> that helps your organisation
        understand workplace wellbeing and culture. Your individual responses are
        completely confidential — results are only shown as group statistics.
        The assessment takes approximately 5–10 minutes.
      </p>
      <div class="badge">
        &#128197;&ensp;<strong>Deadline:</strong>&ensp;${fmtEn(params.endsAt)}
      </div>
      <div class="cta-row">
        <a class="cta" href="${params.assessmentUrl}">Start Assessment &rarr;</a>
      </div>
      <p class="link">
        If the button doesn't work, paste this link into your browser:<br>
        ${params.assessmentUrl}
      </p>
      <p class="mute">
        Your participation is anonymous and entirely voluntary.
        Thank you for helping build a healthier workplace.
      </p>
    </div>

    <div class="ar">
      <p>مرحباً،</p>
      <p>
        تدعوك <strong>${orgAr}</strong> لإكمال تقييم
        <strong>${params.cycleTitle}</strong>.
      </p>
      <p>
        هذا تقييم مجهول الهوية (<strong>${asmAr}</strong>) يساعد مؤسستك على فهم
        الرفاهية وثقافة بيئة العمل. ردودك الفردية سرية تماماً — تُعرض النتائج
        كإحصاءات جماعية فقط. يستغرق التقييم نحو 5–10 دقائق.
      </p>
      <div class="badge-ar">
        &#128197;&ensp;<strong>الموعد النهائي:</strong>&ensp;${fmtAr(params.endsAt)}
      </div>
      <div class="cta-row">
        <a class="cta" href="${params.assessmentUrl}">ابدأ التقييم &larr;</a>
      </div>
      <p class="mute" style="direction:rtl;text-align:right">
        مشاركتك مجهولة الهوية وطوعية تماماً.
        شكراً لمساهمتك في بناء بيئة عمل أكثر صحةً وإنتاجية.
      </p>
    </div>`;

  const subject = `Action required: ${params.cycleTitle} — ${orgEn}`;
  const messages = params.recipientEmails.map((to) => ({
    to,
    from: FROM,
    subject,
    html: html(`${params.cycleTitle} — Assessment Invitation`, body),
  }));

  try {
    await sgMail.send(messages as any);
    logger.info(`Invite sent to ${messages.length} recipients`, { cycleTitle: params.cycleTitle });
  } catch (err) {
    logger.error("sendCycleInvite failed", { err });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. REMINDER (3-day and 1-day)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendCycleReminder(params: CycleReminderParams): Promise<void> {
  const isUrgent  = params.daysRemaining === 1;
  const orgEn     = params.organisationName;
  const orgAr     = params.organisationNameAr ?? params.organisationName;

  const enTimeMsg = isUrgent
    ? "closes <strong>tomorrow</strong>"
    : `closes in <strong>${params.daysRemaining} days</strong>`;
  const arTimeMsg = isUrgent
    ? "تنتهي <strong>غداً</strong>"
    : `تنتهي خلال <strong>${params.daysRemaining} أيام</strong>`;

  const urgentBar = isUrgent
    ? `<div class="urgent-bar">&#9888;&ensp;Final reminder — closes tomorrow · تذكير أخير — تنتهي غداً</div>`
    : "";

  const body = `
    ${urgentBar}
    <div class="en">
      <p>Hi there,</p>
      <p>
        Just a reminder: the <strong>${params.cycleTitle}</strong> assessment at
        <strong>${orgEn}</strong> ${enTimeMsg}.
      </p>
      <div class="badge">
        &#9200;&ensp;<strong>${isUrgent ? "Final deadline" : "Deadline"}:</strong>
        &ensp;${fmtEn(params.endsAt)}
      </div>
      <p>
        If you haven't completed it yet, please take a few minutes before it closes.
        The assessment is anonymous and takes approximately 5–10 minutes.
      </p>
      <div class="cta-row">
        <a class="cta" href="${params.assessmentUrl}">Complete Assessment &rarr;</a>
      </div>
      <p class="mute">Your participation is anonymous and voluntary.</p>
    </div>

    <div class="ar">
      <p>مرحباً،</p>
      <p>
        تذكير: تقييم <strong>${params.cycleTitle}</strong> في
        <strong>${orgAr}</strong> ${arTimeMsg}.
      </p>
      <div class="badge-ar">
        &#9200;&ensp;<strong>${isUrgent ? "الموعد النهائي" : "الموعد النهائي"}:</strong>
        &ensp;${fmtAr(params.endsAt)}
      </div>
      <p>
        إذا لم تُكمل التقييم بعد، يُرجى تخصيص بضع دقائق قبل انتهاء المهلة.
        التقييم مجهول الهوية ويستغرق نحو 5–10 دقائق.
      </p>
      <div class="cta-row">
        <a class="cta" href="${params.assessmentUrl}">أكمل التقييم &larr;</a>
      </div>
      <p class="mute" style="direction:rtl;text-align:right">
        مشاركتك مجهولة الهوية وطوعية تماماً.
      </p>
    </div>`;

  const dayLabel = isUrgent ? "tomorrow" : `${params.daysRemaining} days`;
  const subject  = `Reminder: ${params.cycleTitle} closes in ${dayLabel} — ${orgEn}`;

  const messages = params.recipientEmails.map((to) => ({
    to,
    from: FROM,
    subject,
    html: html("Assessment Reminder · تذكير بالتقييم", body),
  }));

  try {
    await sgMail.send(messages as any);
    logger.info(`Reminder (${params.daysRemaining}d) sent to ${messages.length} recipients`);
  } catch (err) {
    logger.error("sendCycleReminder failed", { err });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CYCLE CLOSED — executive/HR notification with headline metrics
// ─────────────────────────────────────────────────────────────────────────────

export async function sendCycleClosedNotification(params: CycleClosedParams): Promise<void> {
  const orgEn  = params.organisationName;
  const orgAr  = params.organisationNameAr ?? params.organisationName;
  const asmEn  = params.assessmentName;
  const asmAr  = params.assessmentNameAr  ?? params.assessmentName;
  const name   = params.recipientName ?? "there";

  // Build metric stat boxes
  const scoreBoxEn = params.avgScore !== null
    ? `<div class="stat">
         <div class="sv">${params.avgScore.toFixed(1)}</div>
         <div class="sl">Avg Score / 100</div>
       </div>`
    : "";
  const scoreBoxAr = params.avgScore !== null
    ? `<div class="stat">
         <div class="sv">${params.avgScore.toFixed(1)}</div>
         <div class="sl-ar">متوسط الدرجة / 100</div>
       </div>`
    : "";

  // Dimension highlights (top 2 metrics if available)
  const dimHtmlEn = (params.topDimension || params.lowestDimension) ? `
    <div style="margin:4px 0 18px">
      ${params.topDimension    ? `<div class="dim">&#128170;&ensp;<strong>Strongest:</strong> ${params.topDimension}</div>` : ""}
      ${params.lowestDimension ? `<div class="dim">&#9888;&ensp;<strong>Needs attention:</strong> ${params.lowestDimension}</div>` : ""}
    </div>` : "";

  const dimHtmlAr = (params.topDimension || params.lowestDimension) ? `
    <div style="margin:4px 0 18px">
      ${params.topDimension    ? `<div class="dim-ar">&#128170;&ensp;<strong>الأقوى:</strong> ${params.topDimension}</div>` : ""}
      ${params.lowestDimension ? `<div class="dim-ar">&#9888;&ensp;<strong>يحتاج اهتماماً:</strong> ${params.lowestDimension}</div>` : ""}
    </div>` : "";

  const body = `
    <div class="en">
      <p>Hi ${name},</p>
      <p>
        The <strong>${params.cycleTitle}</strong> (${asmEn}) cycle for
        <strong>${orgEn}</strong> has closed. Your results dashboard is ready.
      </p>
      <div class="stats">
        <div class="stat">
          <div class="sv">${params.respondentCount}</div>
          <div class="sl">Respondents</div>
        </div>
        ${scoreBoxEn}
      </div>
      ${dimHtmlEn}
      <div class="cta-row">
        <a class="cta" href="${params.dashboardUrl}">View Results Dashboard &rarr;</a>
      </div>
      <p class="mute">
        All results are aggregated and anonymous. Department breakdowns are only shown
        where there are 5 or more respondents, in accordance with privacy regulations.
      </p>
    </div>

    <div class="ar">
      <p>مرحباً ${name},</p>
      <p>
        انتهت دورة <strong>${params.cycleTitle}</strong> (${asmAr}) لمؤسسة
        <strong>${orgAr}</strong>. لوحة نتائجك جاهزة الآن.
      </p>
      <div class="stats">
        <div class="stat">
          <div class="sv">${params.respondentCount}</div>
          <div class="sl-ar">المشاركون</div>
        </div>
        ${scoreBoxAr}
      </div>
      ${dimHtmlAr}
      <div class="cta-row">
        <a class="cta" href="${params.dashboardUrl}">عرض لوحة النتائج &larr;</a>
      </div>
      <p class="mute" style="direction:rtl;text-align:right">
        جميع النتائج مجمّعة ومجهولة الهوية. تُعرض تفاصيل الأقسام فقط عند مشاركة
        5 أشخاص أو أكثر، وفقاً لأنظمة حماية البيانات.
      </p>
    </div>`;

  try {
    await sgMail.send({
      to:      params.recipientEmail,
      from:    FROM,
      subject: `Results ready: ${params.cycleTitle} — ${params.respondentCount} responses · ${orgEn}`,
      html:    html("Assessment Results Ready · النتائج جاهزة", body),
    });
    logger.info("Cycle-closed notification sent", { to: params.recipientEmail });
  } catch (err) {
    logger.error("sendCycleClosedNotification failed", { err });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TEAM PULSE — sent to all participants when HR publishes results
// ─────────────────────────────────────────────────────────────────────────────

export async function sendTeamPulseNotification(params: TeamPulseParams): Promise<void> {
  const orgEn = params.organisationName;
  const orgAr = params.organisationNameAr ?? params.organisationName;
  const asmEn = params.assessmentName;
  const asmAr = params.assessmentNameAr  ?? params.assessmentName;

  const body = `
    <div class="en">
      <p>Hi there,</p>
      <p>
        The results for the <strong>${params.cycleTitle}</strong> (${asmEn})
        assessment at <strong>${orgEn}</strong> have been reviewed by leadership.
      </p>
      <p>
        The aggregated insights from your participation are now informing
        workplace improvement efforts across the organisation. These results
        help guide decisions around culture, wellbeing, and the working environment.
      </p>
      <p>
        <strong>Thank you for participating.</strong> Your voice makes a real difference —
        even though your responses remain completely anonymous.
      </p>
      <p class="mute">
        Individual results are never shared. All data is aggregated and shown
        only as group statistics. If you have questions about your data, use
        your session token to access or delete your record at any time.
      </p>
    </div>

    <div class="ar">
      <p>مرحباً،</p>
      <p>
        استعرضت القيادة نتائج تقييم <strong>${params.cycleTitle}</strong>
        (${asmAr}) في مؤسسة <strong>${orgAr}</strong>.
      </p>
      <p>
        الرؤى المجمّعة من مشاركتك تُسهم الآن في توجيه جهود تحسين بيئة العمل
        في المؤسسة. وستُستخدم هذه النتائج لدعم قرارات تتعلق بالثقافة
        والرفاهية وبيئة العمل.
      </p>
      <p>
        <strong>شكراً لمشاركتك.</strong> صوتك يُحدث فارقاً حقيقياً —
        حتى وإن ظلت ردودك مجهولة الهوية تماماً.
      </p>
      <p class="mute" style="direction:rtl;text-align:right">
        لا تُشارَك النتائج الفردية مطلقاً. جميع البيانات مجمّعة وتُعرض
        كإحصاءات جماعية فقط. إذا كانت لديك أسئلة حول بياناتك، استخدم
        رمز جلستك للوصول إلى سجلاتك أو حذفها في أي وقت.
      </p>
    </div>`;

  const subject = `Your participation mattered — ${params.cycleTitle} · ${orgEn}`;

  const messages = params.recipientEmails.map((to) => ({
    to,
    from: FROM,
    subject,
    html:  html("Team Pulse · نبضة الفريق", body),
  }));

  try {
    await sgMail.send(messages as any);
    logger.info(`Team pulse sent to ${messages.length} recipients`, { cycleTitle: params.cycleTitle });
  } catch (err) {
    logger.error("sendTeamPulseNotification failed", { err });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. WEEKLY / PERIODIC REPORT (HR/Executive summary)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendReportEmail(params: WeeklyReportParams): Promise<void> {
  const scoreBoxEn = params.highlights.avgScore !== null
    ? `<div class="stat">
         <div class="sv">${params.highlights.avgScore.toFixed(1)}</div>
         <div class="sl">Avg Score / 100</div>
       </div>`
    : "";

  const dimHtmlEn = (params.highlights.topDimension || params.highlights.lowestDimension) ? `
    <div style="margin:4px 0 18px">
      ${params.highlights.topDimension    ? `<div class="dim">&#128170;&ensp;<strong>Strongest:</strong> ${params.highlights.topDimension}</div>` : ""}
      ${params.highlights.lowestDimension ? `<div class="dim">&#9888;&ensp;<strong>Needs attention:</strong> ${params.highlights.lowestDimension}</div>` : ""}
    </div>` : "";

  const body = `
    <div class="en">
      <p>Hi ${params.recipientName},</p>
      <p>
        Here is your Mindlign people intelligence summary for
        <strong>${params.organisationName}</strong>.
      </p>
      <p class="mute">Period: ${params.periodLabel}</p>
      <div class="stats">
        <div class="stat">
          <div class="sv">${params.highlights.totalRespondents}</div>
          <div class="sl">Respondents</div>
        </div>
        ${scoreBoxEn}
      </div>
      ${dimHtmlEn}
      <div class="cta-row">
        <a class="cta" href="${params.dashboardUrl}">Open Full Dashboard &rarr;</a>
      </div>
      <p class="mute">
        This report is generated automatically. All results are aggregated and anonymous.
      </p>
    </div>`;

  try {
    await sgMail.send({
      to:      params.recipientEmail,
      from:    FROM,
      subject: `Mindlign report — ${params.periodLabel} · ${params.organisationName}`,
      html:    html("People Intelligence Report · تقرير الذكاء البشري", body),
    });
    logger.info("Report email sent", { to: params.recipientEmail });
  } catch (err) {
    logger.error("sendReportEmail failed", { err });
    throw err;
  }
}
