/**
 * Pre-translated voice narration for the two Home-page setup flows
 * (Gemini key, Local Brain). Web Speech's `lang` property only changes
 * pronunciation/voice — it does NOT translate text. Reading English
 * instructions with a Tamil voice tag would just mispronounce English
 * words, not genuinely help a student whose mother tongue is Tamil.
 * So the actual narration text has to exist in each language already —
 * a small, fixed script, translated once, not generated per-request.
 *
 * HONEST LIMITATION: these translations are a reasonable best effort,
 * not verified by a native speaker of each language the way curated
 * curriculum content elsewhere in this app has been. Malayalam and
 * Hindi are on firmer ground; Tamil, Kannada, and Telugu especially
 * should get a native-speaker review before this reaches real students
 * — simple, short sentences, but still worth that check for something
 * students will actually hear, not just read.
 */

export interface SetupVoiceScript {
  geminiKey: string[];       // narrated step by step when the Gemini setup modal opens
  geminiKeyDone: string;     // narrated once the key is successfully saved
  localBrain: string[];
  localBrainDone: string;
}

// TIERED CONFIDENCE — genuinely varies a lot more across this expanded
// set than it did for the original six, and that honesty matters more
// here, not less, given how much smaller and specialized the pool of
// people who could review some of these languages is:
//
// TIER A (bengali, marathi, gujarati, punjabi, urdu, odia, assamese,
// nepali) — languages with substantial real-world digital presence;
// reasonably confident in these translations, similar footing to the
// original malayalam/tamil/kannada/hindi/telugu set.
//
// TIER B (sanskrit, konkani, maithili, dogri) — Devanagari-based,
// genuine effort made, but these should get a native-speaker review
// before reaching real students with meaningfully more urgency than
// Tier A.
//
// TIER C (kashmiri, manipuri, sindhi, bodo, santali) — the least
// confident tier here, especially the languages with unique or less
// common digital scripts. These NEED native-speaker review before real
// use, not just "would benefit from" it. Worth noting the practical
// stakes are lower for santali/bodo specifically, since
// lib/web-speech.ts already flags their voice synthesis as essentially
// unavailable in practice — a translation issue there affects reading
// the text, not a spoken mispronunciation reaching a student's ears.

