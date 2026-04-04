/**
 * Arabic Survey Translations
 * ===========================
 * Transforms an English SurveyJS schema into a bilingual schema where
 * every title/description is { default: "English", ar: "Arabic" }.
 * Set survey.locale = "ar" to switch the rendered language.
 */

// ─── Shared choice text translations ─────────────────────────────────────────

const CHOICE_TEXT: Record<string, string> = {
  // CBI frequency
  "Always":                  "دائماً",
  "Often":                   "غالباً",
  "Sometimes":               "أحياناً",
  "Seldom":                  "نادراً",
  "Never / Almost never":    "أبداً / نادراً جداً",
  // CBI degree
  "To a very high degree":   "بدرجة عالية جداً",
  "To a high degree":        "بدرجة عالية",
  "Somewhat":                "إلى حدٍّ ما",
  "To a low degree":         "بدرجة منخفضة",
  "To a very low degree":    "بدرجة منخفضة جداً",
  // PSS
  "Never":                   "أبداً",
  "Almost Never":            "نادراً جداً",
  "Fairly Often":            "كثيراً",
  "Very Often":              "كثيراً جداً",
  // WHO-5
  "All of the time":              "طوال الوقت",
  "Most of the time":             "معظم الوقت",
  "More than half of the time":   "أكثر من نصف الوقت",
  "Less than half of the time":   "أقل من نصف الوقت",
  "Some of the time":             "بعض الوقت",
  "At no time":                   "لا شيء من الوقت",
  // Culture (Likert)
  "Strongly Disagree":  "لا أوافق بشدة",
  "Disagree":           "لا أوافق",
  "Neutral":            "محايد",
  "Agree":              "أوافق",
  "Strongly Agree":     "أوافق بشدة",
};

// ─── Survey-level titles ──────────────────────────────────────────────────────

const SURVEY_TITLES: Record<string, { title: string; description: string }> = {
  CBI: {
    title: "مقياس كوبنهاغن للاحتراق الوظيفي",
    description: "تسأل الأسئلة التالية عن مشاعرك مؤخراً. يُرجى اختيار الإجابة التي تصف تجربتك بشكل أدق.",
  },
  PSS: {
    title: "مقياس الضغط النفسي المُدرَك",
    description: "تسأل الأسئلة التالية عن مشاعرك وأفكارك خلال الشهر الماضي. في كل حالة، يُرجى الإشارة إلى مدى شعورك بذلك.",
  },
  WHO5: {
    title: "مؤشر الرفاهية WHO-5",
    description: "يُرجى الإشارة لكل عبارة إلى أيها يصف مشاعرك خلال الأسبوعين الماضيين بشكل أدق. الأرقام الأعلى تعني رفاهية أفضل.",
  },
  CULTURE: {
    title: "تقييم ثقافة سواء",
    description: "يقيس هذا التقييم تسعة أبعاد لثقافة مكان عملك. يُرجى تقييم كل عبارة بناءً على تجربتك الفعلية في العمل — وليس كيف تعتقد أن الأمور ينبغي أن تكون.",
  },
};

// ─── Page titles ──────────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, { title: string; description?: string }> = {
  // CBI
  personal_burnout: {
    title: "الإرهاق الشخصي",
    description: "تتعلق هذه الأسئلة بشعورك العام.",
  },
  work_burnout: {
    title: "الإرهاق المرتبط بالعمل",
    description: "تتعلق هذه الأسئلة بعملك وكيف تشعر تجاهه.",
  },
  client_burnout: {
    title: "الإرهاق المرتبط بالعملاء",
    description: "تتعلق هذه الأسئلة بعملك مع الأشخاص الذين تتفاعل معهم مهنياً.",
  },
  // PSS
  pss: { title: "خلال الشهر الماضي، كم مرة…" },
  // WHO-5
  who5: { title: "خلال الأسبوعين الماضيين…" },
  // Culture
  leadership:           { title: "فاعلية القيادة",         description: "قيّم العبارات المتعلقة بالقيادة في مؤسستك." },
  communication:        { title: "التواصل والشفافية",       description: "قيّم مدى انسياب المعلومات بشكل منفتح وفعّال." },
  innovation:           { title: "الابتكار والرشاقة",       description: "قيّم كيف تتعامل مؤسستك مع الأفكار الجديدة والتغيير." },
  psychological_safety: { title: "السلامة النفسية",         description: "قيّم مدى شعورك بالأمان للتعبير عن نفسك في العمل." },
  inclusion:            { title: "الشمول والانتماء",        description: "قيّم مدى شعورك بالاندماج والترحيب في مكان عملك." },
  growth:               { title: "النمو والتطوير",          description: "قيّم فرص التعلم والتطوير الوظيفي المتاحة لك." },
  work_life_balance:    { title: "التوازن بين العمل والحياة", description: "قيّم مدى دعم مؤسستك للتوازن الصحي بين العمل والحياة." },
  recognition:          { title: "التقدير والمكافأة",       description: "قيّم مدى الاعتراف بالعمل الجيد بعدالة واتساق." },
  collaboration:        { title: "التعاون والعمل الجماعي",  description: "قيّم مدى تعاون الناس في مؤسستك." },
};

