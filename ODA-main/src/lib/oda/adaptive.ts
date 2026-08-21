// ODA Adaptive Engine — the free, keyless, on-device intelligence core. // m3
// Pure TypeScript, zero dependencies, zero network calls. Reads a formal
// document's DNA (type, subject, references, date, recipient) and forges a
// formal acknowledgment reply. Every string in the output — frame, body,
// salutation and valediction — is localized into the selected language, so a
// Hindi reply reads fully in Hindi, a Tamil reply fully in Tamil, and so on.
// Languages without a kit (German, Portuguese…) degrade to English and are
// best handled by the neural forge, which knows every language.

export interface AdaptiveDoc {
  name: string;
  text?: string;
  type?: string;
  language?: string;
  formality?: string;
}

export interface AdaptiveOptions {
  language: string;
  formality: string;
  format: string;
}

export interface AdaptiveResult {
  content: string;
  strategy: "adaptive";
}

export interface LangKit {
  greet: [string, string]; // [formal, informal]
  close: [string, string]; // [formal, informal]
  subjectLabel: string;
  dateLabel: string;
  toLabel: string;
  refLabel: string;
  commDated: string;
  signatureLabel: string;
  footer: string;
  /** One-line note used by the structure-preserving translator. */
  noteNeural: string;
  /**
   * Opening acknowledgment sentence that quotes the document's actual subject
   * ("%s"). English kits leave it empty because their body templates already
   * carry the subject inline; other languages prepend it so the response is
   * always about THIS document, never generic boilerplate.
   */
  ackSubject?: string;
  body: Record<string, [string, string]>;
} // marker

const EN: LangKit = {
  greet: ["Respected Sir/Madam,", "Dear Sir/Madam,"],
  close: ["Yours faithfully,", "Yours sincerely,"],
  subjectLabel: "Subject:",
  dateLabel: "Date:",
  toLabel: "To,",
  refLabel: "Ref:",
  commDated: "Your communication dated:",
  signatureLabel: "(Signature)",
  footer:
    "— Forged on-device by ODA · mirrors the input's structure, register and references",
  noteNeural:
    "Prose below is preserved from the source. Enable the neural forge (free, on-device) for a full translation.",
  body: {
    Complaint: [
      'We have carefully examined the concerns raised in your communication regarding "%s" and regret the inconvenience caused.',
      "Your complaint has been registered with our office and assigned for immediate review. A detailed action plan addressing each point raised will be furnished to you within seven working days. Corrective measures will be taken wherever warranted.",
    ],
    "Legal Notice": [
      'This is to acknowledge receipt of your notice concerning "%s". The matter has been placed before the appropriate authority for examination.',
      "We are instructed to state that a detailed response, in accordance with law and the applicable procedure, will be communicated through our counsel within the prescribed period. We reserve all rights available to us in this regard.",
    ],
    "Invoice / Statement": [
      'We acknowledge receipt of your statement regarding "%s" and confirm that the particulars are being verified against our records.',
      "Any discrepancy, if found, shall be brought to your notice immediately. Amounts confirmed due shall be processed as per the agreed terms of payment.",
    ],
    "Transfer / Order": [
      'This is to acknowledge receipt of your communication on the subject "%s". The contents have been noted and the necessary action is being initiated at the earliest.',
      "You will be kept informed of the progress. Please address further correspondence on this matter through the reference noted above.",
    ],
    "Circular / Notification": [
      'Receipt of the notification on "%s" is hereby acknowledged. The contents have been duly noted for compliance.',
      "All concerned have been apprised of the instructions contained therein, and compliance reports will be submitted as required.",
    ],
    Memo: [
      'The memorandum on "%s" has been received and its contents have been recorded in the file for necessary action.',
      "A response will be furnished to the issuing office within the stipulated time. Please treat the matter as under process.",
    ],
    "Request / Application": [
      'We acknowledge receipt of your application on the subject "%s". The request has been taken on record and is under active consideration.',
      "A decision will be communicated to you at the earliest, and in any case within the time frame prescribed by the relevant rules. All relevant documents submitted with the application are duly preserved.",
    ],
    Report: [
      'We acknowledge receipt of the report titled "%s" and confirm that it has been received in good order.',
      "The contents are under review, and our observations will be communicated to you within a reasonable timeframe.",
    ],
    "Contract / Agreement": [
      'We acknowledge receipt of the agreement concerning "%s". The terms have been noted and the same is being processed by the concerned section.',
      "Any observations or proposed modifications will be shared with you in writing. Until then, the document stands recorded in our files.",
    ],
    Letter: [
      'We acknowledge receipt of your communication on the subject "%s". The matter has been taken on record and is receiving our attention.',
      "The necessary action is being initiated, and you will be apprised of the outcome in due course. Please quote the reference noted above in all future correspondence.",
    ],
  },
};

const HI: LangKit = {
  greet: ["प्रिय महोदय/महोदया,", "माननीय महोदय/महोदया,"],
  close: ["भवदीय,", "आपका विश्वासी,"],
  subjectLabel: "विषय:",
  dateLabel: "दिनांक:",
  toLabel: "प्रति,",
  refLabel: "संदर्भ:",
  commDated: "आपका पत्र दिनांकित:",
  signatureLabel: "(हस्ताक्षर)",
  footer:
    "— ओडीए द्वारा आपके डिवाइस पर निर्मित · इनपुट की संरचना, शैली और संदर्भों का अनुसरण करता है",
  noteNeural:
    "नीचे का मूल पाठ स्रोत भाषा में सुरक्षित रखा गया है। पूर्ण अनुवाद के लिए न्यूरल फोर्ज (निःशुल्क, आपके डिवाइस पर) चालू करें।",
  body: {
    Complaint: [
      "हमने आपके पत्र में उठाई गई शिकायत का सावधानीपूर्वक अवलोकन किया है और हुई असुविधा के लिए खेद व्यक्त करते हैं।",
      "आपकी शिकायत हमारे कार्यालय में पंजीकृत कर ली गई है और त्वरित जाँच हेतु सौंप दी गई है। उठाए गए प्रत्येक बिंदु के संबंध में सात कार्य दिवसों के भीतर विस्तृत कार्य योजना प्रस्तुत की जाएगी। जहाँ आवश्यक हो, सुधारात्मक कदम उठाए जाएँगे।",
    ],
    "Legal Notice": [
      "आपकी अधिसूचना प्राप्त करने की पुष्टि की जाती है। मामला जाँच हेतु समुचित प्राधिकारी के समक्ष रखा गया है।",
      "हमें यह बताने का निर्देश मिला है कि विधि एवं लागू प्रक्रिया के अनुसार विस्तृत उत्तर निर्धारित अवधि के भीतर हमारे विधिज्ञ के माध्यम से भेजा जाएगा। इस संबंध में उपलब्ध सभी अधिकार सुरक्षित रखे जाते हैं।",
    ],
    "Invoice / Statement": [
      "हम आपके विवरण की प्राप्ति स्वीकार करते हैं और पुष्टि करते हैं कि विवरण हमारे अभिलेखों से सत्यापित किए जा रहे हैं।",
      "कोई भी विसंगति पाई जाने पर तुरंत आपके संज्ञान में लाई जाएगी। पुष्टिकृत देय राशि का भुगतान सहमत शर्तों के अनुसार किया जाएगा।",
    ],
    "Transfer / Order": [
      "आपके पत्र की प्राप्ति स्वीकार की जाती है। सामग्री का संज्ञान ले लिया गया है और आवश्यक कार्रवाई शीघ्र प्रारंभ की जा रही है।",
      "प्रगति की सूचना आपको देते रहेंगे। कृपया इस मामले में आगे का पत्राचार उपर्युक्त संदर्भ संख्या के माध्यम से करें।",
    ],
    "Circular / Notification": [
      "अधिसूचना की प्राप्ति स्वीकार की जाती है। अनुपालन हेतु सामग्री का समुचित संज्ञान ले लिया गया है।",
      "समस्त संबंधित अधिकारियों को इसमें निहित निर्देशों से अवगत करा दिया गया है और आवश्यकता अनुसार अनुपालन रिपोर्ट प्रस्तुत की जाएगी।",
    ],
    Memo: [
      "ज्ञापन प्राप्त हो गया है और आवश्यक कार्रवाई हेतु इसकी सामग्री फाइल में दर्ज कर ली गई है।",
      "निर्धारित अवधि के भीतर जारी करने वाले कार्यालय को उत्तर प्रेषित किया जाएगा। मामले को कार्यवाही में समझें।",
    ],
    "Request / Application": [
      "हम आपके आवेदन की प्राप्ति स्वीकार करते हैं। आपका अनुरोध अभिलेख में ले लिया गया है और सक्रिय विचाराधीन है।",
      "निर्णय शीघ्रतम और नियमों द्वारा निर्धारित समय सीमा के भीतर आपको सूचित किया जाएगा। आवेदन के साथ प्रस्तुत सभी दस्तावेज सुरक्षित रखे गए हैं।",
    ],
    Report: [
      "हम रिपोर्ट की प्राप्ति स्वीकार करते हैं और पुष्टि करते हैं कि वह सुव्यवस्थित रूप से प्राप्त हुई है।",
      "सामग्री समीक्षाधीन है और हमारी टिप्पणियाँ उचित समय सीमा के भीतर आपको प्रेषित की जाएँगी।",
    ],
    "Contract / Agreement": [
      "हम अनुबंध की प्राप्ति स्वीकार करते हैं। शर्तों का संज्ञान ले लिया गया है और संबंधित अनुभाग द्वारा कार्रवाई की जा रही है।",
      "कोई भी टिप्पणी या प्रस्तावित संशोधन लिखित रूप में आपसे साझा किया जाएगा। तब तक दस्तावेज़ हमारी फाइलों में दर्ज है।",
    ],
    Letter: [
      "हम आपके पत्र की प्राप्ति स्वीकार करते हैं। मामला अभिलेख में ले लिया गया है और हमारा ध्यान प्राप्त कर रहा है।",
      "आवश्यक कार्रवाई प्रारंभ कर दी गई है और परिणाम से आपको समय पर अवगत कराया जाएगा। कृपया भावी पत्राचार में उपर्युक्त संदर्भ संख्या अंकित करें।",
    ],
  },
};

