/**
 * Sawa Platform — UI Translations
 * ================================
 * Bilingual English / Arabic for all employee-facing UI text.
 * Survey question text lives in survey-translations.ts.
 */

export type Lang = "en" | "ar";

export const dir = (lang: Lang) => (lang === "ar" ? "rtl" : "ltr");

const ui = {
  en: {
    // ── Language toggle ──────────────────────────────────
    switchLang: "عربي",

    // ── General ──────────────────────────────────────────
    loading:         "Loading assessment…",
    poweredBy:       "Powered by Sawa",
    close:           "Close",
    download:        "Download my results",
    copy:            "Copy",
    copied:          "Copied!",
    backToStart:     "Back to start",

    // ── Errors ────────────────────────────────────────────
    error_title:       "Assessment Unavailable",
    error_not_found:   "This assessment link was not found.",
    error_expired:     "This assessment has expired.",
    error_inactive:    "This assessment is no longer active.",
    error_network:     "Network error. Please check your connection and try again.",
    error_submit:      "Submission failed. Please try again.",
    error_generic:     "Something went wrong. Please refresh the page.",

    // ── Step indicator ────────────────────────────────────
    step_consent:     "Consent",
    step_assessment:  "Assessment",
    step_results:     "Results",

    // ── Consent screen ────────────────────────────────────
    consent_title:         "Before you begin",
    consent_subtitle:      "Please read this carefully before proceeding.",
    consent_anonymous_h:   "Anonymous & Confidential",
    consent_anonymous_p:   "Your responses are completely anonymous. They cannot be linked back to you individually.",
    consent_usage_h:       "How your data is used",
    consent_usage_p:       "Results are shown only as group statistics to your organisation. Individual results are never shared with your employer.",
    consent_retention_h:   "Data retention",
    consent_retention_p:   "Your data is securely stored for up to 5 years in accordance with applicable data protection law, then automatically deleted.",
    consent_rights_h:      "Your rights",
    consent_rights_p:      "You have the right to access or delete your data at any time using the session token you will receive after completing this assessment.",
    consent_voluntary_h:   "Voluntary participation",
    consent_voluntary_p:   "Participation is entirely voluntary. You may exit at any time without any consequence.",
    consent_wellbeing_notice: "If your results suggest elevated stress or low wellbeing, we encourage you to speak with a healthcare professional or your Employee Assistance Programme (EAP).",
    consent_checkbox:      "I have read and understood the information above. I consent to my anonymous responses being collected, stored, and used as described.",
    consent_cta:           "I Agree — Begin Assessment",
    consent_must_agree:    "Please check the box above to give your consent before proceeding.",

    // ── Department selector ───────────────────────────────
    dept_title:       "Which department do you work in?",
    dept_subtitle:    "This helps compare results across teams. Department results are only shown when 5 or more people in a department respond.",
    dept_placeholder: "Select your department…",
    dept_skip:        "Prefer not to say",
    dept_cta:         "Continue",

    // ── Assessment form ───────────────────────────────────
    form_intro:        "Answer honestly — there are no right or wrong answers.",
    form_required:     "All questions are required.",
    form_submitting:   "Analysing your responses…",
    form_error_load:   "Failed to load the assessment. Please refresh and try again.",

    // ── Results screen ────────────────────────────────────
    results_title:       "Your Results",
    results_submitted:   "Submitted successfully",
    results_overall:     "Overall Score",
    results_subscales:   "Subscale Breakdown",
    results_dimensions:  "Culture Dimensions",
    results_comparison:  "How you compare",
    results_org_avg:     "Organisation average",
    results_dept_avg:    "Your department average",
    results_my_score:    "Your score",
    results_disclaimer:  "These results are for personal awareness only and do not constitute medical advice. Scores are based on your self-report at the time of completion.",

    results_token_title:   "Save your session token",
    results_token_desc:    "Keep this token to access or delete your data at any time.",
    results_access_data:   "Access my data",
    results_delete_data:   "Delete my data",

    // Band labels
    band_low:           "Low",
    band_moderate:      "Moderate",
    band_high:          "High",
    band_below_avg:     "Below Average",
    band_good:          "Good",
    band_needs_attn:    "Needs Attention",
    band_developing:    "Developing",
    band_healthy:       "Healthy",
    band_thriving:      "Thriving",

    // Band guidance (shown under score)
    guidance_burnout_low:      "Your burnout levels are low. Keep nurturing healthy work habits and boundaries.",
    guidance_burnout_moderate: "Some burnout indicators are present. Consider reviewing your workload and recovery habits.",
    guidance_burnout_high:     "Your burnout levels are elevated. We strongly encourage you to speak with a healthcare professional.",
    guidance_stress_low:       "Your stress levels are low. You appear to be managing pressures effectively.",
    guidance_stress_moderate:  "Moderate stress detected. Stress-management strategies and regular breaks may help.",
    guidance_stress_high:      "High stress levels detected. Please consider speaking with a healthcare professional or using your EAP.",
    guidance_who5_good:        "Your wellbeing is in a good range. Keep nurturing your mental health.",
    guidance_who5_moderate:    "Your wellbeing score is moderate. Small positive changes in routine can make a meaningful difference.",
    guidance_who5_below_avg:   "Your wellbeing is below average. We encourage you to speak with someone you trust.",
    guidance_who5_low:         "Your score suggests possible depression. Please consult a healthcare professional.",
    guidance_culture_thriving:      "Exceptional — this is a real organisational strength.",
    guidance_culture_healthy:       "Solid foundations here. Keep building on these strengths.",
    guidance_culture_developing:    "Progress is visible, but meaningful gaps remain.",
    guidance_culture_needs_attn:    "This area needs focused attention and investment.",

    // ── Print / PDF ───────────────────────────────────────
    print_title:  "My Sawa Assessment Results",
    print_date:   "Assessment date",
    print_org:    "Organisation",

    // ── Executive Dashboard ───────────────────────────────
    exec_title:           "Executive Dashboard",
    exec_welcome:         "Welcome back",
    exec_sign_out:        "Sign out",
    exec_new_cycle:       "+ New Cycle",

    stat_total_cycles:    "Total Cycles",
    stat_active_cycles:   "Active Cycles",
    stat_respondents:     "Total Respondents",
    stat_avg_score:       "Avg Score",

    section_scores:       "Organisation Scores",
    section_trend:        "Score Trend",
    section_departments:  "Department Breakdown",
    section_participation:"Participation",
    section_cycles:       "Assessment Cycles",

    cycle_prompt:         "Select a cycle to view detailed results",
    cycle_no_cycles:      "No assessment cycles yet.",
    cycle_create_first:   "Create your first cycle to get started.",

    risk_title:           "Score Drop Detected",
    risk_desc_pre:        "Overall score fell by",
    risk_desc_post:       "points compared to the previous cycle.",

    trend_no_data:        "Not enough cycles to display a trend.",
    trend_score:          "Avg Score",

    dept_col_dept:        "Department",
    dept_col_n:           "Respondents",
    dept_col_score:       "Score",
    dept_col_band:        "Band",
    dept_suppressed:      "Departments with fewer than 5 respondents are hidden to protect anonymity.",
    dept_no_data:         "No departments with 5+ respondents yet.",

    part_rate:            "Completion Rate",
    part_submitted:       "Submitted",
    part_started:         "Started",
    part_by_dept:         "By Department",
    part_meets_min:       "Meets threshold (5+)",

    cycle_col_title:      "Title",
    cycle_col_type:       "Type",
    cycle_col_status:     "Status",
    cycle_col_n:          "Respondents",
    cycle_col_closes:     "Closes",
    cycle_view:           "View",

    no_submissions:       "No submissions yet for this cycle.",
    loading_results:      "Loading results…",
    overall_score:        "Overall Score",
    subscales_title:      "Subscale Breakdown",
  },

  ar: {
    // ── Language toggle ──────────────────────────────────
    switchLang: "English",

    // ── General ──────────────────────────────────────────
    loading:         "جارٍ تحميل التقييم…",
    poweredBy:       "مدعوم من سواء",
    close:           "إغلاق",
    download:        "تنزيل نتائجي",
    copy:            "نسخ",
    copied:          "تم النسخ!",
    backToStart:     "العودة للبداية",

    // ── Errors ────────────────────────────────────────────
    error_title:       "التقييم غير متاح",
    error_not_found:   "لم يُعثر على رابط التقييم هذا.",
    error_expired:     "انتهت صلاحية هذا التقييم.",
    error_inactive:    "لم يعد هذا التقييم نشطاً.",
    error_network:     "خطأ في الشبكة. يُرجى التحقق من اتصالك والمحاولة مجدداً.",
    error_submit:      "فشل الإرسال. يُرجى المحاولة مجدداً.",
    error_generic:     "حدث خطأ ما. يُرجى تحديث الصفحة.",

    // ── Step indicator ────────────────────────────────────
    step_consent:     "الموافقة",
    step_assessment:  "التقييم",
    step_results:     "النتائج",

    // ── Consent screen ────────────────────────────────────
    consent_title:         "قبل أن تبدأ",
    consent_subtitle:      "يُرجى قراءة ما يلي بعناية قبل المتابعة.",
    consent_anonymous_h:   "مجهول الهوية وسري",
    consent_anonymous_p:   "ردودك مجهولة الهوية تماماً ولا يمكن ربطها بك شخصياً.",
    consent_usage_h:       "كيف تُستخدم بياناتك",
    consent_usage_p:       "تُعرض النتائج على مؤسستك كإحصاءات جماعية فقط. لا تُشارَك النتائج الفردية مطلقاً مع صاحب العمل.",
    consent_retention_h:   "مدة الاحتفاظ بالبيانات",
    consent_retention_p:   "تُخزَّن بياناتك بأمان لمدة تصل إلى 5 سنوات وفقاً لقوانين حماية البيانات المعمول بها، ثم تُحذف تلقائياً.",
    consent_rights_h:      "حقوقك",
    consent_rights_p:      "يحق لك الوصول إلى بياناتك أو حذفها في أي وقت باستخدام رمز الجلسة الذي ستتلقاه بعد إكمال هذا التقييم.",
    consent_voluntary_h:   "المشاركة طوعية",
    consent_voluntary_p:   "المشاركة طوعية تماماً. يمكنك الخروج في أي وقت دون أي عواقب.",
    consent_wellbeing_notice: "إذا أشارت نتائجك إلى مستويات مرتفعة من التوتر أو انخفاض في الرفاهية، فإننا نشجعك على التحدث مع متخصص في الرعاية الصحية أو برنامج دعم الموظفين.",
    consent_checkbox:      "لقد قرأت المعلومات أعلاه وفهمتها. أوافق على جمع ردودي المجهولة وتخزينها واستخدامها على النحو الموصوف.",
    consent_cta:           "أوافق — ابدأ التقييم",
    consent_must_agree:    "يُرجى تحديد المربع أعلاه لإعطاء موافقتك قبل المتابعة.",

    // ── Department selector ───────────────────────────────
    dept_title:       "في أي قسم تعمل؟",
    dept_subtitle:    "يساعد هذا على مقارنة النتائج بين الفرق. تُعرض نتائج الأقسام فقط عند مشاركة 5 أشخاص أو أكثر من نفس القسم.",
    dept_placeholder: "اختر قسمك…",
    dept_skip:        "أفضّل عدم الإفصاح",
    dept_cta:         "متابعة",

    // ── Assessment form ───────────────────────────────────
    form_intro:        "أجب بصدق — لا توجد إجابات صحيحة أو خاطئة.",
    form_required:     "جميع الأسئلة مطلوبة.",
    form_submitting:   "جارٍ تحليل ردودك…",
    form_error_load:   "فشل تحميل التقييم. يُرجى تحديث الصفحة والمحاولة مجدداً.",

    // ── Results screen ────────────────────────────────────
    results_title:       "نتائجك",
    results_submitted:   "تم الإرسال بنجاح",
    results_overall:     "النتيجة الإجمالية",
    results_subscales:   "تفاصيل المقاييس الفرعية",
    results_dimensions:  "أبعاد الثقافة",
    results_comparison:  "مقارنة نتائجك",
    results_org_avg:     "متوسط المؤسسة",
    results_dept_avg:    "متوسط قسمك",
    results_my_score:    "نتيجتك",
    results_disclaimer:  "هذه النتائج للتوعية الشخصية فقط ولا تُعدّ نصيحة طبية. تستند الدرجات إلى تقريرك الذاتي وقت الإجابة.",

    results_token_title:   "احفظ رمز جلستك",
    results_token_desc:    "احتفظ بهذا الرمز للوصول إلى بياناتك أو حذفها في أي وقت.",
    results_access_data:   "الوصول إلى بياناتي",
    results_delete_data:   "حذف بياناتي",

    // Band labels
    band_low:           "منخفض",
    band_moderate:      "متوسط",
    band_high:          "مرتفع",
    band_below_avg:     "دون المتوسط",
    band_good:          "جيد",
    band_needs_attn:    "يحتاج اهتماماً",
    band_developing:    "في طور النمو",
    band_healthy:       "صحي",
    band_thriving:      "متميز",

    // Band guidance
    guidance_burnout_low:      "مستوى الاحتراق الوظيفي لديك منخفض. واصل العناية بعاداتك الصحية في العمل.",
    guidance_burnout_moderate: "تظهر بعض مؤشرات الاحتراق الوظيفي. يُنصح بمراجعة عبء العمل وعادات الاسترداد.",
    guidance_burnout_high:     "مستوى الاحتراق الوظيفي لديك مرتفع. نشجعك بشدة على التحدث مع متخصص في الرعاية الصحية.",
    guidance_stress_low:       "مستوى التوتر لديك منخفض. يبدو أنك تتعامل مع الضغوط بفعالية.",
    guidance_stress_moderate:  "تم رصد توتر متوسط. قد تساعد استراتيجيات إدارة التوتر والاستراحات المنتظمة.",
    guidance_stress_high:      "تم رصد مستويات توتر مرتفعة. يُرجى التفكير في التحدث مع متخصص أو استخدام برنامج دعم الموظفين.",
    guidance_who5_good:        "مستوى رفاهيتك في نطاق جيد. واصل الاهتمام بصحتك النفسية.",
    guidance_who5_moderate:    "درجة رفاهيتك متوسطة. يمكن أن تُحدث التغييرات الإيجابية الصغيرة في الروتين فرقاً ملموساً.",
    guidance_who5_below_avg:   "مستوى رفاهيتك دون المتوسط. نشجعك على التحدث مع شخص تثق به.",
    guidance_who5_low:         "تشير درجتك إلى احتمال الإصابة بالاكتئاب. يُرجى استشارة متخصص في الرعاية الصحية.",
    guidance_culture_thriving:      "استثنائي — هذه قوة حقيقية للمؤسسة.",
    guidance_culture_healthy:       "أسس متينة هنا. واصل البناء على هذه النقاط القوية.",
    guidance_culture_developing:    "يظهر تقدم ملموس، لكن ثمة فجوات جوهرية لا تزال قائمة.",
    guidance_culture_needs_attn:    "هذا المجال يحتاج إلى اهتمام واستثمار مركّز.",

    // ── Print / PDF ───────────────────────────────────────
    print_title:  "نتائج تقييم سواء",
    print_date:   "تاريخ التقييم",
    print_org:    "المؤسسة",

    // ── Executive Dashboard ───────────────────────────────
    exec_title:           "لوحة القيادة التنفيذية",
    exec_welcome:         "مرحباً بعودتك",
    exec_sign_out:        "تسجيل الخروج",
    exec_new_cycle:       "+ دورة جديدة",

    stat_total_cycles:    "إجمالي الدورات",
    stat_active_cycles:   "الدورات النشطة",
    stat_respondents:     "إجمالي المشاركين",
    stat_avg_score:       "متوسط الدرجات",

    section_scores:       "درجات المؤسسة",
    section_trend:        "مؤشر الاتجاه",
    section_departments:  "تفصيل الأقسام",
    section_participation:"نسبة المشاركة",
    section_cycles:       "دورات التقييم",

    cycle_prompt:         "اختر دورة لعرض النتائج التفصيلية",
    cycle_no_cycles:      "لا توجد دورات تقييم بعد.",
    cycle_create_first:   "أنشئ دورتك الأولى للبدء.",

    risk_title:           "تحذير: انخفاض في الدرجات",
    risk_desc_pre:        "انخفضت الدرجة الإجمالية بمقدار",
    risk_desc_post:       "نقطة مقارنةً بالدورة السابقة.",

    trend_no_data:        "لا توجد دورات كافية لعرض مؤشر الاتجاه.",
    trend_score:          "متوسط الدرجة",

    dept_col_dept:        "القسم",
    dept_col_n:           "المشاركون",
    dept_col_score:       "الدرجة",
    dept_col_band:        "المستوى",
    dept_suppressed:      "الأقسام التي يقل عدد مشاركيها عن 5 مخفية حفاظاً على السرية.",
    dept_no_data:         "لا توجد أقسام بـ 5 مشاركين أو أكثر حتى الآن.",

    part_rate:            "نسبة الإكمال",
    part_submitted:       "أكملوا التقييم",
    part_started:         "بدأوا التقييم",
    part_by_dept:         "حسب القسم",
    part_meets_min:       "يستوفي الحد الأدنى (5+)",

    cycle_col_title:      "العنوان",
    cycle_col_type:       "النوع",
    cycle_col_status:     "الحالة",
    cycle_col_n:          "المشاركون",
    cycle_col_closes:     "ينتهي",
    cycle_view:           "عرض",

    no_submissions:       "لا توجد إرسالات لهذه الدورة بعد.",
    loading_results:      "جارٍ تحميل النتائج…",
    overall_score:        "الدرجة الإجمالية",
    subscales_title:      "تفاصيل المقاييس الفرعية",
  },
} as const;

export type TranslationKey = keyof typeof ui.en;

export function useTranslations(lang: Lang) {
  return (key: TranslationKey): string => {
    return (ui[lang] as any)[key] ?? (ui.en as any)[key] ?? key;
  };
}

/** Translate a band label key into the current language. */
export function translateBand(band: string, lang: Lang): string {
  const map: Record<string, TranslationKey> = {
    Low:             "band_low",
    Moderate:        "band_moderate",
    High:            "band_high",
    "Below Average": "band_below_avg",
    Good:            "band_good",
    "Needs Attention": "band_needs_attn",
    Developing:      "band_developing",
    Healthy:         "band_healthy",
    Thriving:        "band_thriving",
  };
  const key = map[band];
  if (!key) return band;
  return (ui[lang] as any)[key] ?? band;
}
