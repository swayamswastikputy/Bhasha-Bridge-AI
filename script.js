let recognition = null;
let listening = false;
let lastTranslation = "";
let baseText = "";
let finalResults = [];

const langMap = {
  en:"en-US", hi:"hi-IN", bn:"bn-IN", or:"or-IN", ur:"ur-IN",
  sat:"sat-IN", unr:"unr-IN", hoc:"hoc-IN", kru:"kru-IN", kha:"kha-IN",
  nag:"nag-IN", kfy:"kfy-IN", kho:"kho-IN", ppg:"ppg-IN",
  ta:"ta-IN", te:"te-IN", mr:"mr-IN"
};
const languageNames = {
  en:"English", hi:"Hindi", bn:"Bengali", or:"Odia", ur:"Urdu",
  sat:"Santali", unr:"Mundari", hoc:"Ho", kru:"Kurukh", kha:"Kharia",
  nag:"Nagpuri", kfy:"Kurmali", kho:"Khortha", ppg:"Panchpargania",
  ta:"Tamil", te:"Telugu", mr:"Marathi"
};

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.style.display = "none", 2500);
}

function toggleListening() {
  listening ? stopListening() : startVoice();
}

/*
  Clean recognition glitches such as:
  "hello hello what what is your name"
  -> "hello what is your name"

  It collapses only immediately repeated words/phrases. This is a safety
  layer because mobile Web Speech API can itself return duplicated tokens.
*/
function cleanTranscript(text) {
  let words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);

  // Repeat until no adjacent duplicate word or phrase remains.
  let changed = true;
  while (changed) {
    changed = false;

    // Adjacent duplicate phrases, longest first (up to 5 words).
    for (let size = Math.min(5, Math.floor(words.length / 2)); size >= 1; size--) {
      for (let i = 0; i + size * 2 <= words.length; i++) {
        const a = words.slice(i, i + size).join(" ").toLowerCase();
        const b = words.slice(i + size, i + size * 2).join(" ").toLowerCase();
        if (a === b) {
          words.splice(i + size, size);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return words.join(" ");
}

function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showToast("Please use Chrome for live speech recognition.");
    return;
  }

  const input = document.getElementById("inputText");

  // Start a completely fresh transcript. User can edit manually after stopping.
  baseText = "";
  finalResults = [];
  input.value = "";

  recognition = new SR();
  recognition.lang = langMap[document.getElementById("sourceLanguage").value] || "en-US";

  // One continuous recognition session: no manual restart loop.
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    // Store each FINAL result by its native result index.
    // Never append the same event text twice.
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalResults[i] = event.results[i][0].transcript.trim();
      }
    }

    const sessionText = cleanTranscript(finalResults.filter(Boolean).join(" "));
    input.value = cleanTranscript([baseText, sessionText].filter(Boolean).join(" "));
    document.getElementById("micStatus").textContent = "● LISTENING LIVE";
  };

  recognition.onerror = (event) => {
    if (event.error === "no-speech" || event.error === "aborted") return;
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      stopListening();
      showToast("Please allow microphone permission.");
      return;
    }
    console.warn("Speech recognition error:", event.error);
  };

  recognition.onend = () => {
    // Do NOT auto-restart. Auto-restarts were creating duplicate sessions.
    if (listening) {
      listening = false;
      document.body.classList.remove("listening");
      document.getElementById("startBtn").textContent = "🎤 Start Listening";
      document.getElementById("micStatus").textContent = "● READY";
      document.getElementById("inputText").value = cleanTranscript(
        [baseText, finalResults.filter(Boolean).join(" ")].filter(Boolean).join(" ")
      );
    }
  };

  listening = true;
  try {
    recognition.start();
    document.body.classList.add("listening");
    document.getElementById("startBtn").textContent = "⏹ Stop Listening";
    document.getElementById("micStatus").textContent = "● LISTENING LIVE";
    showToast("Listening started. Speak naturally.");
  } catch (e) {
    listening = false;
    showToast("Microphone could not be started.");
  }
}