const TA: LangKit = {
  greet: ["அன்புடையீர்,", "மதிப்பிற்குரிய அவர்களே,"],
  close: ["அன்புடன்,", "உண்மையுள்ளவர்,"],
  subjectLabel: "பொருள்:",
  dateLabel: "தேதி:",
  toLabel: "அனுப்புநர்:",
  refLabel: "மேற்கோள்:",
  commDated: "உங்கள் கடிதம் தேதியிட்ட:",
  signatureLabel: "(கையொப்பம்)",
  footer:
    "— ODA ஆல் உங்கள் சாதனத்தில் உருவாக்கப்பட்டது · உள்ளீட்டின் கட்டமைப்பு, முறை மற்றும் மேற்கோள்களை பிரதிபலிக்கிறது",
  noteNeural:
    "கீழே உள்ள உரை மூல மொழியில் பாதுகாக்கப்பட்டுள்ளது. முழு மொழிபெயர்ப்புக்கு நியூரல் ஃபோர்ஜ் (இலவசம், உங்கள் சாதனத்தில்) இயக்கவும்.",
  body: {
    Complaint: [
      "உங்கள் கடிதத்தில் எழுப்பப்பட்ட குறைகளை நாங்கள் கவனமாக ஆய்வு செய்துள்ளோம், ஏற்பட்ட சிரமத்திற்கு வருந்துகிறோம்.",
      "உங்கள் புகார் எங்கள் அலுவலகத்தில் பதிவு செய்யப்பட்டு உடனடி விசாரணைக்கு ஒப்படைக்கப்பட்டுள்ளது. எழுப்பப்பட்ட ஒவ்வொரு புள்ளிக்கும் ஏழு வேலை நாட்களுக்குள் விரிவான செயல் திட்டம் வழங்கப்படும். தேவையான இடங்களில் சரிசெய்யும் நடவடிக்கைகள் எடுக்கப்படும்.",
    ],
    "Legal Notice": [
      "உங்கள் அறிவிப்பைப் பெற்றுக்கொண்டதாக ஒப்புக்கொள்கிறோம். இந்த விவகாரம் பரிசீலனைக்காக உரிய அதிகாரியிடம் வைக்கப்பட்டுள்ளது.",
      "சட்டம் மற்றும் பொருந்தக்கூடிய நடைமுறையின்படி, விரிவான பதில் நிர்ணயிக்கப்பட்ட காலத்திற்குள் எங்கள் வழக்கறிஞர் மூலம் தெரிவிக்கப்படும் என்று கூற அறிவுறுத்தப்பட்டுள்ளோம். இது தொடர்பான அனைத்து உரிமைகளையும் நாங்கள் வைத்துள்ளோம்.",
    ],
    "Invoice / Statement": [
      "உங்கள் அறிக்கையைப் பெற்றுக்கொண்டதை ஒப்புக்கொள்கிறோம், விவரங்கள் எங்கள் பதிவுகளுடன் சரிபார்க்கப்படுகின்றன.",
      "ஏதேனும் முரண்பாடு கண்டறியப்பட்டால் உடனடியாக உங்கள் கவனத்திற்குக் கொண்டுவரப்படும். உறுதிசெய்யப்பட்ட தொகைகள் ஒப்புக்கொள்ளப்பட்ட கட்டண விதிமுறைகளின்படி செலுத்தப்படும்.",
    ],
    "Transfer / Order": [
      "உங்கள் கடிதத்தைப் பெற்றுக்கொண்டதாக ஒப்புக்கொள்கிறோம். உள்ளடக்கங்கள் கவனிக்கப்பட்டு, தேவையான நடவடிக்கை விரைவில் தொடங்கப்படுகிறது.",
      "முன்னேற்றம் குறித்து உங்களுக்குத் தெரிவிக்கப்படும். இந்த விஷயத்தில் மேற்கண்ட மேற்கோளைப் பயன்படுத்தி தொடர்பு கொள்ளவும்.",
    ],
    "Circular / Notification": [
      "அறிவிப்பைப் பெற்றுக்கொண்டதாக ஒப்புக்கொள்கிறோம். இணங்குவதற்காக உள்ளடக்கங்கள் பதிவு செய்யப்பட்டுள்ளன.",
      "சம்பந்தப்பட்ட அனைவருக்கும் வழிமுறைகள் தெரிவிக்கப்பட்டுள்ளன, தேவையான இணக்க அறிக்கைகள் சமர்ப்பிக்கப்படும்.",
    ],
    Memo: [
      "நினைவூட்டல் குறிப்பு பெறப்பட்டு, தேவையான நடவடிக்கைக்காக அதன் உள்ளடக்கம் கோப்பில் பதிவு செய்யப்பட்டுள்ளது.",
      "நிர்ணயிக்கப்பட்ட காலத்திற்குள் வெளியிட்ட அலுவலகத்திற்கு பதில் அனுப்பப்படும். இந்த விவகாரம் செயல்பாட்டில் இருப்பதாகக் கருதவும்.",
    ],
    "Request / Application": [
      "உங்கள் விண்ணப்பத்தைப் பெற்றுக்கொண்டதாக ஒப்புக்கொள்கிறோம். கோரிக்கை பதிவு செய்யப்பட்டு பரிசீலனையில் உள்ளது.",
      "முடிவு விரைவில், மற்றும் தொடர்புடைய விதிகளால் நிர்ணயிக்கப்பட்ட காலக்கெடுவுக்குள் உங்களுக்குத் தெரிவிக்கப்படும். சமர்ப்பிக்கப்பட்ட ஆவணங்கள் பாதுகாப்பாக வைக்கப்பட்டுள்ளன.",
    ],
    Report: [
      "அறிக்கையைப் பெற்றுக்கொண்டதை ஒப்புக்கொள்கிறோம், அது நல்ல நிலையில் பெறப்பட்டுள்ளது.",
      "உள்ளடக்கங்கள் மதிப்பாய்வில் உள்ளன; எங்கள் கருத்துகள் உரிய காலத்தில் தெரிவிக்கப்படும்.",
    ],
    "Contract / Agreement": [
      "ஒப்பந்தத்தைப் பெற்றுக்கொண்டதை ஒப்புக்கொள்கிறோம். விதிமுறைகள் கவனிக்கப்பட்டு, தொடர்புடைய பிரிவால் செயல்படுத்தப்படுகிறது.",
      "ஏதேனும் கருத்துகள் அல்லது திருத்தங்கள் எழுத்துப்பூர்வமாகத் தெரிவிக்கப்படும். அதுவரை ஆவணம் எங்கள் கோப்புகளில் பதிவு செய்யப்பட்டுள்ளது.",
    ],
    Letter: [
      "உங்கள் கடிதத்தைப் பெற்றுக்கொண்டதாக ஒப்புக்கொள்கிறோம். விவகாரம் பதிவு செய்யப்பட்டு எங்கள் கவனத்தைப் பெற்று வருகிறது.",
      "தேவையான நடவடிக்கை தொடங்கப்பட்டு, முடிவு குறித்து உரிய நேரத்தில் உங்களுக்குத் தெரிவிக்கப்படும். மேற்கண்ட மேற்கோளை அனைத்து கடிதங்களிலும் குறிப்பிடவும்.",
    ],
  },
};