export const SETUP_VOICE_SCRIPTS: Record<string, SetupVoiceScript> = {
  english: {
    geminiKey: [
      "Let's get your free Gemini key — it only takes about two minutes.",
      "Tap the orange button. This opens Google's website in a new tab.",
      "On that page, tap Create API key, then copy the key that appears.",
      "Come back to this tab. We'll try to fill it in automatically — if not, just paste it in the box.",
    ],
    geminiKeyDone: "All done! Your key is saved, and your lessons are ready to go.",
    localBrain: [
      "This downloads a backup teacher that works even with no internet.",
      "It's a big download, about three gigabytes, so please use Wi-Fi, not mobile data.",
      "Tap the download button below, and keep this tab open until it finishes.",
    ],
    localBrainDone: "Your offline teacher is ready. It will work even without internet now.",
  },
  // ── ARABIC — not an Eighth Schedule language; added for the Gulf
  // market (CBSE-affiliated Indian schools are common there). Genuinely
  // high confidence given Arabic's much larger digital footprint than
  // every other non-"original" language in this file — written in
  // Modern Standard Arabic (الفصحى), the formal register actually used
  // in education across the Arab world, not a regional colloquial
  // dialect that would read differently in the Gulf versus Egypt
  // versus the Levant. ──
  arabic: {
    geminiKey: [
      "لنحصل على مفتاح Gemini المجاني الخاص بك — لن يستغرق ذلك سوى دقيقتين تقريبًا.",
      "اضغط على الزر البرتقالي. سيؤدي ذلك إلى فتح موقع Google في علامة تبويب جديدة.",
      "في تلك الصفحة، اضغط على Create API key، ثم انسخ المفتاح الذي يظهر.",
      "عد إلى علامة التبويب هذه. سنحاول ملء المفتاح تلقائيًا — وإن لم ننجح، فقط الصقه في المربع.",
    ],
    geminiKeyDone: "اكتمل كل شيء! تم حفظ مفتاحك، ودروسك جاهزة الآن.",
    localBrain: [
      "يقوم هذا بتنزيل معلم احتياطي يعمل حتى بدون إنترنت.",
      "هذا تنزيل كبير، حوالي ثلاثة جيجابايت، لذا يُرجى استخدام شبكة Wi-Fi وليس بيانات الجوال.",
      "اضغط على زر التنزيل أدناه، واترك علامة التبويب هذه مفتوحة حتى ينتهي.",
    ],
    localBrainDone: "معلمك دون اتصال بالإنترنت جاهز الآن. سيعمل حتى بدون إنترنت.",
  },
  malayalam: {
    geminiKey: [
      "നിങ്ങളുടെ സൗജന്യ Gemini കീ എടുക്കാം — ഇതിന് ഏകദേശം രണ്ട് മിനിറ്റ് മതി.",
      "ഓറഞ്ച് ബട്ടണിൽ അമർത്തുക. ഇത് Google-ന്റെ വെബ്സൈറ്റ് ഒരു പുതിയ ടാബിൽ തുറക്കും.",
      "ആ പേജിൽ, Create API key എന്നതിൽ അമർത്തി, കാണിക്കുന്ന കീ കോപ്പി ചെയ്യുക.",
      "ഈ ടാബിലേക്ക് തിരികെ വരിക. ഞങ്ങൾ അത് സ്വയമേവ പൂരിപ്പിക്കാൻ ശ്രമിക്കും — അല്ലെങ്കിൽ ബോക്സിൽ ഒട്ടിക്കുക.",
    ],
    geminiKeyDone: "എല്ലാം പൂർത്തിയായി! നിങ്ങളുടെ കീ സേവ് ചെയ്തു, ക്ലാസുകൾ തയ്യാറാണ്.",
    localBrain: [
      "ഇന്റർനെറ്റ് ഇല്ലാതെയും പ്രവർത്തിക്കുന്ന ഒരു ബാക്കപ്പ് ടീച്ചറാണ് ഇത് ഡൗൺലോഡ് ചെയ്യുന്നത്.",
      "ഇത് ഏകദേശം മൂന്ന് ജിഗാബൈറ്റ് വലുപ്പമുള്ള ഒരു ഡൗൺലോഡ് ആണ്, ദയവായി മൊബൈൽ ഡാറ്റയല്ല, Wi-Fi ഉപയോഗിക്കുക.",
      "താഴെയുള്ള ഡൗൺലോഡ് ബട്ടണിൽ അമർത്തുക, പൂർത്തിയാകുന്നത് വരെ ഈ ടാബ് തുറന്ന് വെക്കുക.",
    ],
    localBrainDone: "നിങ്ങളുടെ ഓഫ്‌ലൈൻ ടീച്ചർ തയ്യാറായി. ഇനി ഇന്റർനെറ്റ് ഇല്ലാതെയും ഇത് പ്രവർത്തിക്കും.",
  },
  tamil: {
    geminiKey: [
      "உங்கள் இலவச Gemini கீயை பெறலாம் — இதற்கு ஏறத்தாழ இரண்டு நிமிடங்கள் போதும்.",
      "ஆரஞ்சு பொத்தானை அழுத்தவும். இது Google-இன் இணையதளத்தை புதிய தாவலில் திறக்கும்.",
      "அந்தப் பக்கத்தில், Create API key என்பதை அழுத்தி, தோன்றும் கீயை நகலெடுக்கவும்.",
      "இந்தத் தாவலுக்குத் திரும்பி வாருங்கள். நாங்கள் அதை தானாகவே நிரப்ப முயற்சிப்போம் — இல்லையெனில், பெட்டியில் ஒட்டவும்.",
    ],
    geminiKeyDone: "எல்லாம் முடிந்தது! உங்கள் கீ சேமிக்கப்பட்டது, பாடங்கள் தயார்.",
    localBrain: [
      "இணையம் இல்லாமலும் வேலை செய்யும் ஒரு காப்பு ஆசிரியரை இது பதிவிறக்குகிறது.",
      "இது சுமார் மூன்று ஜிகாபைட் அளவுள்ள பெரிய பதிவிறக்கம், தயவுசெய்து மொபைல் டேட்டா அல்ல, Wi-Fi பயன்படுத்தவும்.",
      "கீழே உள்ள பதிவிறக்க பொத்தானை அழுத்தி, முடியும் வரை இந்தத் தாவலைத் திறந்து வையுங்கள்.",
    ],
    localBrainDone: "உங்கள் ஆஃப்லைன் ஆசிரியர் தயார். இணையம் இல்லாமலும் இது இப்போது வேலை செய்யும்.",
  },
  kannada: {
    geminiKey: [
      "ನಿಮ್ಮ ಉಚಿತ Gemini ಕೀಯನ್ನು ಪಡೆಯೋಣ — ಇದಕ್ಕೆ ಸುಮಾರು ಎರಡು ನಿಮಿಷ ಸಾಕು.",
      "ಕಿತ್ತಳೆ ಬಣ್ಣದ ಬಟನ್ ಒತ್ತಿ. ಇದು Google ವೆಬ್‌ಸೈಟ್ ಅನ್ನು ಹೊಸ ಟ್ಯಾಬ್‌ನಲ್ಲಿ ತೆರೆಯುತ್ತದೆ.",
      "ಆ ಪುಟದಲ್ಲಿ, Create API key ಒತ್ತಿ, ಕಾಣಿಸುವ ಕೀಯನ್ನು ನಕಲಿಸಿ.",
      "ಈ ಟ್ಯಾಬ್‌ಗೆ ಹಿಂತಿರುಗಿ. ನಾವು ಅದನ್ನು ತಾನಾಗಿಯೇ ತುಂಬಿಸಲು ಪ್ರಯತ್ನಿಸುತ್ತೇವೆ — ಇಲ್ಲದಿದ್ದರೆ, ಪೆಟ್ಟಿಗೆಯಲ್ಲಿ ಅಂಟಿಸಿ.",
    ],
    geminiKeyDone: "ಎಲ್ಲಾ ಮುಗಿಯಿತು! ನಿಮ್ಮ ಕೀ ಉಳಿಸಲಾಗಿದೆ, ಪಾಠಗಳು ಸಿದ್ಧವಾಗಿವೆ.",
    localBrain: [
      "ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದೆಯೂ ಕೆಲಸ ಮಾಡುವ ಬ್ಯಾಕಪ್ ಶಿಕ್ಷಕರನ್ನು ಇದು ಡೌನ್‌ಲೋಡ್ ಮಾಡುತ್ತದೆ.",
      "ಇದು ಸುಮಾರು ಮೂರು ಗಿಗಾಬೈಟ್ ದೊಡ್ಡ ಡೌನ್‌ಲೋಡ್, ದಯವಿಟ್ಟು ಮೊಬೈಲ್ ಡೇಟಾ ಅಲ್ಲ, Wi-Fi ಬಳಸಿ.",
      "ಕೆಳಗಿನ ಡೌನ್‌ಲೋಡ್ ಬಟನ್ ಒತ್ತಿ, ಮುಗಿಯುವವರೆಗೆ ಈ ಟ್ಯಾಬ್ ತೆರೆದಿಡಿ.",
    ],
    localBrainDone: "ನಿಮ್ಮ ಆಫ್‌ಲೈನ್ ಶಿಕ್ಷಕರು ಸಿದ್ಧವಾಗಿದ್ದಾರೆ. ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದೆಯೂ ಇದು ಈಗ ಕೆಲಸ ಮಾಡುತ್ತದೆ.",
  },
  hindi: {
    geminiKey: [
      "चलिए आपकी मुफ़्त Gemini कुंजी प्राप्त करते हैं — इसमें बस दो मिनट लगेंगे।",
      "नारंगी बटन दबाएँ। इससे Google की वेबसाइट एक नए टैब में खुलेगी।",
      "उस पेज पर, Create API key दबाएँ, फिर दिखने वाली कुंजी को कॉपी करें।",
      "इस टैब पर वापस आएँ। हम इसे अपने आप भरने की कोशिश करेंगे — नहीं तो, बॉक्स में पेस्ट कर दें।",
    ],
    geminiKeyDone: "सब हो गया! आपकी कुंजी सेव हो गई है, और पाठ तैयार हैं।",
    localBrain: [
      "यह एक बैकअप शिक्षक डाउनलोड करता है जो बिना इंटरनेट के भी काम करता है।",
      "यह लगभग तीन गीगाबाइट की बड़ी डाउनलोड है, कृपया मोबाइल डेटा नहीं, Wi-Fi का उपयोग करें।",
      "नीचे डाउनलोड बटन दबाएँ, और पूरा होने तक इस टैब को खुला रखें।",
    ],
    localBrainDone: "आपका ऑफ़लाइन शिक्षक तैयार है। अब यह बिना इंटरनेट के भी काम करेगा।",
  },
  telugu: {
    geminiKey: [
      "మీ ఉచిత Gemini కీని పొందుదాం — దీనికి కేవలం రెండు నిమిషాలు పడుతుంది.",
      "నారింజ రంగు బటన్‌ను నొక్కండి. ఇది Google వెబ్‌సైట్‌ను కొత్త ట్యాబ్‌లో తెరుస్తుంది.",
      "ఆ పేజీలో, Create API key నొక్కి, కనిపించే కీని కాపీ చేయండి.",
      "ఈ ట్యాబ్‌కు తిరిగి రండి. మేము దానిని స్వయంచాలకంగా నింపడానికి ప్రయత్నిస్తాము — లేకపోతే, పెట్టెలో అతికించండి.",
    ],
    geminiKeyDone: "అంతా పూర్తయింది! మీ కీ సేవ్ చేయబడింది, పాఠాలు సిద్ధంగా ఉన్నాయి.",
    localBrain: [
      "ఇంటర్నెట్ లేకుండా కూడా పనిచేసే బ్యాకప్ ఉపాధ్యాయుడిని ఇది డౌన్‌లోడ్ చేస్తుంది.",
      "ఇది సుమారు మూడు గిగాబైట్ల పెద్ద డౌన్‌లోడ్, దయచేసి మొబైల్ డేటా కాదు, Wi-Fi వాడండి.",
      "క్రింద ఉన్న డౌన్‌లోడ్ బటన్‌ను నొక్కి, పూర్తయ్యే వరకు ఈ ట్యాబ్‌ను తెరిచి ఉంచండి.",
    ],
    localBrainDone: "మీ ఆఫ్‌లైన్ ఉపాధ్యాయుడు సిద్ధంగా ఉన్నారు. ఇప్పుడు ఇది ఇంటర్నెట్ లేకుండా కూడా పనిచేస్తుంది.",
  },

  // ── TIER A ──────────────────────────────────────────────────────────
  bengali: {
    geminiKey: [
      "চলুন আপনার বিনামূল্যে Gemini কী নেওয়া যাক — এটিতে মাত্র দুই মিনিট সময় লাগবে।",
      "কমলা রঙের বোতামে চাপ দিন। এটি Google-এর ওয়েবসাইট একটি নতুন ট্যাবে খুলবে।",
      "সেই পাতায়, Create API key-তে চাপ দিন, তারপর যে কী দেখা যাবে তা কপি করুন।",
      "এই ট্যাবে ফিরে আসুন। আমরা এটি নিজে থেকেই পূরণ করার চেষ্টা করব — না হলে, বাক্সে পেস্ট করুন।",
    ],
    geminiKeyDone: "সব হয়ে গেছে! আপনার কী সংরক্ষিত হয়েছে, এবং পাঠ প্রস্তুত।",
    localBrain: [
      "এটি এমন একটি ব্যাকআপ শিক্ষক ডাউনলোড করে যা ইন্টারনেট ছাড়াও কাজ করে।",
      "এটি প্রায় তিন গিগাবাইটের একটি বড় ডাউনলোড, দয়া করে মোবাইল ডেটা নয়, Wi-Fi ব্যবহার করুন।",
      "নিচের ডাউনলোড বোতামে চাপ দিন, এবং শেষ না হওয়া পর্যন্ত এই ট্যাবটি খোলা রাখুন।",
    ],
    localBrainDone: "আপনার অফলাইন শিক্ষক প্রস্তুত। এখন এটি ইন্টারনেট ছাড়াও কাজ করবে।",
  },
  marathi: {
    geminiKey: [
      "चला तुमची मोफत Gemini की मिळवूया — याला फक्त दोन मिनिटे लागतील.",
      "नारंगी बटण दाबा. यामुळे Google ची वेबसाइट नवीन टॅबमध्ये उघडेल.",
      "त्या पानावर, Create API key दाबा, आणि दिसणारी की कॉपी करा.",
      "या टॅबवर परत या. आम्ही ती आपोआप भरण्याचा प्रयत्न करू — नाहीतर, बॉक्समध्ये पेस्ट करा.",
    ],
    geminiKeyDone: "सर्व झाले! तुमची की जतन झाली आहे, आणि धडे तयार आहेत.",
    localBrain: [
      "हे इंटरनेटशिवायही काम करणारा बॅकअप शिक्षक डाउनलोड करते.",
      "ही सुमारे तीन गिगाबाइटची मोठी डाउनलोड आहे, कृपया मोबाइल डेटा नाही, Wi-Fi वापरा.",
      "खालील डाउनलोड बटण दाबा, आणि पूर्ण होईपर्यंत हा टॅब उघडा ठेवा.",
    ],
    localBrainDone: "तुमचा ऑफलाइन शिक्षक तयार आहे. आता हे इंटरनेटशिवायही काम करेल.",
  },
  gujarati: {
    geminiKey: [
      "ચાલો તમારી મફત Gemini કી મેળવીએ — આમાં ફક્ત બે મિનિટ લાગશે.",
      "નારંગી બટન દબાવો. આનાથી Google ની વેબસાઇટ નવા ટેબમાં ખુલશે.",
      "તે પાના પર, Create API key દબાવો, પછી દેખાતી કીની નકલ કરો.",
      "આ ટેબ પર પાછા આવો. અમે તેને આપમેળે ભરવાનો પ્રયાસ કરીશું — નહીં તો, બોક્સમાં પેસ્ટ કરો.",
    ],
    geminiKeyDone: "બધું થઈ ગયું! તમારી કી સાચવવામાં આવી છે, અને પાઠ તૈયાર છે.",
    localBrain: [
      "આ ઇન્ટરનેટ વિના પણ કામ કરતા બેકઅપ શિક્ષકને ડાઉનલોડ કરે છે.",
      "આ લગભગ ત્રણ ગીગાબાઈટનું મોટું ડાઉનલોડ છે, કૃપા કરી મોબાઈલ ડેટા નહીં, Wi-Fi વાપરો.",
      "નીચે આપેલ ડાઉનલોડ બટન દબાવો, અને પૂર્ણ થાય ત્યાં સુધી આ ટેબ ખુલ્લું રાખો.",
    ],
    localBrainDone: "તમારો ઓફલાઈન શિક્ષક તૈયાર છે. હવે આ ઇન્ટરનેટ વિના પણ કામ કરશે.",
  },
  punjabi: {
    geminiKey: [
      "ਆਓ ਤੁਹਾਡੀ ਮੁਫ਼ਤ Gemini ਕੁੰਜੀ ਲਈਏ — ਇਸ ਵਿੱਚ ਸਿਰਫ਼ ਦੋ ਮਿੰਟ ਲੱਗਣਗੇ।",
      "ਸੰਤਰੀ ਬਟਨ ਦਬਾਓ। ਇਸ ਨਾਲ Google ਦੀ ਵੈੱਬਸਾਈਟ ਇੱਕ ਨਵੇਂ ਟੈਬ ਵਿੱਚ ਖੁੱਲ੍ਹੇਗੀ।",
      "ਉਸ ਪੰਨੇ 'ਤੇ, Create API key ਦਬਾਓ, ਫਿਰ ਦਿਖਾਈ ਦੇਣ ਵਾਲੀ ਕੁੰਜੀ ਨੂੰ ਕਾਪੀ ਕਰੋ।",
      "ਇਸ ਟੈਬ 'ਤੇ ਵਾਪਸ ਆਓ। ਅਸੀਂ ਇਸਨੂੰ ਆਪਣੇ ਆਪ ਭਰਨ ਦੀ ਕੋਸ਼ਿਸ਼ ਕਰਾਂਗੇ — ਨਹੀਂ ਤਾਂ, ਬਾਕਸ ਵਿੱਚ ਪੇਸਟ ਕਰੋ।",
    ],
    geminiKeyDone: "ਸਭ ਹੋ ਗਿਆ! ਤੁਹਾਡੀ ਕੁੰਜੀ ਸੁਰੱਖਿਅਤ ਹੋ ਗਈ ਹੈ, ਅਤੇ ਪਾਠ ਤਿਆਰ ਹਨ।",
    localBrain: [
      "ਇਹ ਇੱਕ ਬੈਕਅੱਪ ਅਧਿਆਪਕ ਡਾਊਨਲੋਡ ਕਰਦਾ ਹੈ ਜੋ ਇੰਟਰਨੈੱਟ ਤੋਂ ਬਿਨਾਂ ਵੀ ਕੰਮ ਕਰਦਾ ਹੈ।",
      "ਇਹ ਲਗਭਗ ਤਿੰਨ ਗੀਗਾਬਾਈਟ ਦਾ ਵੱਡਾ ਡਾਊਨਲੋਡ ਹੈ, ਕਿਰਪਾ ਕਰਕੇ ਮੋਬਾਈਲ ਡਾਟਾ ਨਹੀਂ, Wi-Fi ਵਰਤੋ।",
      "ਹੇਠਾਂ ਦਿੱਤੇ ਡਾਊਨਲੋਡ ਬਟਨ ਨੂੰ ਦਬਾਓ, ਅਤੇ ਪੂਰਾ ਹੋਣ ਤੱਕ ਇਸ ਟੈਬ ਨੂੰ ਖੁੱਲ੍ਹਾ ਰੱਖੋ।",
    ],
    localBrainDone: "ਤੁਹਾਡਾ ਆਫ਼ਲਾਈਨ ਅਧਿਆਪਕ ਤਿਆਰ ਹੈ। ਹੁਣ ਇਹ ਇੰਟਰਨੈੱਟ ਤੋਂ ਬਿਨਾਂ ਵੀ ਕੰਮ ਕਰੇਗਾ।",
  },
  urdu: {
    // Written right-to-left — see the honest UI note further down this
    // file. The Web Speech synthesis engine reads the text correctly
    // regardless of on-screen direction; this only affects how any
    // written version of these lines would need to be displayed.
    geminiKey: [
      "آئیے آپ کی مفت Gemini کلید حاصل کرتے ہیں — اس میں صرف دو منٹ لگیں گے۔",
      "نارنجی بٹن دبائیں۔ اس سے Google کی ویب سائٹ ایک نئے ٹیب میں کھلے گی۔",
      "اس صفحے پر، Create API key دبائیں، پھر ظاہر ہونے والی کلید کو کاپی کریں۔",
      "اس ٹیب پر واپس آئیں۔ ہم اسے خود بخود بھرنے کی کوشش کریں گے — ورنہ، خانے میں پیسٹ کر دیں۔",
    ],
    geminiKeyDone: "سب ہو گیا! آپ کی کلید محفوظ ہو گئی ہے، اور اسباق تیار ہیں۔",
    localBrain: [
      "یہ ایک بیک اپ استاد ڈاؤن لوڈ کرتا ہے جو انٹرنیٹ کے بغیر بھی کام کرتا ہے۔",
      "یہ تقریباً تین گیگا بائٹ کا بڑا ڈاؤن لوڈ ہے، براہ کرم موبائل ڈیٹا نہیں، Wi-Fi استعمال کریں۔",
      "نیچے دیئے گئے ڈاؤن لوڈ بٹن کو دبائیں، اور مکمل ہونے تک اس ٹیب کو کھلا رکھیں۔",
    ],
    localBrainDone: "آپ کا آف لائن استاد تیار ہے۔ اب یہ انٹرنیٹ کے بغیر بھی کام کرے گا۔",
  },
  odia: {
    geminiKey: [
      "ଆସନ୍ତୁ ଆପଣଙ୍କର ମାଗଣା Gemini କି ନେବା — ଏଥିରେ ମାତ୍ର ଦୁଇ ମିନିଟ୍ ଲାଗିବ।",
      "କମଳା ରଙ୍ଗର ବଟନ୍ ଦବାନ୍ତୁ। ଏହା ଦ୍ୱାରା Google ର ୱେବସାଇଟ୍ ଏକ ନୂଆ ଟ୍ୟାବରେ ଖୋଲିବ।",
      "ସେହି ପୃଷ୍ଠାରେ, Create API key ଦବାନ୍ତୁ, ତାପରେ ଦେଖାଯାଉଥିବା କି କପି କରନ୍ତୁ।",
      "ଏହି ଟ୍ୟାବକୁ ଫେରି ଆସନ୍ତୁ। ଆମେ ଏହାକୁ ନିଜେ ଭରିବାକୁ ଚେଷ୍ଟା କରିବୁ — ନହେଲେ, ବାକ୍ସରେ ପେଷ୍ଟ କରନ୍ତୁ।",
    ],
    geminiKeyDone: "ସବୁ ହୋଇଗଲା! ଆପଣଙ୍କର କି ସେଭ୍ ହୋଇଛି, ଏବଂ ପାଠ ପ୍ରସ୍ତୁତ।",
    localBrain: [
      "ଏହା ଇଣ୍ଟରନେଟ୍ ବିନା ମଧ୍ୟ କାମ କରୁଥିବା ଏକ ବ୍ୟାକଅପ୍ ଶିକ୍ଷକଙ୍କୁ ଡାଉନଲୋଡ୍ କରେ।",
      "ଏହା ପ୍ରାୟ ତିନି ଗିଗାବାଇଟ୍ର ଏକ ବଡ଼ ଡାଉନଲୋଡ୍, ଦୟାକରି ମୋବାଇଲ୍ ଡାଟା ନୁହେଁ, Wi-Fi ବ୍ୟବହାର କରନ୍ତୁ।",
      "ତଳେ ଥିବା ଡାଉନଲୋଡ୍ ବଟନ୍ ଦବାନ୍ତୁ, ଏବଂ ସମାପ୍ତ ନହେବା ପର୍ଯ୍ୟନ୍ତ ଏହି ଟ୍ୟାବକୁ ଖୋଲା ରଖନ୍ତୁ।",
    ],
    localBrainDone: "ଆପଣଙ୍କର ଅଫଲାଇନ୍ ଶିକ୍ଷକ ପ୍ରସ୍ତୁତ। ବର୍ତ୍ତମାନ ଏହା ଇଣ୍ଟରନେଟ୍ ବିନା ମଧ୍ୟ କାମ କରିବ।",
  },
  assamese: {
    geminiKey: [
      "আহক আপোনাৰ বিনামূলীয়া Gemini কী লওঁ — ইয়াত মাত্ৰ দুই মিনিট লাগিব।",
      "কমলা বুটামটো টিপক। ইয়াৰ ফলত Google ৰ ৱেবছাইটটো এটা নতুন টেবত খোলিব।",
      "সেই পৃষ্ঠাত, Create API key টিপক, তাৰ পিছত ওলোৱা কী টো কপি কৰক।",
      "এই টেবলৈ ঘূৰি আহক। আমি ইয়াক নিজে ভৰাবলৈ চেষ্টা কৰিম — নহ'লে, বাকচত পেষ্ট কৰক।",
    ],
    geminiKeyDone: "সকলো হৈ গ'ল! আপোনাৰ কী সংৰক্ষণ কৰা হৈছে, আৰু পাঠ সাজু।",
    localBrain: [
      "এইটোৱে ইণ্টাৰনেট নোহোৱাকৈয়ো কাম কৰা এজন বেকআপ শিক্ষক ডাউনল'ড কৰে।",
      "এইটো প্ৰায় তিনি গিগাবাইটৰ এটা ডাঙৰ ডাউনল'ড, অনুগ্ৰহ কৰি ম'বাইল ডাটা নহয়, Wi-Fi ব্যৱহাৰ কৰক।",
      "তলৰ ডাউনল'ড বুটামটো টিপক, আৰু সম্পূৰ্ণ নোহোৱালৈকে এই টেবটো খোলা ৰাখক।",
    ],
    localBrainDone: "আপোনাৰ অফলাইন শিক্ষক সাজু। এতিয়া এইটোৱে ইণ্টাৰনেট নোহোৱাকৈয়ো কাম কৰিব।",
  },
  nepali: {
    geminiKey: [
      "आउनुहोस् तपाईंको निःशुल्क Gemini कुञ्जी लिऔं — यसमा जम्मा दुई मिनेट लाग्छ।",
      "सुन्तला रंगको बटन थिच्नुहोस्। यसले Google को वेबसाइट नयाँ ट्याबमा खोल्नेछ।",
      "त्यो पृष्ठमा, Create API key थिच्नुहोस्, त्यसपछि देखिने कुञ्जी प्रतिलिपि गर्नुहोस्।",
      "यो ट्याबमा फर्किनुहोस्। हामी यसलाई आफै भर्ने प्रयास गर्नेछौं — होइन भने, बाकसमा टाँस्नुहोस्।",
    ],
    geminiKeyDone: "सबै भयो! तपाईंको कुञ्जी सुरक्षित भएको छ, र पाठहरू तयार छन्।",
    localBrain: [
      "यसले इन्टरनेट बिना पनि काम गर्ने ब्याकअप शिक्षक डाउनलोड गर्छ।",
      "यो लगभग तीन गिगाबाइटको ठूलो डाउनलोड हो, कृपया मोबाइल डाटा होइन, Wi-Fi प्रयोग गर्नुहोस्।",
      "तलको डाउनलोड बटन थिच्नुहोस्, र पूरा नभएसम्म यो ट्याब खुला राख्नुहोस्।",
    ],
    localBrainDone: "तपाईंको अफलाइन शिक्षक तयार छ। अब यसले इन्टरनेट बिना पनि काम गर्नेछ।",
  },

  // ── TIER B — genuine effort, needs native-speaker review with more
  // urgency than Tier A before reaching real students ──────────────────
  sanskrit: {
    geminiKey: [
      "भवतः निःशुल्कं Gemini कुञ्जिकां प्राप्नुमः — अस्मिन् द्वे निमिषे एव लगिष्यतः।",
      "नारङ्गवर्णं बटनं दबयतु। अनेन Google जालस्थानं नूतने टैबे उद्घाटितं भविष्यति।",
      "तस्मिन् पृष्ठे, Create API key इति दबयतु, ततः दृश्यमानां कुञ्जिकां प्रतिलिपिं कुरुत।",
      "पुनः अस्मिन् टैबे आगच्छतु। वयं तत् स्वयमेव पूरयितुं प्रयतिष्यामहे — अन्यथा, पेटिकायां संलग्नयतु।",
    ],
    geminiKeyDone: "सर्वं सम्पन्नम्! भवतः कुञ्जिका रक्षिता, पाठाश्च सज्जाः सन्ति।",
    localBrain: [
      "एतत् अन्तर्जालं विना अपि कार्यं कुर्वन्तं सहायक-शिक्षकं आनयति।",
      "एतत् त्रयः गिगाबाइट् परिमाणस्य बृहत् आनयनम् अस्ति, कृपया चलदूरवाणी-दत्तांशं न, Wi-Fi उपयुज्यताम्।",
      "अधः स्थितं आनयन-बटनं दबयतु, सम्पूर्णं यावत् इदं टैबं उद्घाटितं रक्षतु।",
    ],
    localBrainDone: "भवतः असंयोजित-शिक्षकः सज्जः। इदानीं एतत् अन्तर्जालं विना अपि कार्यं करिष्यति।",
  },
  konkani: {
    geminiKey: [
      "चला तुमची फुकट Gemini किल्ली मेळयाची — हाका फक्त दोन मिनटां लागतली.",
      "केशरी बटण दाबात. हाका लागून Google चें संकेतस्थळ नव्या टॅबांत उगतें.",
      "त्या पानार, Create API key दाबात, उपरांत दिसपी किल्ली कॉपी करात.",
      "ह्या टॅबाक परत या. आमी ती आपसूंक भरपाचो यत्न करतले — न्हय जाल्यार, बॉक्सांत पेस्ट करात.",
    ],
    geminiKeyDone: "सगळें जालें! तुमची किल्ली जतनाय जाली, आनी पाठ तयार आसात.",
    localBrain: [
      "हें इंटरनेट नासतां लेगीत काम करपी बॅकअप शिक्षक डावनलोड करता.",
      "हें सुमार तीन गिगाबायटांचें व्हड डावनलोड, उपकार करून मोबायल डेटा न्हय, Wi-Fi वापरात.",
      "सकयल दिल्ल्या डावनलोड बटणार दाबात, आनी पुराय जायसर हो टॅब उगतो दवरात.",
    ],
    localBrainDone: "तुमचो ऑफलायन शिक्षक तयार आसा. आतां हें इंटरनेट नासतां लेगीत काम करतलें.",
  },
  maithili: {
    geminiKey: [
      "आउ अहाँक मुफ्त Gemini कुंजी लिय — एहिमे मात्र दू मिनट लागत।",
      "नारंगी बटन दबाउ। एहिसँ Google क वेबसाइट नव टैबमे खुजत।",
      "ओहि पन्नापर, Create API key दबाउ, तखन देखाइत कुंजीकेँ कॉपी करू।",
      "एहि टैबपर वापस आउ। हमसभ एकरा अपने भरबाक प्रयास करब — नहि त, बक्समे पेस्ट करू।",
    ],
    geminiKeyDone: "सभटा भऽ गेल! अहाँक कुंजी सुरक्षित भऽ गेल अछि, आ पाठ तैयार अछि।",
    localBrain: [
      "ई इंटरनेट नहि रहितहुँ काज करैवला बैकअप शिक्षकके डाउनलोड करैत अछि।",
      "ई लगभग तीन गीगाबाइटक पैघ डाउनलोड अछि, कृपया मोबाइल डाटा नहि, Wi-Fi उपयोग करू।",
      "नीचाँ देल डाउनलोड बटन दबाउ, आ पूर्ण नहि होइत धरि ई टैब खुजल राखू।",
    ],
    localBrainDone: "अहाँक ऑफलाइन शिक्षक तैयार अछि। आब ई इंटरनेट नहि रहितहुँ काज करत।",
  },
  dogri: {
    geminiKey: [
      "आओ तुंदी मुफ़्त Gemini कुंजी लैई — इसा च सिर्फ दो मिनट लगङन।",
      "नारंगी बटन दबाओ। इसदे कन्नै Google दी वेबसाइट नमीं टैब च खुल्लग।",
      "उस पन्ने पर, Create API key दबाओ, फ्ही दिखने आह़ली कुंजी कॉपी करो।",
      "इस टैब पर वापस आओ। असां इसा गी अपने आप भरने दी कोशिश करगे — नेईं तां, बक्से च पेस्ट करो।",
    ],
    geminiKeyDone: "सब होई गेआ! तुंदी कुंजी सुरक्षत होई गेई ऐ, ते पाठ त्यार न।",
    localBrain: [
      "ऐ इक ऐसा बैकअप अध्यापक डाउनलोड करदा ऐ जेह्ड़ा इंटरनेट सुनेह़ बी कम्म करदा ऐ।",
      "ऐ लगभग तिन्न गीगाबाइट दा बड्डा डाउनलोड ऐ, किरपा करियै मोबाइल डाटा नेईं, Wi-Fi बरतो।",
      "थल्लै दित्ते डाउनलोड बटन गी दबाओ, ते पूरा होने तगर इस टैब गी खुल्लेआ रक्खो।",
    ],
    localBrainDone: "तुंदा ऑफलाइन अध्यापक त्यार ऐ। हुण ऐ इंटरनेट सुनेह़ बी कम्म करग।",
  },

  // ── TIER C — the least confident tier here; these NEED a
  // native-speaker review before real use, not just "would benefit
  // from" one ───────────────────────────────────────────────────────
  kashmiri: {
    // Written right-to-left, same as Urdu — see the honest UI note below.
    geminiKey: [
      "چلیو توہنٕد مفت Gemini کُنجی حاصل کرِو — ییٚمہ صرف دۄ منٹ لگہِ۔",
      "نارنجی بٹن دبیو۔ ییٚمہ سٟتؠ Google ہنٛز ویب سایٹ نئی ٹیب منز کھلہِ۔",
      "اُس صفحہ پؠٹھ، Create API key دبیو، تہٕ زاہر گژھنٕوالِس کُنجی کاپی کریو۔",
      "اَتھ ٹیب پؠٹھ واپس یِیو۔ اسہِ کوشش کرِو یہ خودکار طور بھرنس — نہٕ تہٕ، بکس منز پیسٹ کریو۔",
    ],
    geminiKeyDone: "سٲری کم مکمل! توہنٕد کُنجی محفوظ گژھہِ، تہٕ سبق تیار چھِ۔",
    localBrain: [
      "یہ اکھ بیک اَپ استاذ ڈاونلوڈ کران چھُ یُس انٹرنیٹ بغیرہِ ہِتہِ کٲم کران چھُ۔",
      "یہ تقریباً ترہٕ گیگابایٹس ہنٛز بڈؠ ڈاونلوڈ چھِ، مہربانی کرِتھ موبایل ڈیٹا نہٕ، Wi-Fi استعمال کریو۔",
      "تلہٕ ڈاونلوڈ بٹن دبیو، تہٕ مکمل گژھنہٕ تام یہ ٹیب کھلہٕ راخیو۔",
    ],
    localBrainDone: "توہنٕد آف لائن استاذ تیار چھُ۔ اَتہٕ یہ انٹرنیٹ بغیرہِ ہِتہِ کٲم کرِیہِ۔",
  },
  manipuri: {
    // Bengali script, the common digital form — see the LANGUAGE_NAMES
    // comment in lib/teacher-prompts.ts on why Meitei Mayek wasn't used.
    geminiKey: [
      "নঙদি ফ্রী Gemini key ফংগদবা য়েংসি — মসিদা মিনিট অনিতমক তাগনি।",
      "লৈবাক মখলগী button অদু নমো। মসিনা Google-গী website অদু tab অনৌবাদা হাংগনি।",
      "মফম অদুদা, Create API key নমো, অদুগা উৎলগবা key অদু copy তৌ।",
      "তেব অসিদা হন্না লাক্কো। ঐখোয়না মসি মশানা মশানা থাদোকপা হোৎনগনি — নত্রগা, বক্স অদুদা paste তৌ।",
    ],
    geminiKeyDone: "পুম্নমক লৈরে! নঙগী key সেভ তৌরে, অমসুং তমগদবা মায়োক্তা তৌরে।",
    localBrain: [
      "মসিনা internet য়াউদ্রবসু থবক তৌবা backup ওজা অমা download তৌই।",
      "মসি gigabyte অহুম চাক লৈবা download চাউবা অমনি, চানবিয়ু mobile data নত্তনা, Wi-Fi শীজিন্নবিয়ু।",
      "মখাদা লৈবা download button অদু নমো, অমসুং মপুং ফাউদ্রিফাউবা tab অসি হাংদোকপীরিবিয়ু।",
    ],
    localBrainDone: "নঙগী offline ওজা থৌরাং তৌরে। হৌজিক মসিনা internet য়াউদ্রবসু থবক তৌগনি।",
  },
  sindhi: {
    // Written right-to-left, same as Urdu. Sindhi is also commonly
    // written in Devanagari in parts of India — Perso-Arabic (the more
    // common digital/global standard) was used here.
    geminiKey: [
      "اچو توهانجي مفت Gemini ڪنجي وٺون — هن ۾ رڳو ٻه منٽ لڳندا.",
      "نارنگي بٽڻ دٻايو. ان سان Google جي ويب سائيٽ نئين ٽئب ۾ کلندي.",
      "ان صفحي تي، Create API key دٻايو، پوءِ ظاهر ٿيندڙ ڪنجي ڪاپي ڪريو.",
      "هن ٽئب ڏانهن واپس اچو. اسان اها پاڻمرادو ڀرڻ جي ڪوشش ڪنداسين — نه ته، دٻي ۾ پيسٽ ڪريو.",
    ],
    geminiKeyDone: "سڀ ڪجهه ٿي ويو! توهانجي ڪنجي محفوظ ٿي وئي آهي، ۽ سبق تيار آهن.",
    localBrain: [
      "هي هڪ بيڪ اپ استاد ڊائون لوڊ ڪري ٿو جيڪو انٽرنيٽ کان سواءِ به ڪم ڪري ٿو.",
      "هي لڳ ڀڳ ٽي گيگا بائيٽ جي وڏي ڊائون لوڊ آهي، مهرباني ڪري موبائل ڊيٽا نه، Wi-Fi استعمال ڪريو.",
      "هيٺ ڏنل ڊائون لوڊ بٽڻ دٻايو، ۽ مڪمل ٿيڻ تائين هي ٽئب کليل رکو.",
    ],
    localBrainDone: "توهانجو آف لائن استاد تيار آهي. هاڻي هي انٽرنيٽ کان سواءِ به ڪم ڪندو.",
  },
  bodo: {
    // Devanagari script. Real, genuine translation effort — but of
    // everything in this file, Bodo and Santali have the smallest
    // available digital-language reference material to draw on, so
    // treat this one with real caution before real use.
    geminiKey: [
      "नोंथांनि फ्री Gemini सोदोब आबुं दिहुन — बे मिनिट दुइनि सिमान लागानो।",
      "सुनगोरा बुथाम खोमो। बेनि जायगाया Google नि वेबसाइट नाथाय टेबआव खेवगोन।",
      "बे साफाआव, Create API key खोमो, नाथाय दिन्थिनाय सोदोबखौ कपि खालामो।",
      "बे टेबआव फैहौ। जोंथांयारि बेखौ गोबां रोखा फोरमानो हाबहोन — नाथाय, बाक्साव पेस्ट खालामो।",
    ],
    geminiKeyDone: "गासैबो जाबाय! नोंथांनि सोदोब सुरक्षा जाबाय, आरो फसालनिफ्राय थिरनाय दं।",
    localBrain: [
      "बेयो इन्टरनेट गैयथाबसिनो हाबफिनाय बैकआप स्कुलगिरिखौ डाउनलोड खालामो।",
      "बेयो गोबां तिनि गिगाबाइटनि गेदेर डाउनलोड, नोंथांनि मोबाइल डाटा नङा, Wi-Fi बाहायदेर।",
      "गोदानाव दानाय डाउनलोड बुथाम खोमो, आरो मोनथिनो सिमथेब बे टेबखौ खेवथि होदेर।",
    ],
    localBrainDone: "नोंथांनि अफलाइन स्कुलगिरि थिरना दं। दानि बेयो इन्टरनेट गैयथाबसिनो हाबफिनगोन।",
  },
  santali: {
    // Ol Chiki script — real translation effort, but of the whole set,
    // this one carries the least confidence and the smallest available
    // reference material. Practically lower-stakes on the voice side
    // specifically, since lib/web-speech.ts already documents that
    // synthesis for Santali is essentially unavailable on real devices
    // today — this text is more likely to be read than heard for now.
    geminiKey: [
      "ᱪᱟᱞᱟᱜ ᱟᱢᱟᱜ ᱡᱟᱶᱴᱟᱹ Gemini ᱪᱟᱵᱷᱤ ᱧᱟᱢ ᱞᱮ — ᱱᱚᱶᱟᱹ ᱨᱮ ᱵᱟᱨ ᱴᱤᱯᱟᱹᱭ ᱞᱟᱜᱟᱜ ᱠᱟᱱᱟᱭ।",
      "ᱥᱟᱱᱛᱚᱨᱤ ᱨᱚᱶ ᱵᱚᱴᱚᱱ ᱚᱛᱟᱭ ᱢᱮ। ᱱᱚᱶᱟᱹ ᱛᱮ Google ᱨᱮᱭᱟᱜ ᱣᱮᱵᱥᱟᱭᱤᱴ ᱱᱟᱶᱟ ᱴᱮᱵᱨᱮ ᱠᱷᱩᱞᱟᱭ ᱠᱟᱱᱟ।",
      "ᱚᱱᱟ ᱥᱟᱦᱴᱟ ᱨᱮ, Create API key ᱚᱛᱟᱭ ᱢᱮ, ᱟᱨ ᱫᱮᱠᱷᱟᱣ ᱠᱟᱱ ᱪᱟᱵᱷᱤ ᱠᱚᱯᱤ ᱢᱮ।",
      "ᱱᱚᱶᱟᱹ ᱴᱮᱵᱨᱮ ᱨᱩᱲᱩ ᱦᱤᱡᱩᱜ ᱢᱮ। ᱟᱞᱮ ᱱᱚᱶᱟᱹ ᱟᱡᱛᱮ ᱯᱮᱨᱮᱭᱟᱜ ᱞᱟᱹᱜᱤᱫ ᱪᱮᱥᱴᱟᱭ ᱞᱮᱜᱟ — ᱵᱟᱝ ᱛᱚ, ᱵᱚᱠᱥᱨᱮ ᱯᱮᱥᱴ ᱢᱮ।",
    ],
    geminiKeyDone: "ᱡᱚᱛᱚ ᱦᱩᱭ ᱮᱱᱟ! ᱟᱢᱟᱜ ᱪᱟᱵᱷᱤ ᱥᱟᱸᱪᱟᱣ ᱦᱩᱭ ᱮᱱᱟ, ᱟᱨ ᱚᱱᱚᱞ ᱫᱟᱲᱮᱭᱟᱜ ᱠᱟᱱᱟ।",
    localBrain: [
      "ᱱᱚᱶᱟᱹ ᱤᱱᱴᱚᱨᱱᱮᱴ ᱵᱟᱝ ᱠᱷᱟᱱ ᱦᱮᱸ ᱠᱟᱹᱢᱤ ᱠᱟᱱ ᱵᱮᱠᱟᱯ ᱚᱱᱚᱞᱟᱠᱚᱣᱟᱹᱨ ᱰᱟᱣᱩᱱᱞᱚᱰ ᱠᱟᱛᱮᱭᱟᱜᱼᱟ।",
      "ᱱᱚᱶᱟᱹ ᱟᱨᱦᱟ ᱯᱮ ᱜᱤᱜᱟᱵᱟᱭᱤᱴ ᱨᱮᱭᱟᱜ ᱢᱟᱨᱟᱝ ᱰᱟᱣᱩᱱᱞᱚᱰ ᱠᱟᱱᱟ, ᱫᱟᱭᱟᱠᱟᱛᱮ ᱢᱚᱵᱟᱭᱤᱞ ᱰᱟᱴᱟ ᱵᱟᱝ, Wi-Fi ᱵᱮᱵᱷᱟᱨ ᱢᱮ।",
      "ᱞᱟᱛᱟᱨ ᱨᱮᱭᱟᱜ ᱰᱟᱣᱩᱱᱞᱚᱰ ᱵᱚᱴᱚᱱ ᱚᱛᱟᱭ ᱢᱮ, ᱟᱨ ᱯᱩᱨᱟᱹᱣ ᱵᱟᱭ ᱦᱚᱸ ᱡᱟᱠᱟᱛ ᱱᱚᱶᱟᱹ ᱴᱮᱵ ᱠᱷᱩᱞᱟᱹᱜ ᱫᱚᱦᱚ ᱢᱮ।",
    ],
    localBrainDone: "ᱟᱢᱟᱜ ᱚᱯᱷᱞᱟᱭᱤᱱ ᱚᱱᱚᱞᱟᱠᱚᱣᱟᱹᱨ ᱫᱟᱲᱮᱭᱟᱜ ᱠᱟᱱᱟ। ᱱᱤᱛᱚᱜ ᱱᱚᱶᱟᱹ ᱤᱱᱴᱚᱨᱱᱮᱴ ᱵᱟᱝ ᱠᱷᱟᱱ ᱦᱮᱸ ᱠᱟᱹᱢᱤ ᱠᱟᱛᱮᱭᱟᱜᱼᱟ।",
  },
};

const warnedVoiceScriptLanguages = new Set<string>();

/**
 * Looks up the setup narration script for a languageId, falling back
 * to English — same warning principle as lib/web-speech.ts's
 * getSpeechLang(): only warns for a genuinely unrecognized language,
 * not for "english" being requested directly, and only once per
 * session per language so it doesn't spam the console.
 */
export function getSetupVoiceScript(languageId: string): SetupVoiceScript {
  const script = SETUP_VOICE_SCRIPTS[languageId];
  if (script) return script;
  if (languageId !== "english" && !warnedVoiceScriptLanguages.has(languageId)) {
    warnedVoiceScriptLanguages.add(languageId);
    console.warn(
      `[setup-voice-scripts] No narration script for languageId "${languageId}" — falling back to English. ` +
      `If this is a newly added language, add it to SETUP_VOICE_SCRIPTS here and to WEB_SPEECH_LANG in lib/web-speech.ts.`,
    );
  }
  return SETUP_VOICE_SCRIPTS.english;
}