// ─── Question titles ──────────────────────────────────────────────────────────

const QUESTION_TITLES: Record<string, string> = {
  // CBI — Personal burnout
  cbi_1:  "كم مرة تشعر بالتعب؟",
  cbi_2:  "كم مرة تشعر بالإرهاق الجسدي؟",
  cbi_3:  "كم مرة تشعر بالإرهاق العاطفي؟",
  cbi_4:  'كم مرة تفكر "لم أعد أستطيع الاستمرار"؟',
  cbi_5:  "كم مرة تشعر بالإنهاك؟",
  cbi_6:  "كم مرة تشعر بالضعف والهشاشة تجاه المرض؟",
  // CBI — Work burnout
  cbi_7:  "هل عملك مُرهِق عاطفياً؟",
  cbi_8:  "هل تشعر بالاحتراق الوظيفي بسبب عملك؟",
  cbi_9:  "هل يُسبّب لك عملك الإحباط؟",
  cbi_10: "هل تشعر بالإرهاق في نهاية يوم العمل؟",
  cbi_11: "هل تشعر بالإرهاق في الصباح لمجرد التفكير في يوم عمل جديد؟",
  cbi_12: "هل تشعر أن كل ساعة عمل تُرهقك؟",
  cbi_13: "هل لديك طاقة كافية للعائلة والأصدقاء في أوقات الفراغ؟",
  // CBI — Client burnout
  cbi_14: "هل تجد صعوبة في التعامل مع العملاء؟",
  cbi_15: "هل يستنزف العمل مع العملاء طاقتك؟",
  cbi_16: "هل يُحبطك التعامل مع العملاء؟",
  cbi_17: "هل تشعر أنك تعطي أكثر مما تأخذ عند التعامل مع العملاء؟",
  cbi_18: "هل أنت متعب من العمل مع العملاء؟",
  cbi_19: "هل تتساءل أحياناً عن المدة التي ستتمكن فيها من مواصلة العمل مع العملاء؟",

  // PSS
  pss_1:  "…شعرت بالانزعاج بسبب حدث غير متوقع؟",
  pss_2:  "…شعرت أنك غير قادر على التحكم في الأمور المهمة في حياتك؟",
  pss_3:  "…شعرت بالتوتر والضغط؟",
  pss_4:  "…شعرت بالثقة في قدرتك على التعامل مع مشكلاتك الشخصية؟",
  pss_5:  "…شعرت أن الأمور تسير في صالحك؟",
  pss_6:  "…وجدت أنك غير قادر على التكيف مع كل ما يجب عليك فعله؟",
  pss_7:  "…تمكّنت من السيطرة على مشاعر الانزعاج في حياتك؟",
  pss_8:  "…شعرت أنك مسيطر على الأمور؟",
  pss_9:  "…شعرت بالغضب بسبب أمور خارجة عن إرادتك؟",
  pss_10: "…شعرت أن الصعوبات تتراكم لدرجة لا تستطيع معها التغلب عليها؟",

  // WHO-5
  who5_1: "شعرت بالبهجة والتفاؤل.",
  who5_2: "شعرت بالهدوء والاسترخاء.",
  who5_3: "شعرت بالنشاط والحيوية.",
  who5_4: "استيقظت شعوراً بالنشاط والانتعاش.",
  who5_5: "كانت حياتي اليومية مليئة بالأشياء التي تثير اهتمامي.",

  // Culture
  culture_1:  "يوفر مديري توجيهات وأهدافاً واضحة.",
  culture_2:  "تضع القيادة العليا رؤية مقنعة للمؤسسة.",
  culture_3:  "أثق في القرارات التي تتخذها قيادتنا.",
  culture_4:  "يقود القادة في هذه المؤسسة بالقدوة ويجسّدون القيم التي يروجون لها.",
  culture_5:  "يدعم مديري بنشاط نموي المهني وتطوري.",
  culture_6:  "تُشارَك المعلومات المهمة بشكل مفتوح عبر المؤسسة.",
  culture_7:  "أشعر أنني على اطلاع جيد بالتغييرات التي تؤثر على عملي.",
  culture_8:  "القيادة شفافة فيما يتعلق بالتحديات التي تواجهها المؤسسة.",
  culture_9:  "أشعر بالراحة في مشاركة آرائي وأفكاري مع فريقي.",
  culture_10: "لدينا قنوات فعّالة لتبادل التغذية الراجعة الصادقة.",
  culture_11: "تشجع هذه المؤسسة التفكير الإبداعي والأفكار الجديدة.",
  culture_12: "نتكيف بسرعة وفعالية عند تغير الظروف.",
  culture_13: "المخاطر المحسوبة مرحّب بها عند السعي إلى طرق عمل أفضل.",
  culture_14: "تُعامَل الأخطاء كفرص للتعلم لا كإخفاقات تستوجب العقاب.",
  culture_15: "أشعر بالأمان للتحدث عن المشكلات أو المخاوف دون خوف من الانتقام.",
  culture_16: "يمكنني ارتكاب الأخطاء دون خوف من العقاب غير العادل.",
  culture_17: "يشعر أعضاء الفريق بالراحة عند طلب المساعدة.",
  culture_18: "وجهات النظر والآراء المتنوعة مرحّب بها فعلاً في فريقي.",
  culture_19: "يمكنني إثارة موضوعات صعبة دون الإضرار بعلاقاتي في العمل.",
  culture_20: "أشعر أنني أنتمي حقاً إلى هذه المؤسسة.",
  culture_21: "يتمتع الأشخاص من جميع الخلفيات بفرص متساوية للنجاح هنا.",
  culture_22: "مساهماتي ذات قيمة بغض النظر عن خلفيتي أو هويتي.",
  culture_23: "أشعر بروح المجتمع الحقيقية والتواصل في العمل.",
  culture_24: "تعمل هذه المؤسسة بنشاط على ضمان شعور الجميع بالاندماج.",
  culture_25: "أتمتع بالوصول إلى موارد التعلم والتطوير التي أحتاجها للنمو.",
  culture_26: "أستطيع رؤية مسار واضح للتقدم الوظيفي في هذه المؤسسة.",
  culture_27: "يساعدني مديري بنشاط في تحديد مهارات جديدة وتطويرها.",
  culture_28: "تستثمر هذه المؤسسة استثماراً حقيقياً في تطوير الموظفين.",
  culture_29: "أستطيع الحفاظ على توازن صحي بين عملي وحياتي الشخصية.",
  culture_30: "حجم عملي مُدار ومستدام على المدى البعيد.",
  culture_31: "تحترم هذه المؤسسة وقتي وحدودي خارج ساعات العمل.",
  culture_32: "يمكنني أخذ فترات راحة وإجازات دون الشعور بالذنب أو العقاب.",
  culture_33: "أشعر بالتقدير والامتنان على العمل الذي أقوم به.",
  culture_34: "يُعترف بالأداء الجيد باستمرار في هذه المؤسسة.",
  culture_35: "تعويضاتنا ومزايانا عادلة مقارنةً بالمؤسسات المماثلة.",
  culture_36: "يُكافأ الأشخاص بناءً على الجدارة والمساهمة الفعلية.",
  culture_37: "تتعاون الفرق عبر المؤسسة بشكل جيد نحو أهداف مشتركة.",
  culture_38: "نتشارك المعرفة والموارد بحرية داخل فريقي.",
  culture_39: "هناك روح قوية من العمل الجماعي والدعم المتبادل في مكان عملي.",
  culture_40: "نحل النزاعات بطريقة بنّاءة ومحترمة.",
};