const BN: LangKit = {
  greet: ["মহোদয়/মহোদয়া,", "প্রিয় মহোদয়/মহোদয়া,"],
  close: ["ভবদীয়,", "আপনার বিশ্বস্ত,"],
  subjectLabel: "বিষয়:",
  dateLabel: "তারিখ:",
  toLabel: "প্রতি,",
  refLabel: "সূত্র:",
  commDated: "আপনার পত্র তারিখ:",
  signatureLabel: "(স্বাক্ষর)",
  footer:
    "— ODA দ্বারা আপনার ডিভাইসে নির্মিত · ইনপুটের কাঠামো, রীতি ও সূত্র অনুসরণ করে",
  noteNeural:
    "নিচের মূল পাঠ সোর্স ভাষায় সংরক্ষিত। সম্পূর্ণ অনুবাদের জন্য নিউরাল ফোর্জ (বিনামূল্যে, আপনার ডিভাইসে) চালু করুন।",
  body: {
    Complaint: [
      "আপনার পত্রে উত্থাপিত অভিযোগগুলি আমরা সযত্নে পরীক্ষা করেছি এবং সৃষ্ট অসুবিধার জন্য আন্তরিকভাবে দুঃখিত।",
      "আপনার অভিযোগ আমাদের কার্যালয়ে নথিভুক্ত করা হয়েছে এবং তাৎক্ষণিক পরীক্ষার জন্য ন্যস্ত করা হয়েছে। উত্থাপিত প্রতিটি বিষয়ে সাত কর্মদিবসের মধ্যে বিস্তারিত কর্মপরিকল্পনা প্রদান করা হবে। প্রয়োজন হলে সংশোধনমূলক ব্যবস্থা গ্রহণ করা হবে।",
    ],
    "Legal Notice": [
      "আপনার নোটিশ প্রাপ্তি স্বীকার করা হলো। বিষয়টি পরীক্ষার জন্য উপযুক্ত কর্তৃপক্ষের কাছে উপস্থাপন করা হয়েছে।",
      "আইন ও প্রযোজ্য পদ্ধতি অনুযায়ী বিস্তারিত উত্তর নির্ধারিত সময়সীমার মধ্যে আমাদের আইনজীবীর মাধ্যমে জানানো হবে বলে নির্দেশ দেওয়া হয়েছে। এ বিষয়ে আমাদের সকল অধিকার সংরক্ষিত থাকবে।",
    ],
    "Invoice / Statement": [
      "আমরা আপনার বিবৃতি প্রাপ্তি স্বীকার করছি এবং নিশ্চিত করছি যে বিবরণী আমাদের রেকর্ডের সাথে যাচাই করা হচ্ছে।",
      "কোনো অসঙ্গতি পাওয়া গেলে তা অবিলম্বে আপনার নজরে আনা হবে। নিশ্চিত পাওনা পরিমাণ সম্মত শর্তানুযায়ী পরিশোধ করা হবে।",
    ],
    "Transfer / Order": [
      "আমরা আপনার পত্র প্রাপ্তি স্বীকার করছি। বিষয়বস্তু লিপিবদ্ধ করা হয়েছে এবং প্রয়োজনীয় ব্যবস্থা সত্বর গ্রহণ করা হচ্ছে।",
      "অগ্রগতি সম্পর্কে আপনাকে অবহিত করা হবে। পরবর্তী পত্রাচারে উপরোক্ত সূত্রটি উল্লেখ করার অনুরোধ করা হলো।",
    ],
    "Circular / Notification": [
      "বিজ্ঞপ্তিটি প্রাপ্তি স্বীকার করা হলো। মেনে চলার জন্য বিষয়বস্তু যথাযথভাবে নথিভুক্ত করা হয়েছে।",
      "সম্পৃক্ত সকলকে নির্দেশনাগুলি অবহিত করা হয়েছে এবং প্রয়োজন অনুযায়ী সম্মতি প্রতিবেদন দাখিল করা হবে।",
    ],
    Memo: [
      "স্মারকলিপিটি প্রাপ্ত হয়েছে এবং প্রয়োজনীয় ব্যবস্থার জন্য এর বিষয়বস্তু ফাইলে লিপিবদ্ধ করা হয়েছে।",
      "নির্ধারিত সময়ের মধ্যে জারিকারী কার্যালয়ে উত্তর প্রেরণ করা হবে। বিষয়টি প্রক্রিয়াধীন বিবেচনা করুন।",
    ],
    "Request / Application": [
      "আমরা আপনার আবেদন প্রাপ্তি স্বীকার করছি। অনুরোধটি নথিভুক্ত করা হয়েছে এবং সক্রিয় বিবেচনাধীন রয়েছে।",
      "সিদ্ধান্ত যত শীঘ্র সম্ভব এবং প্রাসঙ্গিক বিধি অনুযায়ী নির্ধারিত সময়ের মধ্যে জানানো হবে। আবেদনের সাথে দাখিলকৃত নথিপত্র সংরক্ষিত আছে।",
    ],
    Report: [
      "আমরা প্রতিবেদনটি প্রাপ্তি স্বীকার করছি এবং নিশ্চিত করছি যে এটি সুচারুভাবে গৃহীত হয়েছে।",
      "বিষয়বস্তু পর্যালোচনাধীন; আমাদের পর্যবেক্ষণ যথাযথ সময়ের মধ্যে জানানো হবে।",
    ],
    "Contract / Agreement": [
      "আমরা চুক্তিপত্রটি প্রাপ্তি স্বীকার করছি। শর্তাবলী লিপিবদ্ধ করা হয়েছে এবং সংশ্লিষ্ট শাখায় প্রক্রিয়াধীন।",
      "কোনো পর্যবেক্ষণ বা প্রস্তাবিত সংশোধন লিখিতভাবে জানানো হবে। ততক্ষণ নথিটি আমাদের ফাইলে রক্ষিত থাকবে।",
    ],
    Letter: [
      "আমরা আপনার পত্র প্রাপ্তি স্বীকার করছি। বিষয়টি নথিভুক্ত করা হয়েছে এবং আমাদের মনোযোগ পাচ্ছে।",
      "প্রয়োজনীয় ব্যবস্থা শুরু করা হয়েছে এবং ফলাফল সম্পর্কে যথাসময়ে আপনাকে অবহিত করা হবে। ভবিষ্যতের পত্রাচারে উপরোক্ত সূত্রটি উল্লেখ করুন।",
    ],
  },
};

const ES: LangKit = {
  greet: ["Estimado/a Señor/a,", "Muy Señor mío/a,"],
  close: ["Atentamente,", "Le saluda atentamente,"],
  subjectLabel: "Asunto:",
  dateLabel: "Fecha:",
  toLabel: "A:",
  refLabel: "Ref.:",
  commDated: "Su comunicación de fecha:",
  signatureLabel: "(Firma)",
  footer:
    "— Forjado en su dispositivo por ODA · refleja la estructura, el registro y las referencias del documento original",
  noteNeural:
    "El texto siguiente se conserva en el idioma original. Active el horno neuronal (gratuito, en su dispositivo) para una traducción completa.",
  body: {
    Complaint: [
      "Hemos examinado detenidamente las reclamaciones planteadas en su comunicación y lamentamos las molestias ocasionadas.",
      "Su reclamación ha quedado registrada en nuestra oficina y asignada para su revisión inmediata. Se le facilitará un plan de acción detallado sobre cada punto planteado en un plazo de siete días hábiles. Se adoptarán las medidas correctivas que correspondan.",
    ],
    "Legal Notice": [
      "Damos por recibida su notificación. El asunto ha sido puesto a disposición de la autoridad competente para su examen.",
      "Se nos instruye manifestar que una respuesta detallada, conforme a la ley y al procedimiento aplicable, será comunicada a través de nuestro asesor jurídico dentro del plazo establecido. Nos reservamos todos los derechos que nos asisten en este sentido.",
    ],
    "Invoice / Statement": [
      "Acusamos recibo de su estado de cuenta y confirmamos que los datos están siendo verificados con nuestros registros.",
      "Cualquier discrepancia, en caso de detectarse, le será comunicada de inmediato. Los importes confirmados serán procesados conforme a las condiciones de pago acordadas.",
    ],
    "Transfer / Order": [
      "Acusamos recibo de su comunicación. Su contenido ha sido anotado y se está iniciando la actuación necesaria a la mayor brevedad.",
      "Se le mantendrá informado del progreso. Sírvase dirigir la correspondencia posterior sobre este asunto citando la referencia indicada.",
    ],
    "Circular / Notification": [
      "Se acusa recibo de la notificación. Su contenido ha sido debidamente anotado para su cumplimiento.",
      "Todos los interesados han sido informados de las instrucciones contenidas en la misma, y se presentarán los informes de cumplimiento requeridos.",
    ],
    Memo: [
      "Hemos recibido el memorando y su contenido ha quedado registrado en el expediente para la actuación oportuna.",
      "Se remitirá una respuesta a la oficina emisora dentro del plazo establecido. El asunto queda en trámite.",
    ],
    "Request / Application": [
      "Acusamos recibo de su solicitud. La petición ha quedado registrada y se encuentra en estudio activo.",
      "La decisión le será comunicada a la mayor brevedad y, en todo caso, dentro del plazo previsto por la normativa aplicable. La documentación presentada queda debidamente archivada.",
    ],
    Report: [
      "Acusamos recibo del informe y confirmamos que ha llegado en buen estado.",
      "El contenido está siendo examinado y nuestras observaciones le serán comunicadas en un plazo razonable.",
    ],
    "Contract / Agreement": [
      "Acusamos recibo del acuerdo. Las condiciones han sido anotadas y el documento está siendo tramitado por la sección competente.",
      "Cualquier observación o modificación propuesta se le comunicará por escrito. Mientras tanto, el documento queda registrado en nuestros archivos.",
    ],
    Letter: [
      "Acusamos recibo de su comunicación. El asunto ha quedado registrado y recibe nuestra atención.",
      "Se está iniciando la actuación necesaria y se le informará del resultado oportunamente. Sírvase citar la referencia indicada en toda correspondencia futura.",
    ],
  },
};

