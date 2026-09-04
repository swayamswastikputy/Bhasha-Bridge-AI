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


// ---------------- PERSONALIZED LEARNING ENGINE ----------------
const learningState = JSON.parse(localStorage.getItem("bhashaLearningState") || '{"xp":0,"completed":0,"streak":0,"lastDate":"","subject":"","className":""}');

function saveLearningState(){ localStorage.setItem("bhashaLearningState", JSON.stringify(learningState)); }

function awardXP(points, message){
  const today = new Date().toDateString();
  if (learningState.lastDate !== today) {
    const yesterday = new Date(Date.now()-86400000).toDateString();
    learningState.streak = learningState.lastDate === yesterday ? learningState.streak + 1 : 1;
    learningState.lastDate = today;
  }
  learningState.xp += points;
  saveLearningState();
  updateLearningDashboard();
  if(message) showToast(message + " +" + points + " XP");
}

function updateLearningDashboard(){
  const pct = Math.min(100, Math.round((learningState.completed / 12) * 100));
  const xp = learningState.xp || 0;
  const el = id => document.getElementById(id);
  if(el("masteryPercent")) el("masteryPercent").textContent = pct + "%";
  if(el("masteryBar")) el("masteryBar").style.width = pct + "%";
  if(el("masteryText")) el("masteryText").textContent = learningState.completed ? learningState.completed + " learning milestones completed." : "Start a lesson to build your mastery.";
  if(el("learningStreak")) el("learningStreak").textContent = (learningState.streak || 0) + " day streak";
  if(el("xpPoints")) el("xpPoints").textContent = xp + " XP";
  if(el("continueTitle")) el("continueTitle").textContent = learningState.subject ? "Continue " + learningState.subject : "Choose a subject to begin";
  if(el("continueText")) el("continueText").textContent = learningState.subject ? "Class " + learningState.className + " • Your next adaptive lesson is ready." : "Bhasha AI will create a personalized learning path.";
}

function resetLearningProgress(){
  if(!confirm("Reset your local learning progress?")) return;
  Object.assign(learningState,{xp:0,completed:0,streak:0,lastDate:"",subject:"",className:""});
  saveLearningState(); updateLearningDashboard(); showToast("Learning progress reset.");
}

function generateLearningPath(cls, subject, topics){
  const path = document.getElementById("learningPath");
  if(!path) return;
  const steps = [
    ["📖","Learn","Understand the core concept"],
    ["💡","Understand","Get a simple AI explanation"],
    ["🗣️","Explain","Explain it in your own language"],
    ["✍️","Practice","Solve adaptive questions"],
    ["🏆","Master","Review mistakes and level up"]
  ];
  path.innerHTML = steps.map((s,i)=>`<article class="path-card ${i===0?"active":""}" data-step="${i}">
    <div class="path-icon">${s[0]}</div><span>STEP ${i+1}</span><h3>${s[1]}</h3><p>${s[2]}</p>
    <button class="${i===0?"primary":"secondary"}" onclick="startLearningStep(${i}, '${String(subject).replace(/'/g,"\\'")}')">${i===0?"Start":"Open"}</button>
  </article>`).join("");
}

function startLearningStep(step, subject){
  const messages=[
    "Start by reading the topic. Focus on meaning, not memorization.",
    "Open AI Coach and ask for a simple explanation with examples.",
    "Use your mother tongue to explain the concept aloud in your own words.",
    "Go to Infinite Quiz and test your understanding with fresh questions.",
    "Review incorrect answers and repeat weak concepts until confident."
  ];
  const targets=["#curriculum","#tutor","#live","#quiz","#quiz"];
  awardXP(10, "Learning step completed!");
  learningState.completed++;
  saveLearningState(); updateLearningDashboard();
  document.querySelector(targets[step])?.scrollIntoView({behavior:"smooth"});
  showToast(messages[step]);
}


// ---------------- ASK • UNDERSTAND • LEARN AI WORKFLOW ----------------
let aiMode = "ask";

