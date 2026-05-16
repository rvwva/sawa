"use client";
import { useState } from "react";
import Link from "next/link";

type Lang = "en" | "ar";

const LAST_UPDATED = "15 May 2026";
const LAST_UPDATED_AR = "15 مايو 2026";
const CONTACT_EMAIL = "rawan@mindlign.com";

// ─── Content sections ─────────────────────────────────────────────────────────

const sections = {
  en: [
    {
      title: "1. Who We Are",
      body: `Mindlign HR Technology ("Mindlign", "we", "us") operates the Mindlign employee wellbeing and culture assessment platform. As the data controller for personal data processed through this platform, we are committed to protecting your privacy in accordance with the Saudi Personal Data Protection Law (PDPL) and its implementing regulations issued by the Saudi Data & AI Authority (SDAIA).

Data Controller contact: ${CONTACT_EMAIL}`,
    },
    {
      title: "2. What Personal Data We Collect",
      body: `We collect the minimum data necessary to deliver the service:

• Email address — collected from your employer's HR system solely to send you an assessment invitation link. Your email is never linked to your assessment responses.

• Anonymous assessment responses — your answers to wellbeing and culture questions are stored against a one-time pseudonymous session token generated when you click your unique link. No name, employee ID, or email is attached to these responses.

• Optional demographic information — if you choose to answer the voluntary demographic questions (national status, years of service range, seniority level), these responses are stored anonymously alongside your session token. Answering these questions is entirely optional and has no effect on your assessment results.

• Consent record — a record that you consented, including the date, time, approximate device type, and the version of this privacy policy you agreed to. No personally identifiable information is included in the consent record beyond what is stated here.`,
    },
    {
      title: "3. Legal Basis for Processing (PDPL Article 6)",
      body: `We process your personal data on the basis of your explicit, informed consent obtained at the start of each assessment. You may withdraw your consent at any time by contacting us at ${CONTACT_EMAIL}; however, withdrawal does not affect the lawfulness of processing based on consent before its withdrawal, and once submitted, anonymous responses cannot be linked back to you for deletion.`,
    },
    {
      title: "4. How We Use Your Data",
      body: `Your data is used exclusively for the following purposes:

• To deliver your personalised assessment results to you at the end of the assessment.

• To compute aggregated, anonymised scores at the organisation level and (where 5 or more employees participated) at the department level.

• To generate trend reports for your organisation's HR and Executive teams showing changes in wellbeing and culture over time.

• To send you automated reminders before the assessment deadline if your organisation has configured reminders.

We do not use your data for advertising, profiling, automated decision-making with legal or significant effects, or any purpose beyond the assessment service.`,
    },
    {
      title: "5. Our Anonymisation Approach",
      body: `Mindlign is designed from the ground up to protect employee anonymity:

• Assessment responses are keyed to a one-time session token, not to your email address or any other identifier.

• Your invitation email and your assessment responses are stored in separate database tables with no join key between them.

• Department-level breakdowns are only shown to HR users when at least 5 employees in that department completed the assessment, preventing identification of individuals in small teams.

• Mindlign staff cannot link an individual response to a specific employee.`,
    },
    {
      title: "6. Who We Share Data With",
      body: `• Your employer — HR and Executive users at your organisation can view aggregated scores for the organisation and for departments (subject to the 5-respondent minimum). They cannot view individual responses.

• Mindlign technical staff — may access anonymised data for system maintenance, debugging, and support purposes, under strict confidentiality obligations.

• Third-party processors — we use Railway.app for cloud hosting and Resend for email delivery. Both are bound by data processing agreements. Neither receives individual response data.

• We do not sell, rent, or transfer personal data to any third party for commercial purposes.`,
    },
    {
      title: "7. Data Storage and Security",
      body: `All data is hosted on Railway.app cloud infrastructure. We apply the following security measures:

• Encryption in transit: all communication between your browser and our servers uses TLS 1.2 or higher.

• Encryption at rest: database volumes are encrypted at rest.

• Access controls: role-based access ensures only authorised HR and Mindlign staff can access the platform.

• Audit logging: all access to results and exports is logged for accountability.`,
    },
    {
      title: "8. Data Retention",
      body: `• Assessment response data (anonymous): retained for 5 years from the date the cycle closes, then automatically deleted.

• Email invitation lists: purged within 30 days of the cycle closing date.

• Consent records: retained for the period required by Saudi law to demonstrate lawful processing.

• Audit logs: retained for 3 years.`,
    },
    {
      title: "9. Your Rights Under the PDPL",
      body: `Under the Saudi Personal Data Protection Law (PDPL) and its implementing regulations, you have the following rights:

• Right to be informed — to know what personal data is held about you and how it is used (this policy).

• Right of access — to request a copy of any personal data we hold about you.

• Right to correction — to request correction of inaccurate personal data.

• Right to erasure — to request deletion of your personal data where there is no legitimate basis for continued processing.

• Right to restrict processing — to request that we limit how we process your data.

• Right to object — to object to processing based on legitimate interests.

• Right to data portability — to receive your data in a structured, machine-readable format where technically feasible.

• Right to withdraw consent — to withdraw your consent at any time (see Section 3 above).

• Right to lodge a complaint — to file a complaint with the Saudi Data & AI Authority (SDAIA) at sdaia.gov.sa.

To exercise any of the above rights, please email ${CONTACT_EMAIL}. We will acknowledge your request within 5 business days and respond fully within 15 business days.

Please note: because assessment responses are stored anonymously and cannot be linked back to your identity, we may not be able to fulfil data access or erasure requests for response data submitted before the identity link was severed.`,
    },
    {
      title: "10. Cross-Border Data Transfers",
      body: `Data is hosted on cloud infrastructure operated from within regions that provide adequate levels of data protection. We do not transfer personal data to countries that lack adequate protection without implementing appropriate safeguards as required by PDPL Article 29.`,
    },
    {
      title: "11. Cookies and Tracking",
      body: `Assessment links are single-use and do not require persistent cookies. The HR and Executive dashboard uses session cookies solely for authentication purposes. We do not use tracking cookies, advertising pixels, or any third-party analytics that identify individuals.`,
    },
    {
      title: "12. Children's Data",
      body: `The Mindlign platform is intended for use by employees in professional workplace settings. We do not knowingly collect data from individuals under the age of 18. If you believe a minor has provided data through our platform, please contact us at ${CONTACT_EMAIL}.`,
    },
    {
      title: "13. Changes to This Policy",
      body: `We may update this privacy policy from time to time. When we make material changes, we will update the "Last updated" date at the top of this page and, where appropriate, notify your organisation's HR administrator. Your continued use of the assessment service after the effective date of a change constitutes your acceptance of the updated policy.`,
    },
    {
      title: "14. Contact Us",
      body: `For any privacy-related questions, requests, or complaints:

Mindlign HR Technology
Email: ${CONTACT_EMAIL}

We are committed to resolving privacy concerns promptly and in good faith.`,
    },
  ],

  ar: [
    {
      title: "١. من نحن",
      body: `تشغّل شركة ميندلاين للتقنية ("ميندلاين"، "نحن") منصة تقييم رفاهية الموظفين والثقافة المؤسسية. بوصفنا المتحكم في البيانات الشخصية المعالَجة عبر هذه المنصة، نلتزم بحماية خصوصيتك وفقًا لنظام حماية البيانات الشخصية (نظام حماية البيانات الشخصية) ولوائحه التنفيذية الصادرة عن الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).

للتواصل مع المتحكم في البيانات: ${CONTACT_EMAIL}`,
    },
    {
      title: "٢. البيانات الشخصية التي نجمعها",
      body: `نجمع الحد الأدنى من البيانات اللازمة لتقديم الخدمة:

• عنوان البريد الإلكتروني — يُجمع من نظام الموارد البشرية لدى صاحب العمل لإرسال رابط دعوة التقييم فقط، ولا يرتبط بأي حال بإجاباتك في التقييم.

• ردود التقييم المجهولة — تُخزَّن إجاباتك مقابل رمز جلسة مجهول الهوية يُنشأ لمرة واحدة عند النقر على رابطك الفريد، دون ربطها باسمك أو رقم موظفك أو بريدك الإلكتروني.

• معلومات ديموغرافية اختيارية — إن اخترت الإجابة على الأسئلة الديموغرافية الطوعية (الجنسية، سنوات الخدمة، المستوى الوظيفي)، تُخزَّن هذه الإجابات بصورة مجهولة مع رمز الجلسة. الإجابة عليها اختيارية كليًا ولا تؤثر في نتائج تقييمك.

• سجل الموافقة — يُحفظ توثيق موافقتك متضمنًا التاريخ والوقت ونوع الجهاز التقريبي وإصدار سياسة الخصوصية التي وافقت عليها، دون أي بيانات تعريفية أخرى.`,
    },
    {
      title: "٣. الأساس القانوني للمعالجة (المادة ٦ من النظام)",
      body: `نعالج بياناتك الشخصية استنادًا إلى موافقتك الصريحة والمستنيرة التي نحصل عليها في بداية كل تقييم. يحق لك سحب موافقتك في أي وقت بمراسلتنا على ${CONTACT_EMAIL}؛ غير أن السحب لا يُلغي مشروعية المعالجة التي جرت قبله، وبمجرد إرسال الإجابات لا يمكن ربطها بهويتك لحذفها.`,
    },
    {
      title: "٤. كيف نستخدم بياناتك",
      body: `تُستخدم بياناتك حصرًا للأغراض التالية:

• تقديم نتائج تقييمك الشخصية عند الانتهاء من التقييم.

• احتساب درجات مجمّعة ومجهولة الهوية على مستوى المنظمة وعلى مستوى الأقسام (عند مشاركة خمسة موظفين أو أكثر).

• إعداد تقارير الاتجاهات لفرق الموارد البشرية والمسؤولين التنفيذيين تُظهر التغيرات في الرفاهية والثقافة عبر الزمن.

• إرسال تذكيرات آلية قبل انتهاء مهلة التقييم إذا فعّلت منظمتك خاصية التذكيرات.

لا نستخدم بياناتك في الإعلانات أو التنميط أو اتخاذ قرارات آلية ذات أثر قانوني، ولا لأي غرض خارج نطاق خدمة التقييم.`,
    },
    {
      title: "٥. نهجنا في إخفاء الهوية",
      body: `صُممت منصة ميندلاين من الأساس لحماية هوية الموظف:

• تُربط ردود التقييم برمز جلسة يُستخدم مرة واحدة، لا بعنوان بريدك الإلكتروني أو أي معرّف آخر.

• تُخزَّن رسائل الدعوة وردود التقييم في جداول قاعدة بيانات منفصلة دون مفتاح ربط بينهما.

• لا تُعرض بيانات الأقسام لمسؤولي الموارد البشرية إلا إذا أتمّ خمسة موظفين أو أكثر في ذلك القسم التقييم، تفاديًا لتحديد هوية الأفراد في الفرق الصغيرة.

• لا يستطيع موظفو ميندلاين ربط أي رد بموظف بعينه.`,
    },
    {
      title: "٦. مع من نشارك البيانات",
      body: `• صاحب عملك — يستطيع مستخدمو الموارد البشرية والمسؤولون التنفيذيون في منظمتك الاطلاع على الدرجات المجمّعة للمنظمة والأقسام (وفق حد خمسة مستجيبين على الأقل)، ولا يستطيعون الاطلاع على الردود الفردية.

• الفريق التقني لميندلاين — قد يطّلع على البيانات المجهولة لأغراض الصيانة والدعم الفني، في إطار التزامات سرية صارمة.

• الجهات المعالِجة من أطراف ثالثة — نستخدم Railway.app للاستضافة السحابية وResend لإرسال البريد الإلكتروني، وكلاهما مقيّد بعقود معالجة بيانات ولا يتلقيان بيانات الردود الفردية.

• لا نبيع البيانات الشخصية أو نؤجرها أو ننقلها إلى أي طرف ثالث لأغراض تجارية.`,
    },
    {
      title: "٧. تخزين البيانات وأمنها",
      body: `تُستضاف جميع البيانات على البنية التحتية السحابية لـ Railway.app، ونطبق التدابير الأمنية التالية:

• التشفير أثناء النقل: تستخدم جميع الاتصالات بين متصفحك وخوادمنا بروتوكول TLS 1.2 أو أعلى.

• التشفير أثناء التخزين: أحجام قواعد البيانات مشفّرة.

• ضوابط الوصول: تضمن أذونات الوصول المستندة إلى الأدوار أن الموظفين المخوّلين فقط يمكنهم الدخول إلى المنصة.

• سجلات المراجعة: يُسجَّل جميع الوصول إلى النتائج والتصديرات.`,
    },
    {
      title: "٨. الاحتفاظ بالبيانات",
      body: `• بيانات ردود التقييم (مجهولة الهوية): تُحتفظ بها لمدة خمس سنوات من تاريخ إغلاق الدورة ثم تُحذف تلقائيًا.

• قوائم الدعوة بالبريد الإلكتروني: تُحذف خلال ٣٠ يومًا من تاريخ إغلاق الدورة.

• سجلات الموافقة: تُحتفظ بها للمدة التي يستوجبها النظام السعودي لإثبات مشروعية المعالجة.

• سجلات المراجعة: تُحتفظ بها لمدة ثلاث سنوات.`,
    },
    {
      title: "٩. حقوقك بموجب نظام حماية البيانات الشخصية",
      body: `يمنحك نظام حماية البيانات الشخصية ولوائحه التنفيذية الحقوق التالية:

• حق الإحاطة — معرفة البيانات الشخصية المحتفظ بها عنك وكيفية استخدامها (هذه السياسة).

• حق الاطلاع — طلب نسخة من بياناتك الشخصية.

• حق التصحيح — طلب تصحيح البيانات غير الدقيقة.

• حق المحو — طلب حذف بياناتك الشخصية متى انتفى الأساس القانوني للاحتفاظ بها.

• حق تقييد المعالجة — طلب الحد من معالجة بياناتك.

• حق الاعتراض — الاعتراض على المعالجة المستندة إلى المصالح المشروعة.

• حق نقل البيانات — استلام بياناتك بصيغة منظمة قابلة للقراءة آليًا حيثما أمكن ذلك تقنيًا.

• حق سحب الموافقة — سحب موافقتك في أي وقت (انظر القسم ٣ أعلاه).

• حق تقديم الشكوى — تقديم شكوى إلى الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا) على sdaia.gov.sa.

لممارسة أي من هذه الحقوق، يُرجى مراسلتنا على ${CONTACT_EMAIL}. سنؤكد استلام طلبك خلال ٥ أيام عمل ونردّ بالكامل خلال ١٥ يوم عمل.

ملاحظة: لأن ردود التقييم تُخزَّن بصورة مجهولة ولا يمكن ربطها بهويتك، قد لا نتمكن من تلبية طلبات الاطلاع أو الحذف للردود المقدَّمة بعد انقطاع صلة الهوية.`,
    },
    {
      title: "١٠. النقل العابر للحدود",
      body: `تُستضاف البيانات على بنية تحتية سحابية تعمل في مناطق توفر مستويات حماية كافية للبيانات. لا ننقل البيانات الشخصية إلى دول لا تتوفر فيها حماية كافية دون تطبيق الضمانات المناسبة المنصوص عليها في المادة ٢٩ من النظام.`,
    },
    {
      title: "١١. ملفات تعريف الارتباط والتتبع",
      body: `روابط التقييم ذات استخدام واحد ولا تتطلب ملفات تعريف ارتباط دائمة. تستخدم لوحة تحكم الموارد البشرية والمسؤولين التنفيذيين ملفات تعريف ارتباط الجلسة لأغراض المصادقة فحسب. لا نستخدم ملفات تعريف ارتباط تتبعية أو بكسلات إعلانية أو أي أداة تحليلية تعرّف الأفراد.`,
    },
    {
      title: "١٢. بيانات القاصرين",
      body: `منصة ميندلاين مخصصة للاستخدام في بيئات العمل المهنية. لا نجمع بيانات عن أفراد دون سن الثامنة عشرة بصورة متعمدة. إن كنت تعتقد أن قاصرًا قدّم بيانات عبر منصتنا، فيُرجى التواصل معنا على ${CONTACT_EMAIL}.`,
    },
    {
      title: "١٣. التغييرات على هذه السياسة",
      body: `قد نحدّث هذه السياسة من وقت لآخر. عند إجراء تغييرات جوهرية، نحدّث تاريخ "آخر تحديث" في أعلى هذه الصفحة، ونُخطر مسؤول الموارد البشرية في منظمتك عند الاقتضاء. استمرارك في استخدام خدمة التقييم بعد تاريخ نفاذ أي تغيير يُعدّ قبولًا للسياسة المحدَّثة.`,
    },
    {
      title: "١٤. تواصل معنا",
      body: `لأي استفسارات أو طلبات أو شكاوى تتعلق بالخصوصية:

ميندلاين للتقنية
البريد الإلكتروني: ${CONTACT_EMAIL}

نلتزم بمعالجة المخاوف المتعلقة بالخصوصية بسرعة وبحسن نية.`,
    },
  ],
};