const FR: LangKit = {
  greet: ["Monsieur/Madame,", "Cher Monsieur / Chère Madame,"],
  close: ["Veuillez agréer mes salutations distinguées,", "Cordialement,"],
  subjectLabel: "Objet :",
  dateLabel: "Date :",
  toLabel: "À :",
  refLabel: "Réf. :",
  commDated: "Votre communication en date du :",
  signatureLabel: "(Signature)",
  footer:
    "— Forgé sur votre appareil par ODA · reflète la structure, le registre et les références du document d'origine",
  noteNeural:
    "Le texte ci-dessous est conservé dans la langue source. Activez la forge neuronale (gratuite, sur votre appareil) pour une traduction complète.",
  body: {
    Complaint: [
      "Nous avons examiné avec attention les griefs soulevés dans votre communication et nous regrettons les désagréments occasionnés.",
      "Votre réclamation a été enregistrée auprès de nos services et confiée pour examen immédiat. Un plan d'action détaillé répondant à chaque point sera transmis sous sept jours ouvrables. Les mesures correctives nécessaires seront prises.",
    ],
    "Legal Notice": [
      "Nous accusons réception de votre mise en demeure. L'affaire a été soumise à l'autorité compétente pour examen.",
      "Il nous est indiqué qu'une réponse détaillée, conformément à la loi et à la procédure applicable, sera communiquée par l'intermédiaire de notre conseil dans le délai prescrit. Nous réservons tous nos droits à cet égard.",
    ],
    "Invoice / Statement": [
      "Nous accusons réception de votre relevé et confirmons que les informations sont en cours de vérification auprès de nos services.",
      "Toute divergence constatée vous sera signalée immédiatement. Les montants confirmés seront traités selon les conditions de paiement convenues.",
    ],
    "Transfer / Order": [
      "Nous accusons réception de votre communication. Son contenu a été noté et les démarches nécessaires sont engagées dans les plus brefs délais.",
      "Vous serez tenu informé de l'avancement du dossier. Veuillez adresser toute correspondance ultérieure en citant la référence ci-dessus.",
    ],
    "Circular / Notification": [
      "Nous accusons réception de la notification. Son contenu a été dûment enregistré pour application.",
      "Toutes les personnes concernées ont été informées des instructions qu'elle contient, et les rapports de conformité requis seront transmis.",
    ],
    Memo: [
      "La note a été reçue et son contenu a été consigné au dossier pour les suites nécessaires.",
      "Une réponse sera adressée au service émetteur dans le délai imparti. Le dossier est en cours de traitement.",
    ],
    "Request / Application": [
      "Nous accusons réception de votre demande. Celle-ci a été enregistrée et fait l'objet d'un examen attentif.",
      "Une décision vous sera communiquée dans les meilleurs délais, et en tout état de cause dans le délai prévu par la réglementation applicable. Les pièces jointes sont conservées en nos archives.",
    ],
    Report: [
      "Nous accusons réception du rapport et confirmons qu'il nous est parvenu en bon état.",
      "Son contenu est en cours d'examen et nos observations vous seront communiquées dans un délai raisonnable.",
    ],
    "Contract / Agreement": [
      "Nous accusons réception de la convention. Les termes ont été notés et le document est traité par le service compétent.",
      "Toute observation ou modification proposée vous sera communiquée par écrit. Le document reste consigné dans nos dossiers.",
    ],
    Letter: [
      "Nous accusons réception de votre communication. L'affaire a été enregistrée et reçoit toute notre attention.",
      "Les démarches nécessaires sont engagées et vous serez informé de l'issue en temps utile. Veuillez citer la référence ci-dessus dans toute correspondance future.",
    ],
  },
};

const AR: LangKit = {
  greet: ["السيد المحترم،", "عزيزي السيد/السيدة،"],
  close: ["وتفضلوا بقبول فائق الاحترام،", "مع خالص التقدير،"],
  subjectLabel: "الموضوع:",
  dateLabel: "التاريخ:",
  toLabel: "إلى:",
  refLabel: "المرجع:",
  commDated: "خطابكم المؤرخ في:",
  signatureLabel: "(التوقيع)",
  footer:
    "— أُنشئ على جهازك بواسطة ODA · يعكس بنية المستند الأصلي وأسلوبه ومراجعه",
  noteNeural:
    "النص أدناه محفوظ بلغة المصدر. فعّل المصهر العصبي (مجاني، على جهازك) للحصول على ترجمة كاملة.",
  body: {
    Complaint: [
      "لقد درسنا بعناية الشكاوى الواردة في خطابكم ونأسف للإزعاج الذي سببه ذلك.",
      "تم تسجيل شكواكم لدى مكتبنا وإحالتها للمراجعة الفورية. وسيتم تزويدكم بخطة عمل مفصلة تعالج كل نقطة خلال سبعة أيام عمل. وستُتخذ التدابير التصحيحية اللازمة.",
    ],
    "Legal Notice": [
      "نؤكد استلام إشعاركم. وقد عُرض الموضوع على الجهة المختصة للفحص.",
      "نفيدكم بأن الرد التفصيلي، وفقاً للقانون والإجراءات المطبقة، سيُرسل عبر مستشارنا القانوني خلال المدة المقررة. ونحتفظ بجميع حقوقنا بهذا الشأن.",
    ],
    "Invoice / Statement": [
      "نؤكد استلام كشفكم ونتحقق من البيانات الواردة فيه مقابل سجلاتنا.",
      "سيُعلمكم مكتبنا فوراً بأي تباين يُكتشف. وسيتم معالجة المبالغ المؤكدة وفقاً لشروط الدفع المتفق عليها.",
    ],
    "Transfer / Order": [
      "نؤكد استلام خطابكم. وقد تم الاطلاع على مضمونه وبدأ اتخاذ الإجراءات اللازمة في أقرب وقت.",
      "سنوافيكم بمستجدات الموضوع. يرجى توجيه المراسلات اللاحقة مع ذكر المرجع أعلاه.",
    ],
    "Circular / Notification": [
      "نؤكد استلام الإشعار. وقد تم الاطلاع على مضمونه للامتثال له.",
      "تم إبلاغ جميع المعنيين بالتعليمات الواردة فيه، وستُقدم تقارير الامتثال المطلوبة.",
    ],
    Memo: [
      "تم استلام المذكرة وتسجيل مضمونها في الملف لاتخاذ الإجراء اللازم.",
      "سيُرسل الرد إلى المكتب المُصدِر خلال المدة المحددة. ويُعتبر الموضوع قيد المعالجة.",
    ],
    "Request / Application": [
      "نؤكد استلام طلبكم. وقد تم تسجيل الطلب وهو قيد النظر النشط.",
      "سيُعلمكم مكتبنا بالقرار في أقرب وقت، وداخل المهلة المحددة بالقواعد ذات الصلة في جميع الأحوال. والمستندات المرفقة محفوظة لدينا.",
    ],
    Report: [
      "نؤكد استلام التقرير وأنه وصل بحالة جيدة.",
      "المحتوى قيد المراجعة، وسيتم إبلاغكم بملاحظاتنا خلال مهلة معقولة.",
    ],
    "Contract / Agreement": [
      "نؤكد استلام الاتفاقية. وقد تم الاطلاع على الشروط وتتولى المعالجة الجهة المختصة.",
      "سيتم إبلاغكم بأي ملاحظات أو تعديلات مقترحة كتابياً. وحتى ذلك الحين، يبقى المستند محفوظاً في ملفاتنا.",
    ],
    Letter: [
      "نؤكد استلام خطابكم. وقد تم تسجيل الموضوع وهو محل اهتمامنا.",
      "بدأ اتخاذ الإجراءات اللازمة، وسيتم إعلامكم بالنتيجة في حينه. يرجى ذكر المرجع أعلاه في جميع المراسلات القادمة.",
    ],
  },
};