// ─── Transform function ───────────────────────────────────────────────────────

function bilingual(en: string, ar: string | undefined) {
  return ar ? { default: en, ar } : en;
}

/**
 * Takes a SurveyJS JSON schema (English) and returns an enhanced version
 * where all title/description/choice text fields are bilingual objects.
 * Call survey.locale = "ar" to display Arabic.
 */
export function makeBilingualSchema(
  schema: Record<string, any>,
  assessmentType: string
): Record<string, any> {
  const result = JSON.parse(JSON.stringify(schema)) as any;

  // Top-level survey title + description
  const surveyMeta = SURVEY_TITLES[assessmentType];
  if (surveyMeta) {
    result.title       = bilingual(result.title ?? "", surveyMeta.title);
    result.description = bilingual(result.description ?? "", surveyMeta.description);
  }

  // Add built-in Arabic locale button labels
  result.locale = "en";

  // Pages
  for (const page of result.pages ?? []) {
    const pageMeta = PAGE_TITLES[page.name];
    if (pageMeta) {
      if (page.title)       page.title       = bilingual(page.title, pageMeta.title);
      if (page.description) page.description = bilingual(page.description, pageMeta.description);
    }

    // Questions
    for (const q of page.elements ?? []) {
      const arTitle = QUESTION_TITLES[q.name];
      if (arTitle && q.title) {
        q.title = bilingual(q.title, arTitle);
      }

      // Choices
      for (const choice of q.choices ?? []) {
        const choiceText: string =
          typeof choice.text === "string" ? choice.text : choice.text?.default ?? "";
        const arChoiceText = CHOICE_TEXT[choiceText];
        if (arChoiceText) {
          choice.text = bilingual(choiceText, arChoiceText);
        }
      }
    }
  }

  return result;
}
