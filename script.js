// ⚠️ مفتاح OpenAI
const OPENAI_KEY = "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";

// 🔑 مفتاح ElevenLabs
const ELEVENLABS_API_KEY = "sk_f88df2916f664b1f1ec47e686315bc9675470c419477e0e1";

// 🎵 أصوات ElevenLabs لكل لغة
const VOICES = {
  arabic: "pNInz6obpgDQGcFmaJgB",  // Josh - أفضل للعربية
  english: "pNInz6obpgDQGcFmaJgB", // Adam
  french: "VR6AewLTigWG4xSOukaG"   // Arnold
};

// 📌 رابط Google Apps Script
const SHEET_API = "https://script.google.com/macros/s/AKfycbyqQ40HxHMqu7DHOMfAKftfDsZUq_wnlX5niJaE-H2rEWrZTSDGdpRljw2CSb2Xqp7ELQ/exec";

const video = document.getElementById('avatar-video');
const questionEl = document.getElementById('question');
const answerEl = document.getElementById('answer');

// 📝 قاعدة بيانات الأسئلة الخاصة
const customQA = {
  "مرحبا": "الحمد لله، أنا بخير ",
  "كيف حالك": "أنا بخير الحمد لله ",
  "من أنت": "أنا مساعد الأستاذ الباهي المهدي في مادة الفلسفة، يمكنك طرح أي سؤال في الفلسفة وأنا أجيب. صراحة المهدي أستاذ جيد في مادة الفلسفة.",
  "من هو مطور ك": "الذي قام بتطويري وبرمجتي هو ميمو طويري (عبدالكريم). قام بتطويري باستخدام تقنيات متعددة وأطر عمل مثل Svelte، ومكتبات مثل TailwindCSS و Express.js. فعلاً هو مطور احترافي ",
  "من هو ميمو طويري": "ميمو طويري هو مبرمج مختص في تطوير التطبيقات والمواقع، وله كفاءة عالية في هذا المجال. وهو من قام بتطويري. حقاً يستحق كل الشكر والتقدير على مجهوداته المبذولة ",
  "في ماذا تختص": "أختص في مادة الفلسفة بشكل خاص، لكنني معمم لأنني نموذج ذكاء اصطناعي."
};

// ✅ التحقق من الأسئلة الخاصة
function checkCustomQA(question) {
  const lower = question.trim().toLowerCase();
  for (let key in customQA) {
    if (lower.includes(key.toLowerCase())) {
      return customQA[key];
    }
  }
  return null;
}