const TE: LangKit = {
  greet: ["గౌరవనీయులైన సర్/మేడమ్,", "ప్రియమైన సర్/మేడమ్,"],
  close: ["విధేయుడుగా,", "మీ విశ్వాసపాత్రుడు,"],
  subjectLabel: "విషయం:",
  dateLabel: "తేదీ:",
  toLabel: "ప్రతి:",
  refLabel: "సూచన:",
  commDated: "మీ లేఖ తేదీ:",
  signatureLabel: "(సంతకం)",
  footer:
    "— ODA ద్వారా మీ పరికరంలో రూపొందించబడింది · ఇన్‌పుట్ నిర్మాణం, శైలి మరియు సూచనలను ప్రతిబింబిస్తుంది",
  noteNeural:
    "దిగువ గద్యం మూల భాషలో భద్రపరచబడింది. పూర్తి అనువాదం కోసం న్యూరల్ ఫోర్జ్ (ఉచితం, మీ పరికరంలో) ప్రారంభించండి.",
  body: {
    Complaint: [
      "మీ లేఖలో లేవనెత్తిన ఫిర్యాదులను మేము జాగ్రత్తగా పరిశీలించాము మరియు కలిగిన అసౌకర్యానికి విచారం వ్యక్తం చేస్తున్నాము.",
      "మీ ఫిర్యాదు మా కార్యాలయంలో నమోదు చేయబడి వెంటనే పరిశీలనకు అప్పగించబడింది. లేవనెత్తిన ప్రతి అంశంపై ఏడు పని దినాలలో వివరణాత్మక కార్యాచరణ ప్రణాళిక అందించబడుతుంది. అవసరమైన చోట దిద్దుబాటు చర్యలు తీసుకోబడతాయి.",
    ],
    "Legal Notice": [
      "మీ నోటీసు అందినట్లు ధృవీకరిస్తున్నాము. ఈ విషయం పరిశీలన కోసం తగిన అధికారి ముందు ఉంచబడింది.",
      "చట్టం మరియు వర్తించే విధానం ప్రకారం వివరణాత్మక ప్రత్యుత్తరం నిర్ణీత కాలంలో మా న్యాయవాది ద్వారా తెలియజేయబడుతుందని పేర్కొనాలని మాకు సూచించబడింది. ఈ విషయంలో మాకు అందుబాటులో ఉన్న అన్ని హక్కులను మేము దక్కించుకుంటాము.",
    ],
    "Invoice / Statement": [
      "మీ ప్రకటన అందినట్లు అంగీకరిస్తున్నాము మరియు వివరాలు మా రికార్డులతో ధృవీకరించబడుతున్నాయి.",
      "ఏదైనా వ్యత్యాసం కనుగొంటే వెంటనే మీ దృష్టికి తీసుకురాబడుతుంది. ధృవీకరించబడిన మొత్తాలు అంగీకరించిన చెల్లింపు నిబంధనల ప్రకారం ప్రాసెస్ చేయబడతాయి.",
    ],
    "Transfer / Order": [
      "మీ లేఖ అందినట్లు అంగీకరిస్తున్నాము. విషయం గమనించబడింది మరియు అవసరమైన చర్య వీలైనంత త్వరగా ప్రారంభించబడుతోంది.",
      "పురోగతి గురించి మీకు తెలియజేయబడుతుంది. ఈ విషయంలో తదుపరి ఉత్తర ప్రత్యుత్తరాలను పై సూచన ద్వారా చేయండి.",
    ],
    "Circular / Notification": [
      "నోటీసు అందినట్లు ధృవీకరించబడుతుంది. పాటించడానికి విషయం సరిగా నమోదు చేయబడింది.",
      "సంబంధిత అందరికీ అందులోని సూచనలు తెలియజేయబడ్డాయి మరియు అవసరమైన విధంగా కంప్లైయెన్స్ నివేదికలు సమర్పించబడతాయి.",
    ],
    Memo: [
      "మెమో అందింది మరియు అవసరమైన చర్య కోసం దాని విషయం ఫైలులో నమోదు చేయబడింది.",
      "నిర్ణీత సమయంలో జారీ చేసిన కార్యాలయానికి సమాధానం అందించబడుతుంది. విషయం ప్రక్రియలో ఉందని భావించండి.",
    ],
    "Request / Application": [
      "మీ దరఖాస్తు అందినట్లు అంగీకరిస్తున్నాము. అభ్యర్థన నమోదు చేయబడింది మరియు క్రియాశీల పరిశీలనలో ఉంది.",
      "సంబంధిత నిబంధనల ప్రకారం నిర్ణీత కాలంలోపు మరియు సాధ్యమైనంత త్వరగా నిర్ణయం మీకు తెలియజేయబడుతుంది. దరఖాస్తుతో సమర్పించిన పత్రాలు భద్రంగా ఉంచబడ్డాయి.",
    ],
    Report: [
      "నివేదిక అందినట్లు అంగీకరిస్తున్నాము మరియు అది సక్రమంగా అందిందని ధృవీకరిస్తున్నాము.",
      "విషయం సమీక్షలో ఉంది; మా పరిశీలనలు సహేతుకమైన సమయంలో మీకు తెలియజేయబడతాయి.",
    ],
    "Contract / Agreement": [
      "ఒప్పందం అందినట్లు అంగీకరిస్తున్నాము. నిబంధనలు గమనించబడ్డాయి మరియు సంబంధిత విభాగం ద్వారా ప్రాసెస్ చేయబడుతోంది.",
      "ఏవైనా పరిశీలనలు లేదా ప్రతిపాదిత మార్పులు వ్రాతపూర్వకంగా మీతో పంచుకోబడతాయి. అంతవరకు పత్రం మా ఫైళ్లలో నమోదు చేయబడి ఉంటుంది.",
    ],
    Letter: [
      "మీ లేఖ అందినట్లు అంగీకరిస్తున్నాము. విషయం నమోదు చేయబడింది మరియు మా దృష్టిని పొందుతోంది.",
      "అవసరమైన చర్య ప్రారంభించబడింది మరియు ఫలితం గురించి సరైన సమయంలో మీకు తెలియజేయబడుతుంది. భవిష్యత్తు ఉత్తర ప్రత్యుత్తరాలలో పై సూచనను పేర్కొనండి.",
    ],
  },
};