// ─── Page component ───────────────────────────────────────────────────────────

export default function PrivacyPage() {
  const [lang, setLang] = useState<Lang>("en");
  const isAr = lang === "ar";
  const content = sections[lang];

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="min-h-screen bg-gray-50"
    >
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="font-extrabold text-brand-600 text-lg tracking-tight">
            Mindlign
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(isAr ? "en" : "ar")}
              className="text-sm font-medium text-gray-500 hover:text-brand-600 transition-colors px-3 py-1.5 rounded-lg border border-gray-200 hover:border-brand-300"
            >
              {isAr ? "English" : "عربي"}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-brand-500 to-brand-700 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-3xl font-bold">
            {isAr ? "سياسة الخصوصية" : "Privacy Policy"}
          </h1>
          <p className="mt-2 text-brand-100 text-sm">
            {isAr
              ? `آخر تحديث: ${LAST_UPDATED_AR} · متوافقة مع نظام حماية البيانات الشخصية السعودي`
              : `Last updated: ${LAST_UPDATED} · Compliant with the Saudi Personal Data Protection Law (PDPL)`}
          </p>
          <p className="mt-4 text-white/80 text-sm leading-relaxed max-w-xl">
            {isAr
              ? "تشرح هذه السياسة كيفية تجميع بياناتك الشخصية واستخدامها وحمايتها عند استخدامك لمنصة ميندلاين لتقييم الرفاهية والثقافة المؤسسية."
              : "This policy explains how your personal data is collected, used, and protected when you use the Mindlign employee wellbeing and culture assessment platform."}
          </p>
        </div>
      </div>

      {/* PDPL compliance badge */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800">
          <span className="text-xl shrink-0" aria-hidden>🛡️</span>
          <span>
            {isAr
              ? "هذه السياسة متوافقة مع نظام حماية البيانات الشخصية السعودي (PDPL) ولوائحه التنفيذية الصادرة عن سدايا."
              : "This policy is compliant with the Saudi Personal Data Protection Law (PDPL) and its implementing regulations issued by SDAIA."}
          </span>
        </div>
      </div>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 space-y-8">
        {content.map((section) => (
          <section
            key={section.title}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-bold text-gray-900 text-base">{section.title}</h2>
            </div>
            <div className="px-6 py-5">
              {section.body.split("\n\n").map((para, i) => (
                <p key={i} className="text-sm text-gray-700 leading-relaxed mt-3 first:mt-0 whitespace-pre-line">
                  {para}
                </p>
              ))}
            </div>
          </section>
        ))}

        {/* Contact CTA */}
        <div className="bg-brand-50 border border-brand-100 rounded-2xl px-6 py-6 text-center">
          <p className="font-semibold text-brand-800 text-base">
            {isAr ? "أسئلة حول خصوصيتك؟" : "Questions about your privacy?"}
          </p>
          <p className="text-sm text-brand-600 mt-1">
            {isAr ? "نحن هنا للمساعدة." : "We're here to help."}
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {CONTACT_EMAIL}
          </a>
        </div>

        {/* Back link */}
        <div className="text-center pb-4">
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            {isAr ? "← العودة إلى الرئيسية" : "← Back to Mindlign"}
          </Link>
        </div>
      </main>
    </div>
  );
}