function escapeHTML(value) {
  return String(value || "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function setAIMode(mode) {
  aiMode = mode;
  document.querySelectorAll(".ai-mode").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.mode === mode)
  );

  const input = document.getElementById("question");
  const quick = document.getElementById("quickQuestions");
  const labels = {
    ask: {
      placeholder:"Ask any question about your lesson...",
      button:"Ask AI ✨",
      prompts:[
        ["What does this concept mean?","What does this concept mean?"],
        ["Give me an example","Give me a real life example"],
        ["What are the key points?","What are the key points?"]
      ]
    },
    understand: {
      placeholder:"Enter a concept you want explained simply...",
      button:"Explain Clearly 💡",
      prompts:[
        ["Explain simply","Explain this topic in simple words"],
        ["Step by step","Explain this step by step"],
        ["Simple example","Give me a simple real life example"]
      ]
    },
    learn: {
      placeholder:"Enter a topic to create a learning plan...",
      button:"Create Learning Plan 🎯",
      prompts:[
        ["5-minute lesson","Teach me this topic in 5 minutes"],
        ["Practice questions","Create practice questions"],
        ["Quick revision","Make a quick revision plan"]
      ]
    }
  };

  const config = labels[mode];
  input.placeholder = config.placeholder;
  document.getElementById("askButton").textContent = config.button;
  quick.innerHTML = config.prompts.map(([label, value]) =>
    `<button onclick="quickAsk('${value.replace(/'/g, "\\'")}')">${label}</button>`
  ).join("");
  showToast(mode.charAt(0).toUpperCase() + mode.slice(1) + " mode activated");
}

function quickAsk(question) {
  document.getElementById("question").value = question;
  askAI();
}

function getLearningContext() {
  const context = document.getElementById("lessonContext")?.value.trim();
  const live = document.getElementById("inputText")?.value.trim();
  const translated = lastTranslation?.trim();
  return context || translated || live || "";
}

function extractTopic(question, context) {
  const clean = (question || context || "this topic")
    .replace(/^(explain|teach|what is|tell me about|give me|create|make)\s+/i, "")
    .replace(/[?!.]+$/,"").trim();
  return clean.length > 90 ? clean.slice(0, 90) + "…" : clean || "this topic";
}

function sentenceList(text, limit=3) {
  return (text || "")
    .replace(/\s+/g," ").split(/(?<=[.!?])\s+/)
    .map(s=>s.trim()).filter(Boolean).slice(0,limit);
}

function keywordList(text) {
  const stop = new Set("the a an is are was were and or but of in on for to with from this that these those it its as by at be can may will into about what why how".split(" "));
  const words = (text || "").toLowerCase().match(/[a-zA-Z]{4,}/g) || [];
  const counts = {};
  words.filter(w=>!stop.has(w)).forEach(w=>counts[w]=(counts[w]||0)+1);
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>x[0]);
}

function buildAskAnswer(question, context) {
  const q = question.toLowerCase();
  const topic = extractTopic(question, context);
  const sentences = sentenceList(context, 3);

  if (q.includes("example")) {
    return `<b>Example for: ${escapeHTML(topic)}</b><br><br>Think of it in daily life: first identify the main idea, then connect it with something you can observe or do. <br><br><b>Try this:</b> Write one real-life example in your own words and explain why it matches the concept.`;
  }
  if (q.includes("why")) {
    return `<b>Why it matters</b><br><br>${escapeHTML(topic)} is important because it helps you understand how an idea works and apply it beyond memorization.${sentences.length ? `<br><br><b>From your lesson context:</b> ${escapeHTML(sentences[0])}` : ""}`;
  }
  if (q.includes("key") || q.includes("point") || q.includes("summary")) {
    const keys = keywordList(context || question);
    return `<b>Key learning points</b><ol>${(keys.length ? keys : ["Main concept","Meaning","Example","Application"]).map(k=>`<li>${escapeHTML(k.charAt(0).toUpperCase()+k.slice(1))}</li>`).join("")}</ol><b>Memory tip:</b> Explain each point aloud in your own language.`;
  }
  return `<b>AI learning response</b><br><br><b>Your question:</b> ${escapeHTML(question)}<br><br>${sentences.length ? `Based on the lesson context, start with this idea: <i>${escapeHTML(sentences[0])}</i><br><br>` : ""}To understand <b>${escapeHTML(topic)}</b>, focus on: <ol><li>What it means</li><li>How it works</li><li>One real-life example</li><li>Where you can apply it</li></ol>`;
}