function stopListening() {
  listening = false;
  if (recognition) {
    try { recognition.stop(); } catch (e) {}
  }
  document.body.classList.remove("listening");
  document.getElementById("startBtn").textContent = "🎤 Start Listening";
  document.getElementById("micStatus").textContent = "● READY";
  document.getElementById("inputText").value = cleanTranscript(
    [baseText, finalResults.filter(Boolean).join(" ")].filter(Boolean).join(" ")
  );
}

async function translateLesson() {
  const text = document.getElementById("inputText").value.trim();
  const src = document.getElementById("sourceLanguage").value;
  const tgt = document.getElementById("targetLanguage").value;
  const status = document.getElementById("translationStatus");
  const out = document.getElementById("translationResult");

  if (!text) {
    showToast("Enter or speak text first.");
    return;
  }

  if (src === tgt) {
    lastTranslation = text;
    out.textContent = text;
    status.textContent = "✓ Same-language mode.";
    return;
  }

  out.textContent = "Translating...";
  status.textContent = "Using context-aware translation...";

  // Primary translator: Google's public translation endpoint.
  // This gives significantly better Hindi sentence translation than MyMemory
  // for short educational sentences used in this prototype.
  try {
    const googleUrl =
      "https://translate.googleapis.com/translate_a/single?client=gtx" +
      "&sl=" + encodeURIComponent(src) +
      "&tl=" + encodeURIComponent(tgt) +
      "&dt=t&q=" + encodeURIComponent(text);

    const response = await fetch(googleUrl);
    if (!response.ok) throw new Error("Primary translator unavailable");

    const data = await response.json();
    const translated = Array.isArray(data?.[0])
      ? data[0].map(part => part?.[0] || "").join("").trim()
      : "";

    if (!translated) throw new Error("Empty translation");

    lastTranslation = translated;
    out.textContent = translated;
    status.textContent = "✓ Accurate translation completed.";
    showToast("Translation completed!");
    return;
  } catch (primaryError) {
    console.warn("Primary translation failed:", primaryError);
  }

  // Secondary fallback.
  try {
    const fallbackUrl =
      "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(text) +
      "&langpair=" + encodeURIComponent(src + "|" + tgt);

    const response = await fetch(fallbackUrl);
    const data = await response.json();
    const translated = data?.responseData?.translatedText?.trim();

    if (!translated) throw new Error("No fallback translation");

    // Decode any HTML entities returned by the fallback service.
    const decoder = document.createElement("textarea");
    decoder.innerHTML = translated;
    lastTranslation = decoder.value;

    out.textContent = lastTranslation;
    status.textContent = "✓ Translation completed using backup service.";
    showToast("Translation completed!");
  } catch (error) {
    console.error("Translation error:", error);
    out.textContent = "Translation service is temporarily unavailable. Please try again.";
    lastTranslation = "";
    status.textContent = "⚠ Unable to connect to translation service.";
    showToast("Translation failed. Check your internet connection.");
  }
}

function speakResult() {
  const text = lastTranslation || document.getElementById("translationResult").innerText;

  if (!text || text.includes("appear here")) {
    showToast("Translate text first.");
    return;
  }

  speechSynthesis.cancel();
  const code = document.getElementById("targetLanguage").value;
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();

  utterance.voice = voices.find((voice) => voice.lang.toLowerCase().startsWith(code)) || null;
  utterance.lang = langMap[code] || code;
  utterance.rate = 0.9;
  utterance.pitch = 1;
  speechSynthesis.speak(utterance);
}

speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();

function copyResult() {
  const text = lastTranslation || document.getElementById("translationResult").innerText;
  navigator.clipboard.writeText(text);
  showToast("Copied to clipboard.");
}

function loadVideo(input) {
  const file = input.files[0];
  if (!file) return;

  const video = document.getElementById("videoPreview");
  video.src = URL.createObjectURL(file);
  video.style.display = "block";
  document.getElementById("videoMeta").textContent = `Loaded: ${file.name} • ${(file.size / 1048576).toFixed(2)} MB`;
  showToast("Video loaded successfully.");
}