const KN: LangKit = {
  greet: ["ಪೂಜ್ಯರಾದ ಸರ್/ಮೇಡಂ,", "ಪ್ರಿಯ ಸರ್/ಮೇಡಂ,"],
  close: ["ವಿಧೇಯಪೂರ್ವಕವಾಗಿ,", "ನಿಮ್ಮ ವಿಶ್ವಾಸಿ,"],
  subjectLabel: "ವಿಷಯ:",
  dateLabel: "ದಿನಾಂಕ:",
  toLabel: "ಪ್ರತಿ:",
  refLabel: "ಉಲ್ಲೇಖ:",
  commDated: "ನಿಮ್ಮ ಪತ್ರ ದಿನಾಂಕ:",
  signatureLabel: "(ಸಹಿ)",
  footer:
    "— ODA ನಿಂದ ನಿಮ್ಮ ಸಾಧನದಲ್ಲಿ ರಚಿಸಲಾಗಿದೆ · ಇನ್ಪುಟ್ನ ರಚನೆ, ಶೈಲಿ ಮತ್ತು ಉಲ್ಲೇಖಗಳನ್ನು ಪ್ರತಿಬಿಂಬಿಸುತ್ತದೆ",
  noteNeural:
    "ಕೆಳಗಿನ ಪಠ್ಯವನ್ನು ಮೂಲ ಭಾಷೆಯಲ್ಲಿ ಸಂರಕ್ಷಿಸಲಾಗಿದೆ. ಪೂರ್ಣ ಅನುವಾದಕ್ಕಾಗಿ ನ್ಯೂರಲ್ ಫೋರ್ಜ್ (ಉಚಿತ, ನಿಮ್ಮ ಸಾಧನದಲ್ಲಿ) ಸಕ್ರಿಯಗೊಳಿಸಿ.",
  body: {
    Complaint: [
      "ನಿಮ್ಮ ಪತ್ರದಲ್ಲಿ ಎತ್ತಿದ ದೂರುಗಳನ್ನು ನಾವು ಎಚ್ಚರಿಕೆಯಿಂದ ಪರಿಶೀಲಿಸಿದ್ದೇವೆ ಮತ್ತು ಉಂಟಾದ ಅನಾನುಕೂಲಕ್ಕೆ ವಿಷಾದ ವ್ಯಕ್ತಪಡಿಸುತ್ತೇವೆ.",
      "ನಿಮ್ಮ ದೂರನ್ನು ನಮ್ಮ ಕಚೇರಿಯಲ್ಲಿ ದಾಖಲಿಸಿ ತಕ್ಷಣದ ಪರಿಶೀಲನೆಗೆ ನಿಯೋಜಿಸಲಾಗಿದೆ. ಎತ್ತಿದ ಪ್ರತಿಯೊಂದು ಅಂಶದ ಕುರಿತು ಏಳು ಕೆಲಸದ ದಿನಗಳಲ್ಲಿ ವಿವರವಾದ ಕಾರ್ಯಯೋಜನೆ ನೀಡಲಾಗುವುದು. ಅಗತ್ಯವಿರುವಲ್ಲಿ ಸರಿಪಡಿಸುವ ಕ್ರಮಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳಲಾಗುವುದು.",
    ],
    "Legal Notice": [
      "ನಿಮ್ಮ ನೋಟಿಸ್ ಪಡೆದುಕೊಂಡ ದೃಢೀಕರಣವನ್ನು ನೀಡುತ್ತೇವೆ. ವಿಷಯವನ್ನು ಪರಿಶೀಲನೆಗಾಗಿ ಸೂಕ್ತ ಅಧಿಕಾರಿಯ ಮುಂದೆ ಇಡಲಾಗಿದೆ.",
      "ಕಾನೂನು ಮತ್ತು ಅನ್ವಯವಾಗುವ ಕಾರ್ಯವಿಧಾನದ ಪ್ರಕಾರ, ವಿವರವಾದ ಉತ್ತರವನ್ನು ನಿಗದಿತ ಅವಧಿಯೊಳಗೆ ನಮ್ಮ ವಕೀಲರ ಮೂಲಕ ತಿಳಿಸಲಾಗುವುದು ಎಂದು ಹೇಳಲು ನಮಗೆ ನಿರ್ದೇಶಿಸಲಾಗಿದೆ. ಈ ವಿಷಯದಲ್ಲಿ ನಮಗೆ ಲಭ್ಯವಿರುವ ಎಲ್ಲಾ ಹಕ್ಕುಗಳನ್ನು ನಾವು ಕಾಯ್ದಿರಿಸಿಕೊಳ್ಳುತ್ತೇವೆ.",
    ],
    "Invoice / Statement": [
      "ನಿಮ್ಮ ಹೇಳಿಕೆಯನ್ನು ಪಡೆದುಕೊಂಡಿದ್ದನ್ನು ಒಪ್ಪಿಕೊಳ್ಳುತ್ತೇವೆ ಮತ್ತು ವಿವರಗಳನ್ನು ನಮ್ಮ ದಾಖಲೆಗಳೊಂದಿಗೆ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ ಎಂದು ದೃಢೀಕರಿಸುತ್ತೇವೆ.",
      "ಯಾವುದೇ ವ್ಯತ್ಯಾಸ ಕಂಡುಬಂದರೆ ತಕ್ಷಣ ನಿಮ್ಮ ಗಮನಕ್ಕೆ ತರಲಾಗುವುದು. ದೃಢಪಡಿಸಿದ ಮೊತ್ತಗಳನ್ನು ಒಪ್ಪಿದ ಪಾವತಿ ನಿಯಮಗಳ ಪ್ರಕಾರ ಪ್ರಕ್ರಿಯಿಸಲಾಗುವುದು.",
    ],
    "Transfer / Order": [
      "ನಿಮ್ಮ ಪತ್ರ ಪಡೆದುಕೊಂಡಿದ್ದನ್ನು ಒಪ್ಪಿಕೊಳ್ಳುತ್ತೇವೆ. ವಿಷಯವನ್ನು ಗಮನಿಸಲಾಗಿದೆ ಮತ್ತು ಅಗತ್ಯ ಕ್ರಮವನ್ನು ಸಾಧ್ಯವಾದಷ್ಟು ಬೇಗ ಪ್ರಾರಂಭಿಸಲಾಗುತ್ತಿದೆ.",
      "ಪ್ರಗತಿಯ ಬಗ್ಗೆ ನಿಮಗೆ ತಿಳಿಸಲಾಗುವುದು. ಈ ವಿಷಯದಲ್ಲಿ ನಂತರದ ಪತ್ರವ್ಯವಹಾರವನ್ನು ಮೇಲಿನ ಉಲ್ಲೇಖದ ಮೂಲಕ ಮಾಡಿ.",
    ],
    "Circular / Notification": [
      "ಅಧಿಸೂಚನೆ ಪಡೆದುಕೊಂಡ ದೃಢೀಕರಣ ನೀಡಲಾಗುತ್ತದೆ. ಅನುಸರಣೆಗಾಗಿ ವಿಷಯವನ್ನು ಸರಿಯಾಗಿ ದಾಖಲಿಸಲಾಗಿದೆ.",
      "ಸಂಬಂಧಿಸಿದ ಎಲ್ಲರಿಗೂ ಅದರಲ್ಲಿನ ಸೂಚನೆಗಳನ್ನು ತಿಳಿಸಲಾಗಿದೆ ಮತ್ತು ಅಗತ್ಯವಿರುವಂತೆ ಅನುಸರಣೆ ವರದಿಗಳನ್ನು ಸಲ್ಲಿಸಲಾಗುವುದು.",
    ],
    Memo: [
      "ಜ್ಞಾಪನೆಯನ್ನು ಸ್ವೀಕರಿಸಲಾಗಿದೆ ಮತ್ತು ಅಗತ್ಯ ಕ್ರಮಕ್ಕಾಗಿ ಅದರ ವಿಷಯವನ್ನು ಫೈಲ್ನಲ್ಲಿ ದಾಖಲಿಸಲಾಗಿದೆ.",
      "ನಿಗದಿತ ಅವಧಿಯೊಳಗೆ ಜಾರಿ ಮಾಡಿದ ಕಚೇರಿಗೆ ಉತ್ತರವನ್ನು ನೀಡಲಾಗುವುದು. ವಿಷಯವು ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿದೆ ಎಂದು ಪರಿಗಣಿಸಿ.",
    ],
    "Request / Application": [
      "ನಿಮ್ಮ ಅರ್ಜಿಯನ್ನು ಪಡೆದುಕೊಂಡಿದ್ದನ್ನು ಒಪ್ಪಿಕೊಳ್ಳುತ್ತೇವೆ. ವಿನಂತಿಯನ್ನು ದಾಖಲಿಸಲಾಗಿದೆ ಮತ್ತು ಸಕ್ರಿಯ ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ.",
      "ಸಂಬಂಧಿತ ನಿಯಮಗಳಿಂದ ನಿಗದಿಪಡಿಸಿದ ಸಮಯದೊಳಗೆ, ಸಾಧ್ಯವಾದಷ್ಟು ಬೇಗ ನಿರ್ಧಾರವನ್ನು ನಿಮಗೆ ತಿಳಿಸಲಾಗುವುದು. ಅರ್ಜಿಯೊಂದಿಗೆ ಸಲ್ಲಿಸಿದ ದಾಖಲೆಗಳನ್ನು ಭದ್ರವಾಗಿ ಇಡಲಾಗಿದೆ.",
    ],
    Report: [
      "ವರದಿಯನ್ನು ಪಡೆದುಕೊಂಡಿದ್ದನ್ನು ಒಪ್ಪಿಕೊಳ್ಳುತ್ತೇವೆ ಮತ್ತು ಅದು ಸರಿಯಾಗಿ ಬಂದಿದೆ ಎಂದು ದೃಢೀಕರಿಸುತ್ತೇವೆ.",
      "ವಿಷಯವು ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ; ನಮ್ಮ ಅವಲೋಕನಗಳನ್ನು ಸೂಕ್ತ ಸಮಯದಲ್ಲಿ ನಿಮಗೆ ತಿಳಿಸಲಾಗುವುದು.",
    ],
    "Contract / Agreement": [
      "ಒಪ್ಪಂದವನ್ನು ಪಡೆದುಕೊಂಡಿದ್ದನ್ನು ಒಪ್ಪಿಕೊಳ್ಳುತ್ತೇವೆ. ನಿಯಮಗಳನ್ನು ಗಮನಿಸಲಾಗಿದೆ ಮತ್ತು ಸಂಬಂಧಿಸಿದ ವಿಭಾಗದಿಂದ ಪ್ರಕ್ರಿಯಿಸಲಾಗುತ್ತಿದೆ.",
      "ಯಾವುದೇ ಅವಲೋಕನಗಳು ಅಥವಾ ಪ್ರಸ್ತಾವಿತ ಮಾರ್ಪಾಡುಗಳನ್ನು ಲಿಖಿತವಾಗಿ ನಿಮ್ಮೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳಲಾಗುವುದು. ಅಲ್ಲಿಯವರೆಗೆ ದಾಖಲೆಯು ನಮ್ಮ ಫೈಲ್ಗಳಲ್ಲಿ ಉಳಿಯುತ್ತದೆ.",
    ],
    Letter: [
      "ನಿಮ್ಮ ಪತ್ರವನ್ನು ಪಡೆದುಕೊಂಡಿದ್ದನ್ನು ಒಪ್ಪಿಕೊಳ್ಳುತ್ತೇವೆ. ವಿಷಯವನ್ನು ದಾಖಲಿಸಲಾಗಿದೆ ಮತ್ತು ನಮ್ಮ ಗಮನ ಸೆಳೆಯುತ್ತಿದೆ.",
      "ಅಗತ್ಯ ಕ್ರಮವನ್ನು ಪ್ರಾರಂಭಿಸಲಾಗಿದೆ ಮತ್ತು ಫಲಿತಾಂಶದ ಬಗ್ಗೆ ಸಕಾಲದಲ್ಲಿ ನಿಮಗೆ ತಿಳಿಸಲಾಗುವುದು. ಭವಿಷ್ಯದ ಪತ್ರವ್ಯವಹಾರದಲ್ಲಿ ಮೇಲಿನ ಉಲ್ಲೇಖವನ್ನು ನಮೂದಿಸಿ.",
    ],
  },
};