// 🗄️ حفظ في Google Sheets
async function saveToSheet(question, answer) {
  try {
    await fetch(SHEET_API, {
      method: "POST",
      body: JSON.stringify({ 
        "السؤال": question, 
        "الجواب": answer 
      }),
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("❌ خطأ أثناء الحفظ في Google Sheets:", err);
  }
}

// تنظيف النص قبل النطق
function cleanForSpeak(text) {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '') 
    .replace(/<code>[\s\S]*?<\/code>/gi, '')
    .replace(/<pre>[\s\S]*?<\/pre>/gi, '')
    .replace(/[*#_.!?؟!~`'"\\/\[\]\(\)\-]/g, '') 
    .trim();
}

// 🔍 كشف اللغة وتحديد الصوت المناسب
function detectLanguageAndVoice(text) {
  const arabic = /[\u0600-\u06FF]/;
  const french = /[àâçéèêëîïôûùüÿœ]/i;
  
  if (arabic.test(text)) {
    return { voiceId: VOICES.arabic, language: "ar" };
  } else if (french.test(text)) {
    return { voiceId: VOICES.french, language: "fr" };
  } else {
    return { voiceId: VOICES.english, language: "en" };
  }
}

// 🔊 نطق النص باستخدام ElevenLabs مع الصوت المناسب
async function speak(text) {
  const clean = cleanForSpeak(text);
  if (!clean) return;
  
  stopSpeaking();

  // تحديد الصوت المناسب حسب اللغة
  const { voiceId, language } = detectLanguageAndVoice(text);
  console.log(`🎵 استخدام الصوت: ${voiceId} للغة: ${language}`);

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        "text": clean,
        "model_id": "eleven_multilingual_v2", // ⚠️ مهم: النموذج متعدد اللغات
        "voice_settings": {
          "stability": 0.5,
          "similarity_boost": 0.8,
          "style": 0.0,
          "use_speaker_boost": true
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs error: ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    // تشغيل الفيديو أثناء الصوت
    audio.onplay = () => {
      if (video) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    };

    // إيقاف الفيديو عند انتهاء الصوت
    audio.onended = audio.onpause = () => {
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
      URL.revokeObjectURL(audioUrl);
    };

    await audio.play();

  } catch (error) {
    console.error("❌ خطأ في ElevenLabs:", error);
    // استرجاع النظام القديم كنسخة احتياطية
    backupTTS(clean);
  }
}

// 🎯 نظام TTS احتياطي إذا فشل ElevenLabs
function backupTTS(text) {
  window.speechSynthesis.cancel();
  
  const detectLanguage = (text) => {
    const arabic = /[\u0600-\u06FF]/;
    const french = /[àâçéèêëîïôûùüÿœ]/i;
    if (arabic.test(text)) return "ar-SA";
    if (french.test(text)) return "fr-FR";
    return "en-US";
  };

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = detectLanguage(text);
  
  // البحث عن صوت يدعم العربية
  const voices = window.speechSynthesis.getVoices();
  let foundVoice = null;
  
  if (utter.lang.startsWith('ar')) {
    foundVoice = voices.find(v => v.lang.startsWith('ar') || v.lang.includes('arabic'));
  }
  
  if (!foundVoice) {
    foundVoice = voices.find(v => v.lang.startsWith(utter.lang.split('-')[0]));
  }
  
  if (foundVoice) {
    utter.voice = foundVoice;
    console.log(`🎤 استخدام الصوت الاحتياطي: ${foundVoice.name}`);
  }

  let speaking = false;
  utter.onstart = () => {
    speaking = true;
    if (video) { 
      video.currentTime = 0; 
      video.play().catch(()=>{}); 
    }
    (function sync() {
      if (!speaking) return;
      if (video && video.paused) video.play().catch(()=>{});
      requestAnimationFrame(sync);
    })();
  };
  
  utter.onend = utter.oncancel = () => {
    speaking = false;
    if (video) { 
      video.pause(); 
      video.currentTime = 0; 
    }
  };

  window.speechSynthesis.speak(utter);
}

// 🛑 إيقاف الصوت والفيديو
function stopSpeaking() {
  window.speechSynthesis.cancel();
  if (video) {
    video.pause();
    video.currentTime = 0;
  }
}

// تأثير الكتابة
function typeWriterEffect(text, targetEl, speed=30) {
  targetEl.innerText = '';
  let i=0;
  (function type(){
    if (i < text.length) {
      targetEl.innerText += text.charAt(i++);
      targetEl.scrollTop = targetEl.scrollHeight;
      setTimeout(type, speed);
    }
  })();
}

// 🧠 سؤال API
async function askAPI(question) {
  // ✅ تحقق من الأسئلة الخاصة أولاً
  const customAnswer = checkCustomQA(question);
  if (customAnswer) {
    typeWriterEffect(customAnswer, answerEl);
    speak(customAnswer);
    saveToSheet(question, customAnswer);
    return;
  }

  // إذا لم يكن سؤال خاص → استدعاء OpenAI
  answerEl.innerHTML = '<span class="loader"></span> <span>جاري التفكير...</span>';
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: `أنت مساعد ذكي اسمك عطية. 
ارد دائماً بنفس لغة المستخدم:
- إذا سألك بالعربية، أجب بالعربية
- إذا سألك بالإنجليزية، أجب بالإنجليزية  
- إذا سألك بالفرنسية، أجب بالفرنسية
اجعل إجاباتك مختصرة وواضحة.`
          },
          { role: "user", content: question }
        ],
      }),
    });

    const data = await res.json();
    console.log("API Response:", data);

    if (data.error) {
      answerEl.innerText = "⚠️ خطأ من API: " + data.error.message;
      return;
    }

    const answer = data.choices[0].message.content;
    typeWriterEffect(answer, answerEl);
    speak(answer);
    saveToSheet(question, answer);

  } catch (err) {
    console.error(err);
    answerEl.innerText = "⚠️ خطأ بالاتصال مع API";
  }
}

// الأزرار
document.getElementById('btn-send').addEventListener('click', () => {
  const txt = questionEl.value.trim();
  if (!txt) return;
  askAPI(txt);
});

document.getElementById('btn-stop').addEventListener('click', () => {
  stopSpeaking();
  recognitionAbort();
});

document.getElementById('btn-reload').addEventListener('click', () => {
  questionEl.value = '';
  answerEl.innerText = '';
  stopSpeaking();
  location.reload();
});

// 🎤 التعرف على الكلام
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
let recognition = null;
let recognitionActive = false;

function recognitionAbort() {
  if (recognition && recognitionActive) {
    try { recognition.stop(); } catch(e){}
    recognitionActive = false;
  }
}

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "ar-SA";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    recognitionActive = true;
    answerEl.innerHTML = '<span class="loader"></span> <span>أستمع... تكلّم الآن</span>';
  };
  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    questionEl.value = text;
    askAPI(text);
  };
  recognition.onerror = (ev) => {
    recognitionActive = false;
    answerEl.innerText = 'خطأ: ' + (ev.error || 'غير معروف');
  };
  recognition.onend = () => recognitionActive = false;
} else {
  document.getElementById('btn-record').disabled = true;
  document.getElementById('btn-record').title = 'المتصفح لا يدعم التعرف على الكلام';
}

document.getElementById('btn-record').addEventListener('click', () => {
  stopSpeaking();
  if (!SpeechRecognition) {
    answerEl.innerText = 'متصفحك لا يدعم SpeechRecognition';
    return;
  }
  try { recognition.start(); } catch(e) {
    try { recognition.stop(); recognition.start(); } catch(err){}
  }
});

// رسالة ترحيب
typeWriterEffect("أهلاً! اضغط 'تحدث' أو اكتب ثم اضغط إرسال.", answerEl, 20);