async function processVideo() {
  const file = document.getElementById("videoFile").files[0];
  const box = document.getElementById("videoProgress");

  if (!file) {
    showToast("Upload a video first.");
    return;
  }

  const steps = [
    "⏳ Preparing video...",
    "📝 Step 1/4: Speech-to-text stage ready",
    "🌐 Step 2/4: Target-language translation stage ready",
    "🔊 Step 3/4: Native voice synthesis stage ready",
    "⚙️ Step 4/4: Audio timing + FFmpeg dubbing stage ready"
  ];

  for (const step of steps) {
    box.textContent = step;
    await wait(650);
  }

  box.textContent = "✅ Frontend workflow prepared. Connect a secure backend for real Whisper transcription, translation, neural TTS and FFmpeg video rendering.";
  showToast("Video translation pipeline prepared.");
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function quickAsk(question) {
  document.getElementById("question").value = question;
  askAI();
}

function askAI() {
  const input = document.getElementById("question");
  const question = input.value.trim();
  if (!question) return;

  const chat = document.getElementById("chat");
  chat.insertAdjacentHTML("beforeend", `<div class="message user">${question.replace(/[<>]/g, "")}</div>`);

  const q = question.toLowerCase();
  let answer;

  if (q.includes("example")) {
    answer = "Example: A mango tree needs sunlight, water, air and nutrients to grow.";
  } else if (q.includes("why")) {
    answer = "It helps us understand the idea and connect it to real life.";
  } else {
    answer = "Let me explain simply: break the lesson into small ideas, understand each one, then practice with an example.";
  }

  setTimeout(() => {
    chat.insertAdjacentHTML("beforeend", `<div class="message bot">🤖 ${answer}</div>`);
    chat.scrollTop = chat.scrollHeight;
  }, 350);

  input.value = "";
}

// ---------------- INFINITE ADAPTIVE QUIZ ENGINE ----------------
let score = 0;
let answered = 0;
let streak = 0;
let quizDifficulty = "easy";

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function setQuizDifficulty(level) {
  quizDifficulty = level;
  const label = document.getElementById("quizLevel");
  if (label) label.textContent = "Level: " + level.charAt(0).toUpperCase() + level.slice(1);
  generateQuiz();
}

function makeMathQuestion() {
  const hard = quizDifficulty === "medium";
  const a = rand(hard ? 10 : 1, hard ? 99 : 20);
  const b = rand(hard ? 5 : 1, hard ? 50 : 20);
  const op = shuffle(["+", "-", "×"])[0];
  let answer = op === "+" ? a + b : op === "-" ? a - b : a * b;
  const question = op === "-" && b > a
    ? `What is ${b} - ${a}?`
    : `What is ${a} ${op} ${b}?`;
  if (op === "-" && b > a) answer = b - a;
  return { question, answer: String(answer), subject:"Mathematics" };
}

const knowledgeBank = [
  {q:"What is the main source of energy for Earth?", a:"The Sun", subject:"Science"},
  {q:"Which part of a plant absorbs water from soil?", a:"Roots", subject:"Science"},
  {q:"Which gas do plants use during photosynthesis?", a:"Carbon dioxide", subject:"Science"},
  {q:"How many days are there in a leap year?", a:"366", subject:"Mathematics"},
  {q:"What is the capital of Jharkhand?", a:"Ranchi", subject:"Social Science"},
  {q:"Which mineral-rich state is Jharkhand known for?", a:"Jharkhand", subject:"Social Science"},
  {q:"What should we do before eating food?", a:"Wash hands", subject:"EVS"},
  {q:"Which organ pumps blood through the body?", a:"Heart", subject:"Science"},
  {q:"What is the opposite of 'hot'?", a:"Cold", subject:"English"},
  {q:"Which season brings heavy rainfall in India?", a:"Monsoon", subject:"EVS"},
  {q:"How many continents are there?", a:"7", subject:"Geography"},
  {q:"Which shape has three sides?", a:"Triangle", subject:"Mathematics"},
  {q:"What do we call a baby plant?", a:"Seedling", subject:"Science"},
  {q:"Which direction does the Sun generally rise from?", a:"East", subject:"EVS"},
  {q:"What is 5 × 5?", a:"25", subject:"Mathematics"},
  {q:"Which is a renewable source of energy?", a:"Solar energy", subject:"Science"},
  {q:"What is the national animal of India?", a:"Tiger", subject:"General Knowledge"},
  {q:"Which language is written in Devanagari script?", a:"Hindi", subject:"Language"}
];

function makeKnowledgeQuestion() {
  const item = knowledgeBank[rand(0, knowledgeBank.length - 1)];
  const distractors = shuffle(knowledgeBank
    .map(x => x.a)
    .filter(a => a !== item.a && a.length < 30)
  ).slice(0,3);
  return { question:item.q, answer:item.a, subject:item.subject, distractors };
}

function buildOptions(answer, distractors = []) {
  const pool = [...new Set([answer, ...distractors])];
  while (pool.length < 4) pool.push(String(rand(1, 100)));
  return shuffle(pool.slice(0,4));
}

function generateQuestion() {
  if (Math.random() < 0.45) {
    const item = makeMathQuestion();
    const ans = Number(item.answer);
    return {
      ...item,
      options: buildOptions(item.answer, [
        String(ans + rand(1, 9)),
        String(Math.max(0, ans - rand(1, 9))),
        String(ans + rand(10, 20))
      ])
    };
  }
  const item = makeKnowledgeQuestion();
  return {...item, options:buildOptions(item.answer, item.distractors)};
}

function generateQuiz() {
  score = 0;
  const questions = Array.from({length: 5}, generateQuestion);
  const container = document.getElementById("quizContainer");

  container.innerHTML = questions.map((item, index) => `
    <div class="quiz-card" data-answer="${encodeURIComponent(item.answer)}">
      <div class="question-tag">${item.subject} • Question ${index + 1}</div>
      <b>Q${index + 1}. ${item.question}</b>
      <div class="options">
        ${item.options.map(option => `
          <button class="option" data-value="${encodeURIComponent(option)}" onclick="checkAnswer(this)">${option}</button>
        `).join("")}
      </div>
    </div>
  `).join("");

  document.getElementById("scoreBox").textContent = "Answer all 5 questions to complete this round.";
}

function checkAnswer(button) {
  const card = button.closest(".quiz-card");
  if (card.dataset.done) return;

  card.dataset.done = "1";
  answered++;

  const correct = decodeURIComponent(card.dataset.answer);
  const selected = decodeURIComponent(button.dataset.value);
  const isCorrect = selected.trim().toLowerCase() === correct.trim().toLowerCase();

  card.querySelectorAll(".option").forEach(option => {
    option.disabled = true;
    if (decodeURIComponent(option.dataset.value).trim().toLowerCase() === correct.trim().toLowerCase()) {
      option.classList.add("correct");
    }
  });

  if (isCorrect) {
    score++;
    streak++;
    showToast("Correct! 🔥 Streak " + streak);
  } else {
    streak = 0;
    button.classList.add("wrong");
    showToast("Correct answer: " + correct);
  }

  document.getElementById("quizStreak").textContent = "🔥 Streak: " + streak;
  document.getElementById("quizTotal").textContent = "Questions answered: " + answered;

  const done = document.querySelectorAll(".quiz-card[data-done='1']").length;
  if (done === 5) {
    document.getElementById("scoreBox").innerHTML =
      `Round complete: ${score}/5 ⭐ <button class="primary" onclick="generateQuiz()">Generate 5 New Questions →</button>`;
  }
}

// ---------------- JHARKHAND CURRICULUM EXPLORER ----------------
// Topic maps are a learning-practice layer. Official syllabus/textbook links
// are exposed in the UI so the prototype can be kept aligned with JCERT/JAC.
const curriculumMap = {
  primary:["Language & Literacy","Mathematics","EVS","Art & Culture","Physical Education"],
  middle:["Hindi / Regional Language","English","Mathematics","Science","Social Science","Computer & Digital Literacy"],
  secondary:["Hindi / Regional Language","English","Mathematics","Science","Social Science","Vocational / Skill Education"],
  senior:["Languages","Physics","Chemistry","Biology","Mathematics","History","Geography","Political Science","Economics","Commerce"]
};

const topicMap = {
  "Mathematics":["Number sense","Arithmetic","Fractions","Geometry","Measurement","Data handling","Problem solving"],
  "Science":["Living world","Matter","Force and motion","Energy","Environment","Scientific inquiry"],
  "EVS":["Family and community","Food","Water","Plants and animals","Health","Environment"],
  "Social Science":["History","Geography","Civics","Economy","Jharkhand heritage"],
  "Hindi / Regional Language":["Reading","Writing","Grammar","Vocabulary","Storytelling","Local culture"],
  "Language & Literacy":["Listening","Speaking","Reading","Writing","Vocabulary","Comprehension"],
  "English":["Listening","Speaking","Reading","Writing","Grammar","Vocabulary"],
  "Physics":["Motion","Force","Work and energy","Light","Electricity","Modern physics"],
  "Chemistry":["Matter","Atoms","Chemical reactions","Acids and bases","Carbon compounds"],
  "Biology":["Cell","Life processes","Genetics","Ecology","Human health"],
  "History":["Ancient India","Medieval India","Modern India","Jharkhand history"],
  "Geography":["Resources","Climate","Maps","India","Jharkhand geography"],
  "Political Science":["Constitution","Democracy","Rights","Government"],
  "Economics":["Development","Resources","Markets","Public finance"],
  "Commerce":["Accounting","Business studies","Economics","Entrepreneurship"]
};

function getStage(cls) {
  const n = Number(cls);
  if (n <= 5) return "primary";
  if (n <= 8) return "middle";
  if (n <= 10) return "secondary";
  return "senior";
}

function initializeCurriculum() {
  const classSelect = document.getElementById("classSelect");
  const subjectSelect = document.getElementById("subjectSelect");
  if (!classSelect || !subjectSelect) return;

  classSelect.innerHTML = Array.from({length:12}, (_,i) =>
    `<option value="${i+1}">Class ${i+1}</option>`
  ).join("");

  function loadSubjects() {
    const stage = getStage(classSelect.value);
    subjectSelect.innerHTML = curriculumMap[stage]
      .map(s => `<option value="${s}">${s}</option>`).join("");
  }

  classSelect.addEventListener("change", () => {
    loadSubjects();
    renderCurriculum();
  });
  loadSubjects();
  renderCurriculum();
}

function renderCurriculum() {
  const cls = document.getElementById("classSelect");
  const subject = document.getElementById("subjectSelect");
  const result = document.getElementById("curriculumResult");
  if (!cls || !subject || !result) return;

  const topics = topicMap[subject.value] ||
    (subject.value.includes("Regional") ? topicMap["Hindi / Regional Language"] :
      ["Core concepts","Reading and understanding","Practice","Application","Assessment"]);

  result.innerHTML = `
    <div class="curriculum-head">
      <span class="curriculum-badge">Class ${cls.value}</span>
      <h3>${subject.value}</h3>
    </div>
    <p>Suggested learning and practice areas for BhashaBridge AI:</p>
    <div class="topic-grid">
      ${topics.map((t,i)=>`<div class="topic-card"><b>${String(i+1).padStart(2,"0")}</b><span>${t}</span></div>`).join("")}
    </div>
    <div class="regional-note">🌍 Mother-tongue support layer: Hindi, Urdu, Bengali, Odia, Santali, Mundari, Ho, Kurukh, Kharia, Nagpuri, Kurmali, Khortha and Panchpargania are available in the language selector. Full curriculum content should be synced against official JCERT/J-Guruji resources before production deployment.</div>
  `;
}

document.addEventListener("DOMContentLoaded", initializeCurriculum);