const GU: LangKit = {
  greet: ["માનનીય સર/મેડમ,", "પ્રિય સર/મેડમ,"],
  close: ["વિનમ્રતાપૂર્વક,", "તમારો વિશ્વાસુ,"],
  subjectLabel: "વિષય:",
  dateLabel: "તારીખ:",
  toLabel: "પ્રતિ,",
  refLabel: "સંદર્ભ:",
  commDated: "તમારો પત્ર તારીખ:",
  signatureLabel: "(સહી)",
  footer:
    "— ODA દ્વારા તમારા ઉપકરણ પર બનાવવામાં આવ્યું · ઇનપુટની રચના, શૈલી અને સંદર્ભોનું અનુસરણ કરે છે",
  noteNeural:
    "નીચેનું લખાણ મૂળ ભાષામાં સાચવવામાં આવ્યું છે. સંપૂર્ણ અનુવાદ માટે ન્યુરલ ફોર્જ (મફત, તમારા ઉપકરણ પર) સક્રિય કરો.",
  body: {
    Complaint: [
      "તમારા પત્રમાં ઉઠાવેલી ફરિયાદોની અમે કાળજીપૂર્વક તપાસ કરી છે અને થયેલી અસુવિધા બદલ દિલગીરી વ્યક્ત કરીએ છીએ.",
      "તમારી ફરિયાદ અમારી કચેરીમાં નોંધાઈ ગઈ છે અને તાત્કાલિક તપાસ માટે સોંપવામાં આવી છે. ઉઠાવેલા દરેક મુદ્દા અંગે સાત કામકાજી દિવસોમાં વિગતવાર કાર્યયોજના આપવામાં આવશે. જ્યાં જરૂર પડે ત્યાં સુધારાત્મક પગલાં લેવાશે.",
    ],
    "Legal Notice": [
      "તમારી નોટિસ મળી હોવાની પુષ્ટિ કરીએ છીએ. બાબત તપાસ માટે યોગ્ય સત્તાધિકારી સમક્ષ મૂકવામાં આવી છે.",
      "કાયદા અને લાગુ પડતી કાર્યવાહી મુજબ, વિગતવાર જવાબ નિર્ધારિત સમયમર્યાદામાં અમારા વકીલ મારફતે આપવામાં આવશે તેમ જણાવવા અમને સૂચના મળી છે. આ બાબતે અમારા તમામ અધિકારો સુરક્ષિત રાખીએ છીએ.",
    ],
    "Invoice / Statement": [
      "તમારું સ્ટેટમેન્ટ મળ્યું હોવાનું સ્વીકારીએ છીએ અને ખાતરી આપીએ છીએ કે વિગતો અમારા રેકોર્ડ સાથે ચકાસવામાં આવી રહી છે.",
      "કોઈ તફાવત જણાય તો તરત તમારા ધ્યાન પર લાવવામાં આવશે. પુષ્ટિ થયેલી રકમો સંમત ચુકવણી શરતો મુજબ પ્રક્રિયા કરવામાં આવશે.",
    ],
    "Transfer / Order": [
      "તમારો પત્ર મળ્યો હોવાનું સ્વીકારીએ છીએ. બાબતની નોંધ લેવામાં આવી છે અને જરૂરી કાર્યવાહી વહેલી તકે શરૂ કરવામાં આવી રહી છે.",
      "પ્રગતિ અંગે તમને જાણ કરવામાં આવશે. આ બાબતે આગળનો પત્રવ્યવહાર ઉપરોક્ત સંદર્ભ દ્વારા કરો.",
    ],
    "Circular / Notification": [
      "નોટિસ મળી હોવાની પુષ્ટિ થાય છે. પાલન માટે બાબતની યોગ્ય નોંધ લેવામાં આવી છે.",
      "સંબંધિત તમામને તેમાંની સૂચનાઓથી વાકેફ કરવામાં આવ્યા છે અને જરૂર મુજબ અનુપાલન અહેવાલો રજૂ કરવામાં આવશે.",
    ],
    Memo: [
      "મેમો મળી ગયો છે અને જરૂરી કાર્યવાહી માટે તેની બાબત ફાઈલમાં નોંધવામાં આવી છે.",
      "નિર્ધારિત સમયમાં જારી કરનાર કચેરીને જવાબ મોકલવામાં આવશે. બાબત પ્રક્રિયામાં છે તેમ ગણો.",
    ],
    "Request / Application": [
      "તમારી અરજી મળી હોવાનું સ્વીકારીએ છીએ. વિનંતી નોંધવામાં આવી છે અને સક્રિય વિચારણા હેઠળ છે.",
      "સંબંધિત નિયમો દ્વારા નિર્ધારિત સમયમર્યાદામાં, અને શક્ય તેટલી વહેલી તકે નિર્ણય તમને જણાવવામાં આવશે. અરજી સાથે રજૂ કરેલા દસ્તાવેજો સુરક્ષિત રાખવામાં આવ્યા છે.",
    ],
    Report: [
      "અહેવાલ મળ્યો હોવાનું સ્વીકારીએ છીએ અને ખાતરી આપીએ છીએ કે તે વ્યવસ્થિત રીતે પ્રાપ્ત થયો છે.",
      "બાબત સમીક્ષા હેઠળ છે; અમારી ટિપ્પણીઓ યોગ્ય સમયમાં તમને જણાવવામાં આવશે.",
    ],
    "Contract / Agreement": [
      "કરાર મળ્યો હોવાનું સ્વીકારીએ છીએ. શરતોની નોંધ લેવામાં આવી છે અને સંબંધિત વિભાગ દ્વારા તેની કાર્યવાહી થઈ રહી છે.",
      "કોઈપણ ટિપ્પણી અથવા સૂચિત ફેરફાર લેખિતમાં તમારી સાથે શેર કરવામાં આવશે. ત્યાં સુધી દસ્તાવેજ અમારી ફાઈલોમાં નોંધાયેલો રહેશે.",
    ],
    Letter: [
      "તમારો પત્ર મળ્યો હોવાનું સ્વીકારીએ છીએ. બાબત નોંધવામાં આવી છે અને અમારું ધ્યાન મેળવી રહી છે.",
      "જરૂરી કાર્યવાહી શરૂ કરવામાં આવી છે અને પરિણામ અંગે સમયસર તમને જાણ કરવામાં આવશે. ભાવિ પત્રવ્યવહારમાં ઉપરોક્ત સંદર્ભ દર્શાવો.",
    ],
  },
};

const MR: LangKit = {
  greet: ["आदरणीय सर/मॅडम,", "प्रिय सर/मॅडम,"],
  close: ["विनम्रता,", "आपला विश्वासू,"],
  subjectLabel: "विषय:",
  dateLabel: "दिनांक:",
  toLabel: "प्रति,",
  refLabel: "संदर्भ:",
  commDated: "आपले पत्र दिनांक:",
  signatureLabel: "(सही)",
  footer:
    "— ODA द्वारे आपल्या डिव्हाइसवर तयार केले · इनपुटची रचना, शैली आणि संदर्भ प्रतिबिंबित करते",
  noteNeural:
    "खालील मजकूर स्रोत भाषेत जतन केला आहे. पूर्ण भाषांतरासाठी न्यूरल फोर्ज (मोफत, तुमच्या डिव्हाइसवर) सक्रिय करा.",
  body: {
    Complaint: [
      "आपल्या पत्रात मांडलेल्या तक्रारींची आम्ही काळजीपूर्वक तपासणी केली आहे आणि झालेल्या गैरसोयीबद्दल खेद व्यक्त करतो.",
      "आपली तक्रार आमच्या कार्यालयात नोंदवली गेली आहे आणि त्वरित तपासणीसाठी सोपवली गेली आहे. मांडलेल्या प्रत्येक मुद्द्यावर सात कामकाजी दिवसांत तपशीलवार कृती आराखडा देण्यात येईल. आवश्यक तेथे सुधारात्मक उपाययोजना केल्या जातील.",
    ],
    "Legal Notice": [
      "आपली नोटीस प्राप्त झाल्याची पुष्टी करतो. प्रकरण तपासणीसाठी योग्य प्राधिकाऱ्यांसमोर ठेवण्यात आले आहे.",
      "कायदा आणि लागू कार्यपद्धतीनुसार, निर्धारित कालावधीत आमच्या वकिलांमार्फत तपशीलवार उत्तर दिले जाईल, असे सांगण्याची सूचना आम्हाला मिळाली आहे. या संदर्भात आमचे सर्व हक्क राखून ठेवतो.",
    ],
    "Invoice / Statement": [
      "आपले विवरण प्राप्त झाल्याचे मान्य करतो आणि खात्री देतो की तपशील आमच्या नोंदींशी पडताळला जात आहे.",
      "काही तफावत आढळल्यास लगेच आपल्या निदर्शनास आणली जाईल. पुष्टी झालेल्या रकमा संमत देयक अटींनुसार प्रक्रिया केल्या जातील.",
    ],
    "Transfer / Order": [
      "आपले पत्र प्राप्त झाल्याचे मान्य करतो. मजकूराची नोंद घेतली गेली आहे आणि आवश्यक कारवाई लवकरात लवकर सुरू करण्यात येत आहे.",
      "प्रगतीची माहिती आपल्याला देत राहू. या प्रकरणातील पुढील पत्रव्यवहार वरील संदर्भाद्वारे करा.",
    ],
    "Circular / Notification": [
      "अधिसूचना प्राप्त झाल्याची पुष्टी केली जाते. पालनासाठी मजकूराची योग्य नोंद घेण्यात आली आहे.",
      "संबंधित सर्वांना त्यातील सूचनांची माहिती देण्यात आली आहे आणि आवश्यकतेनुसार अनुपालन अहवाल सादर केले जातील.",
    ],
    Memo: [
      "ज्ञापन प्राप्त झाले आहे आणि आवश्यक कारवाईसाठी त्याचा मजकूर फाइलमध्ये नोंदवला गेला आहे.",
      "निर्धारित कालावधीत जारी करणाऱ्या कार्यालयाला उत्तर पाठवले जाईल. प्रकरण प्रक्रियेत असल्याचे समजा.",
    ],
    "Request / Application": [
      "आपला अर्ज प्राप्त झाल्याचे मान्य करतो. विनंती नोंदवली गेली आहे आणि सक्रिय विचाराधीन आहे.",
      "संबंधित नियमांनी निर्धारित कालमर्यादेत आणि शक्य तितक्या लवकर निर्णय आपल्याला कळवला जाईल. अर्जासोबत सादर केलेली कागदपत्रे सुरक्षित ठेवण्यात आली आहेत.",
    ],
    Report: [
      "अहवाल प्राप्त झाल्याचे मान्य करतो आणि खात्री देतो की तो व्यवस्थित प्राप्त झाला आहे.",
      "मजकूर पुनरावलोकनाधीन आहे; आमच्या टिप्पण्या योग्य वेळेत आपल्याला कळवल्या जातील.",
    ],
    "Contract / Agreement": [
      "करार प्राप्त झाल्याचे मान्य करतो. अटींची नोंद घेतली गेली आहे आणि संबंधित विभागाकडून त्यावर प्रक्रिया केली जात आहे.",
      "कोणत्याही टिप्पण्या किंवा प्रस्तावित बदल लेखी स्वरूपात आपल्याशी शेअर केले जातील. तोपर्यंत दस्तऐवज आमच्या फाइल्समध्ये नोंदवलेला राहील.",
    ],
    Letter: [
      "आपले पत्र प्राप्त झाल्याचे मान्य करतो. प्रकरण नोंदवले गेले आहे आणि आमचे लक्ष वेधून घेत आहे.",
      "आवश्यक कारवाई सुरू केली गेली आहे आणि परिणामाची माहिती योग्य वेळी दिली जाईल. भविष्यातील पत्रव्यवहारात वरील संदर्भ नमूद करा.",
    ],
  },
};

