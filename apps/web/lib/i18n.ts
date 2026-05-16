/**
 * Mindlign Platform — UI Translations
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
    poweredBy:       "Powered by Mindlign",
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

    // ── Demographic screen ────────────────────────────────
    demog_title:      "A few optional questions",
    demog_subtitle:   "These anonymous details help us provide more meaningful insights. All questions are optional — skip any you prefer not to answer.",
    demog_skip_all:   "Skip all",
    demog_cta:        "Continue",

    demog_q1_label:   "Are you a Saudi national?",
    demog_q1_yes:     "Yes",
    demog_q1_no:      "No",
    demog_q1_skip:    "Prefer not to say",

    demog_q2_label:   "How long have you worked at this organisation?",
    demog_q2_under1:  "Less than 1 year",
    demog_q2_one3:    "1–3 years",
    demog_q2_three7:  "3–7 years",
    demog_q2_over7:   "More than 7 years",
    demog_q2_skip:    "Prefer not to say",

    demog_q3_label:   "Which best describes your role?",
    demog_q3_ic:      "Individual Contributor",
    demog_q3_mgr:     "Manager / Team Lead",
    demog_q3_skip:    "Prefer not to say",

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

    // ── Demographic split (dashboard) ────────────────────
    demog_tab:              "Demographic Split",
    demog_section_subtitle: "Anonymous demographic breakdowns",
    demog_nationality_tab:  "Nationality",
    demog_tenure_tab:      "Tenure",
    demog_seniority_tab:   "Seniority",

    demog_kpi_saudi_score:      "Saudi Score",
    demog_kpi_nonsaudi_score:   "Non-Saudi Score",
    demog_kpi_gap:              "Engagement Gap",
    demog_kpi_gap_note:         "Saudi vs Non-Saudi",
    demog_kpi_saudization:      "Saudization Rate",
    demog_kpi_saudization_note: "of respondents",

    demog_insufficient:      "Insufficient data",
    demog_insufficient_note: "< 5 respondents in this segment",

    demog_flag_title:        "Equity Alert",
    demog_flag_lower_pre:    "Saudi nationals score",
    demog_flag_lower_post:   "pts lower than non-Saudi peers in",
    demog_flag_higher_pre:   "Saudi nationals score",
    demog_flag_higher_post:  "pts higher than non-Saudi peers in",

    demog_saudi:             "Saudi National",
    demog_nonsaudi:          "Non-Saudi",
    demog_org_level:         "Organisation-Level",
    demog_dept_level:        "By Department",
    demog_no_data:           "No demographic data collected yet for this cycle.",

    demog_insight_new_joiner_high: "New joiners showing significantly higher scores — possible onboarding gap",
    demog_insight_new_joiner_low:  "New joiners scoring significantly lower than long-tenured peers — possible onboarding gap",
    demog_insight_ic_worse:        "Workload may be concentrated at individual contributor level",
    demog_insight_mgr_worse:       "Leadership layer showing strain — monitor closely",

    // ── Print / PDF ───────────────────────────────────────
    print_title:  "My Mindlign Assessment Results",
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

    // ── Admin Panel ───────────────────────────────────────
    admin_title:          "Platform Admin",
    admin_dashboard:      "Dashboard",
    admin_clients:        "Clients",
    admin_audit:          "Audit Log",
    admin_sign_out:       "Sign out",

    // Admin dashboard stats
    admin_stat_orgs:      "Organisations",
    admin_stat_active:    "Active Cycles",
    admin_stat_respondents: "Total Respondents",
    admin_recent_activity: "Recent Activity",

    // Client list
    admin_clients_title:  "All Clients",
    admin_new_client:     "New Client",
    admin_col_client:     "Client",
    admin_col_industry:   "Industry",
    admin_col_users:      "Users",
    admin_col_cycles:     "Cycles",
    admin_col_participation: "Latest Participation",
    admin_col_frequency:  "Frequency",
    admin_no_clients:     "No clients yet. Add your first one.",
    admin_view:           "Manage",

    // Frequency labels
    freq_adhoc:           "Ad-hoc",
    freq_weekly:          "Weekly",
    freq_monthly:         "Monthly",
    freq_quarterly:       "Quarterly",

    // New client onboarding
    admin_onboard_title:  "Onboard New Client",
    admin_section_org:    "Organisation Details",
    admin_section_freq:   "Assessment Frequency",
    admin_section_contact: "Primary HR Contact",
    admin_field_name_en:  "Name (English)",
    admin_field_name_ar:  "Name (Arabic)",
    admin_field_slug:     "URL Slug",
    admin_field_industry: "Industry",
    admin_field_size:     "Size Range",
    admin_field_freq:     "Cycle Frequency",
    admin_field_fname:    "First Name",
    admin_field_lname:    "Last Name",
    admin_field_email:    "Email",
    admin_field_password: "Temporary Password",
    admin_create_btn:     "Create Client",
    admin_creating:       "Creating…",
    admin_slug_hint:      "Lowercase letters, numbers and hyphens only",
    admin_freq_hint:      "How often assessment cycles should run for this client",

    // Client detail tabs
    admin_tab_cycles:     "Cycles",
    admin_tab_contacts:   "Contacts",
    admin_tab_settings:   "Settings",
    admin_back_clients:   "Back to Clients",

    // Cycle management
    admin_new_cycle:      "New Cycle",
    admin_cycle_type:     "Assessment Type",
    admin_cycle_title_f:  "Cycle Title",
    admin_cycle_starts:   "Start Date",
    admin_cycle_ends:     "End Date",
    admin_cycle_emails:   "Employee Emails",
    admin_cycle_emails_hint: "One email address per line. These are stored for automated reminders.",
    admin_no_cycles:      "No cycles yet for this client.",
    admin_create_cycle:   "Create Cycle",
    admin_creating_cycle: "Creating…",

    // Cycle action buttons
    admin_act_activate:   "Activate",
    admin_act_remind:     "Send Reminder",
    admin_act_close:      "Close Cycle",
    admin_act_publish:    "Publish Results",
    admin_act_remind_confirm: "Send reminder to all stored email addresses?",
    admin_act_close_confirm:  "Close this cycle? This cannot be undone.",
    admin_respondents_label:  "respondents",

    // Contacts
    admin_add_contact:    "Add Contact",
    admin_no_contacts:    "No HR contacts for this client yet.",
    admin_contact_remove: "Remove",
    admin_contact_role:   "Role",
    admin_last_login:     "Last login",
    admin_never:          "Never",
    admin_adding:         "Adding…",

    // Settings tab
    admin_settings_title: "Organisation Settings",
    admin_save:           "Save Changes",
    admin_saving:         "Saving…",
    admin_saved:          "Saved!",

    // General admin
    admin_loading:        "Loading…",
    admin_error:          "Something went wrong. Please try again.",
    admin_confirm:        "Confirm",
    admin_cancel:         "Cancel",
  },

  ar: {
    // ── Language toggle ──────────────────────────────────
    switchLang: "English",

    // ── General ──────────────────────────────────────────
    loading:         "جارٍ تحميل التقييم…",
    poweredBy:       "مدعوم من Mindlign",
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

    // ── Demographic screen ────────────────────────────────
    demog_title:      "بعض الأسئلة الاختيارية",
    demog_subtitle:   "تساعدنا هذه التفاصيل المجهولة على تقديم رؤى أكثر معنى. جميع الأسئلة اختيارية — تخطَّ أيًّا منها إذا كنت لا ترغب في الإجابة.",
    demog_skip_all:   "تخطّي الجميع",
    demog_cta:        "متابعة",

    demog_q1_label:   "هل أنت مواطن سعودي؟",
    demog_q1_yes:     "نعم",
    demog_q1_no:      "لا",
    demog_q1_skip:    "أفضّل عدم الإفصاح",

    demog_q2_label:   "كم من الوقت أمضيتَ في هذه المنظمة؟",
    demog_q2_under1:  "أقل من سنة",
    demog_q2_one3:    "من 1 إلى 3 سنوات",
    demog_q2_three7:  "من 3 إلى 7 سنوات",
    demog_q2_over7:   "أكثر من 7 سنوات",
    demog_q2_skip:    "أفضّل عدم الإفصاح",

    demog_q3_label:   "ما الذي يصف دورك بشكل أفضل؟",
    demog_q3_ic:      "مساهم فردي",
    demog_q3_mgr:     "مدير / قائد فريق",
    demog_q3_skip:    "أفضّل عدم الإفصاح",

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

    // ── Demographic split (dashboard) ────────────────────
    demog_tab:              "التوزيع الديموغرافي",
    demog_section_subtitle: "تفصيل ديموغرافي مجهول الهوية",
    demog_nationality_tab:  "الجنسية",
    demog_tenure_tab:      "مدة الخدمة",
    demog_seniority_tab:   "المستوى الوظيفي",

    demog_kpi_saudi_score:      "درجة السعوديين",
    demog_kpi_nonsaudi_score:   "درجة غير السعوديين",
    demog_kpi_gap:              "فجوة المشاركة",
    demog_kpi_gap_note:         "سعودي مقابل غير سعودي",
    demog_kpi_saudization:      "نسبة السعودة",
    demog_kpi_saudization_note: "من المشاركين",

    demog_insufficient:      "بيانات غير كافية",
    demog_insufficient_note: "أقل من 5 مشاركين في هذه الشريحة",

    demog_flag_title:        "تنبيه عدالة",
    demog_flag_lower_pre:    "المواطنون السعوديون يسجّلون",
    demog_flag_lower_post:   "نقطة أقل من نظرائهم غير السعوديين في",
    demog_flag_higher_pre:   "المواطنون السعوديون يسجّلون",
    demog_flag_higher_post:  "نقطة أعلى من نظرائهم غير السعوديين في",

    demog_saudi:             "مواطن سعودي",
    demog_nonsaudi:          "غير سعودي",
    demog_org_level:         "على مستوى المنظمة",
    demog_dept_level:        "حسب القسم",
    demog_no_data:           "لم يتم جمع بيانات ديموغرافية لهذه الدورة بعد.",

    demog_insight_new_joiner_high: "المنتسبون الجدد يُظهرون درجات أعلى بشكل ملحوظ — ثغرة محتملة في الإعداد الوظيفي",
    demog_insight_new_joiner_low:  "المنتسبون الجدد يسجلون درجات أقل بكثير من زملائهم الأكثر خبرة — ثغرة محتملة في الإعداد الوظيفي",
    demog_insight_ic_worse:        "قد يكون عبء العمل مركّزاً على مستوى المساهمين الأفراد",
    demog_insight_mgr_worse:       "الطبقة القيادية تُظهر ضغطاً — يُنصح بالمتابعة الدقيقة",

    // ── Print / PDF ───────────────────────────────────────
    print_title:  "نتائج تقييم Mindlign",
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

    // ── Admin Panel ───────────────────────────────────────
    admin_title:          "إدارة المنصة",
    admin_dashboard:      "لوحة التحكم",
    admin_clients:        "العملاء",
    admin_audit:          "سجل التدقيق",
    admin_sign_out:       "تسجيل الخروج",

    admin_stat_orgs:      "المؤسسات",
    admin_stat_active:    "الدورات النشطة",
    admin_stat_respondents: "إجمالي المشاركين",
    admin_recent_activity: "النشاط الأخير",

    admin_clients_title:  "جميع العملاء",
    admin_new_client:     "عميل جديد",
    admin_col_client:     "العميل",
    admin_col_industry:   "الصناعة",
    admin_col_users:      "المستخدمون",
    admin_col_cycles:     "الدورات",
    admin_col_participation: "آخر مشاركة",
    admin_col_frequency:  "التكرار",
    admin_no_clients:     "لا يوجد عملاء بعد. أضف العميل الأول.",
    admin_view:           "إدارة",

    freq_adhoc:           "عند الطلب",
    freq_weekly:          "أسبوعي",
    freq_monthly:         "شهري",
    freq_quarterly:       "ربع سنوي",

    admin_onboard_title:  "إضافة عميل جديد",
    admin_section_org:    "تفاصيل المؤسسة",
    admin_section_freq:   "تكرار التقييم",
    admin_section_contact: "جهة اتصال HR الرئيسية",
    admin_field_name_en:  "الاسم (إنجليزي)",
    admin_field_name_ar:  "الاسم (عربي)",
    admin_field_slug:     "معرّف الرابط",
    admin_field_industry: "الصناعة",
    admin_field_size:     "حجم المؤسسة",
    admin_field_freq:     "تكرار الدورة",
    admin_field_fname:    "الاسم الأول",
    admin_field_lname:    "اسم العائلة",
    admin_field_email:    "البريد الإلكتروني",
    admin_field_password: "كلمة مرور مؤقتة",
    admin_create_btn:     "إنشاء العميل",
    admin_creating:       "جارٍ الإنشاء…",
    admin_slug_hint:      "أحرف صغيرة وأرقام وشرطات فقط",
    admin_freq_hint:      "عدد الأيام بين الدورات لهذا العميل",

    admin_tab_cycles:     "الدورات",
    admin_tab_contacts:   "جهات الاتصال",
    admin_tab_settings:   "الإعدادات",
    admin_back_clients:   "العودة للعملاء",

    admin_new_cycle:      "دورة جديدة",
    admin_cycle_type:     "نوع التقييم",
    admin_cycle_title_f:  "عنوان الدورة",
    admin_cycle_starts:   "تاريخ البدء",
    admin_cycle_ends:     "تاريخ الانتهاء",
    admin_cycle_emails:   "بريد الموظفين",
    admin_cycle_emails_hint: "بريد إلكتروني واحد في كل سطر. تُخزَّن لإرسال التذكيرات تلقائياً.",
    admin_no_cycles:      "لا توجد دورات لهذا العميل بعد.",
    admin_create_cycle:   "إنشاء الدورة",
    admin_creating_cycle: "جارٍ الإنشاء…",

    admin_act_activate:   "تفعيل",
    admin_act_remind:     "إرسال تذكير",
    admin_act_close:      "إغلاق الدورة",
    admin_act_publish:    "نشر النتائج",
    admin_act_remind_confirm: "إرسال تذكير لجميع عناوين البريد المخزّنة؟",
    admin_act_close_confirm:  "إغلاق هذه الدورة؟ لا يمكن التراجع عن هذا.",
    admin_respondents_label:  "مشارك",

    admin_add_contact:    "إضافة جهة اتصال",
    admin_no_contacts:    "لا توجد جهات اتصال HR لهذا العميل بعد.",
    admin_contact_remove: "إزالة",
    admin_contact_role:   "الدور",
    admin_last_login:     "آخر تسجيل دخول",
    admin_never:          "لم يسجّل بعد",
    admin_adding:         "جارٍ الإضافة…",

    admin_settings_title: "إعدادات المؤسسة",
    admin_save:           "حفظ التغييرات",
    admin_saving:         "جارٍ الحفظ…",
    admin_saved:          "تم الحفظ!",

    admin_loading:        "جارٍ التحميل…",
    admin_error:          "حدث خطأ ما. يُرجى المحاولة مجدداً.",
    admin_confirm:        "تأكيد",
    admin_cancel:         "إلغاء",
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