function buildUnderstandAnswer(question, context) {
  const topic = extractTopic(question, context);
  const sentences = sentenceList(context, 2);
  return `<b>💡 Simple Explanation: ${escapeHTML(topic)}</b><br><br>
  <b>1. Meaning:</b> Understand the core idea first—don't memorize blindly.<br>
  <b>2. Break it down:</b> Divide the topic into small parts and learn one part at a time.<br>
  <b>3. Connect it:</b> Link the idea with something you see in real life.<br>
  <b>4. Explain it back:</b> If you can teach it in simple words, you truly understand it.
  ${sentences.length ? `<br><br><b>Context simplified:</b> ${escapeHTML(sentences.join(" "))}` : ""}
  <br><br><b>🧠 Check yourself:</b> Can you explain this topic to a Class 5 student in two sentences?`;
}

function buildLearnAnswer(question, context) {
  const topic = extractTopic(question, context);
  const keys = keywordList(context || question);
  const concepts = keys.length ? keys.slice(0,3) : ["Core idea","Example","Practice"];
  return `<b>🎯 Personalized Learning Plan: ${escapeHTML(topic)}</b><br><br>
  <b>Step 1 — Learn (5 min)</b><br>Read the topic and identify: ${escapeHTML(concepts[0])}.<br><br>
  <b>Step 2 — Understand (5 min)</b><br>Explain the idea in your mother tongue or simple English.<br><br>
  <b>Step 3 — Apply (5 min)</b><br>Create one example involving ${escapeHTML(concepts[1] || "the concept")}.<br><br>
  <b>Step 4 — Practice</b><br>Open the <b>Infinite Quiz</b> section and solve a fresh set of questions.<br><br>
  <b>Step 5 — Revise</b><br>Write three keywords: ${concepts.map(escapeHTML).join(", ")}.`;
}

function askAI() {
  const input = document.getElementById("question");
  const question = input.value.trim();
  const context = getLearningContext();

  if (!question && !context) {
    showToast("Enter a question or add lesson context first.");
    return;
  }

  const effectiveQuestion = question || "Help me understand this lesson";
  const chat = document.getElementById("chat");
  chat.insertAdjacentHTML("beforeend", `<div class="message user">${escapeHTML(effectiveQuestion)}</div>`);
  input.value = "";

  const typingId = "typing-" + Date.now();
  chat.insertAdjacentHTML("beforeend", `<div class="message bot typing" id="${typingId}">🤖 Bhasha AI is thinking<span>.</span><span>.</span><span>.</span></div>`);
  chat.scrollTop = chat.scrollHeight;

  setTimeout(() => {
    let answer = aiMode === "understand"
      ? buildUnderstandAnswer(effectiveQuestion, context)
      : aiMode === "learn"
        ? buildLearnAnswer(effectiveQuestion, context)
        : buildAskAnswer(effectiveQuestion, context);

    document.getElementById(typingId)?.remove();
    chat.insertAdjacentHTML("beforeend", `<div class="message bot">🤖 ${answer}</div>`);
    chat.scrollTop = chat.scrollHeight;
  }, 500);
}

document.addEventListener("DOMContentLoaded", () => {
  setAIMode("ask");
  const question = document.getElementById("question");
  if (question) question.addEventListener("keydown", e => {
    if (e.key === "Enter") askAI();
  });
});

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
    awardXP(15, "Correct answer!");
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

  learningState.subject = subject.value;
  learningState.className = cls.value;
  saveLearningState();
  updateLearningDashboard();
  generateLearningPath(cls.value, subject.value, topics);

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

document.addEventListener("DOMContentLoaded", () => { initializeCurriculum(); updateLearningDashboard(); });