export const KITS: Record<string, LangKit> = {
  English: EN,
  Hindi: HI,
  Tamil: TA,
  Bengali: BN,
  Telugu: TE,
  Kannada: KN,
  Gujarati: GU,
  Marathi: MR,
  Spanish: ES,
  French: FR,
  Arabic: AR,
};

export function kitFor(language: string): LangKit {
  return KITS[language] ?? EN;
}

// ---------------------------------------------------------------------------
// Structure analysis — reading the document's DNA
// ---------------------------------------------------------------------------

const TYPE_KEYWORDS: Array<{ type: string; keywords: string[] }> = [
  {
    type: "Complaint",
    keywords: [
      "complaint",
      "grievance",
      "dissatisfied",
      "unacceptable",
      "failed to",
      "negligence",
      "deficiency",
      "unhappy with",
    ],
  },
  {
    type: "Legal Notice",
    keywords: [
      "legal notice",
      "advocate",
      "counsel",
      "hereby notified",
      "cause of action",
      "legal action",
      "suit",
      "compensation for",
      "statutory",
    ],
  },
  {
    type: "Invoice / Statement",
    keywords: [
      "invoice",
      "statement of account",
      "amount due",
      "payment of",
      "outstanding",
      "bill no",
      "gst",
      "debit",
      "receipt",
    ],
  },
  {
    type: "Transfer / Order",
    keywords: [
      "transfer",
      "relieving",
      "l.c.-out",
      "lc out",
      "joining report",
      "posting order",
      "appointment order",
      "promotion order",
      "deputation",
    ],
  },
  {
    type: "Circular / Notification",
    keywords: [
      "circular",
      "notification",
      "office order",
      "in continuation",
      "all offices",
      "all departments",
      "guidelines",
      "instructions",
      "government order",
    ],
  },
  {
    type: "Memo",
    keywords: ["memo", "memorandum", "reminder", "internal note", "minutes of"],
  },
  {
    type: "Request / Application",
    keywords: [
      "request",
      "application",
      "kindly",
      "please grant",
      "seeking",
      "submitted for",
      "approval",
      "permission",
      "sanction",
    ],
  },
  {
    type: "Report",
    keywords: [
      "report",
      "findings",
      "summary of",
      "submitted herewith",
      "enclosed",
      "analysis",
      "review of",
    ],
  },
  {
    type: "Contract / Agreement",
    keywords: [
      "agreement",
      "contract",
      "terms and conditions",
      "party of the first part",
      "hereby agree",
      "clause",
    ],
  },
];

export function classifyType(text: string, name: string): string {
  const haystack = `${name}\n${text}`.toLowerCase();
  for (const { type, keywords } of TYPE_KEYWORDS) {
    if (keywords.some((k) => haystack.includes(k))) return type;
  }
  return "Letter";
}

function firstLineMatching(lines: string[], re: RegExp): string | null {
  for (const line of lines) {
    const m = line.match(re);
    if (m) return line;
  }
  return null;
}

function findSubject(lines: string[]): string | null {
  const subj = firstLineMatching(
    lines,
    /^(subject|regarding|re|ref|reference)\s*[:#]\s*(.+)$/i,
  );
  if (subj) {
    return subj
      .replace(/^(subject|regarding|re|ref|reference)\s*[:#]\s*/i, "")
      .trim();
  }
  const candidate = lines.find(
    (l) =>
      l.length > 8 &&
      l.length < 90 &&
      !/[.!?]$/.test(l) &&
      /^[A-Z0-9\u0900-\u097F\u0B80-\u0BFF\u0B00-\u0B7F]/.test(l),
  );
  return candidate ?? null;
}

function findReference(text: string): string | null {
  const m = text.match(
    /(?:no\.?|ref\.?|reg\.?|letter no\.?|file no\.?)\s*[:#]?\s*[A-Za-z0-9][A-Za-z0-9\/\-\._ ]{2,30}/i,
  );
  return m ? m[0].trim() : null;
}

function findDate(text: string): string | null {
  const m = text.match(
    /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}-\d{2}-\d{2}|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b)/i,
  );
  return m ? m[0] : null;
}

// ---------------------------------------------------------------------------
// Response composition
// ---------------------------------------------------------------------------

export function adaptiveGenerate(doc: AdaptiveDoc, opts: AdaptiveOptions): AdaptiveResult {
  const text = (doc.text ?? "").trim();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const type = doc.type ?? classifyType(text, doc.name);
  const kit = kitFor(opts.language);
  const formal = opts.formality !== "Informal";
  const greet = kit.greet[formal ? 0 : 1];
  const close = kit.close[formal ? 0 : 1];
  const subject = findSubject(lines) ?? lines.find((l) => l.length > 8) ?? "your communication";
  const reference = findReference(text);
  const date = findDate(text);
  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const toLine = firstLineMatching(lines, /^to[,:]?\s+(.+)$/i);
  const recipient =
    (toLine ? toLine.replace(/^to[,:]?\s+/i, "") : null) ??
    firstLineMatching(lines, /^(the|dr|mr|mrs|ms|shri|smt)\.?\s/i) ??
    "The Concerned Authority";
  const summary = lines
    .filter((l) => l.length > 12 && !/^(subject|ref|reg|no\.?|dear|to[,:]?|from)/i.test(l))
    .slice(0, 2)
    .join(" ")
    .slice(0, 240);

  const bodyPair: string[] = [...(kit.body[type] ?? kit.body.Letter)];
  const body = bodyPair.map((p) => {
    if (summary) return p.split("%s").join(summary);
    // No quotable summary — drop the placeholder (and its lead-in phrase).
    return p
      .replace(/\s+(?:regarding|concerning|on the subject|titled|on)\s+"%s"/g, "")
      .split("%s")
      .join("")
      .trim();
  });

  const out: string[] = [];
  out.push(`${kit.dateLabel} ${today}`);
  out.push("");
  out.push(kit.toLabel);
  out.push(recipient);
  out.push("");
  out.push(`${kit.subjectLabel} ${subject}`);
  if (reference) out.push(`${kit.refLabel} ${reference}`);
  if (date) out.push(`${kit.commDated} ${date}`);
  out.push("");
  out.push(greet);
  out.push("");
  out.push(...body);
  out.push("");
  out.push(close);
  out.push("");
  out.push(kit.signatureLabel);
  out.push("");
  out.push(kit.footer);

  return {
    content: out.join("\n"),
    strategy: "adaptive",
  };
}
