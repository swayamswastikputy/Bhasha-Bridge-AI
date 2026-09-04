let recognition = null;
let listening = false;
let lastTranslation = "";
let committedText = "";
let baseText = "";

const langMap = { en:"en-US", hi:"hi-IN", bn:"bn-IN", or:"or-IN", ta:"ta-IN", te:"te-IN", mr:"mr-IN" };

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.style.display = "none", 2500);
}

function normalizeSpeech(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
}

// Merge new speech with existing speech without repeating overlapping words.
// Example: "hello what" + "what is your name" => "hello what is your name"
function mergeSpeech(existing, incoming) {
  existing = existing.trim();
  incoming = incoming.trim();
  if (!incoming) return existing;
  if (!existing) return incoming;

  const oldNorm = normalizeSpeech(existing);
  const newNorm = normalizeSpeech(incoming);
  if (oldNorm === newNorm || oldNorm.endsWith(newNorm)) return existing;

  const oldWords = existing.split(/\s+/);
  const newWords = incoming.split(/\s+/);
  const max = Math.min(oldWords.length, newWords.length, 15);

  for (let n = max; n >= 1; n--) {
    const suffix = normalizeSpeech(oldWords.slice(-n).join(" "));
    const prefix = normalizeSpeech(newWords.slice(0, n).join(" "));
    if (suffix && suffix === prefix) {
      return (existing + " " + newWords.slice(n).join(" ")).trim();
    }
  }
  return (existing + " " + incoming).trim();
}

function toggleListening() {
  listening ? stopListening() : startVoice();
}

function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showToast("Speech recognition is best supported in Chrome.");
    return;
  }

  baseText = document.getElementById("inputText").value.trim();
  committedText = "";

  recognition = new SR();
  recognition.lang = langMap[document.getElementById("sourceLanguage").value] || "en-US";

  // Mobile Chrome is more accurate with short recognition sessions.
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let interim = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const phrase = event.results[i][0].transcript.trim();
      if (!phrase) continue;

      if (event.results[i].isFinal) {
        // Only final speech is permanently added.
        committedText = mergeSpeech(committedText, phrase);
      } else {
        // Interim text is preview-only and is never permanently appended.
        interim = phrase;
      }
    }

    const stable = mergeSpeech(baseText, committedText);
    document.getElementById("inputText").value = (stable + (interim ? " " + interim : "")).trim();
    document.getElementById("micStatus").textContent = interim ? "● HEARING: " + interim : "● LISTENING LIVE";
  };

  recognition.onend = () => {
    if (!listening) return;

    // Save only the confirmed text, then start a clean new session.
    baseText = mergeSpeech(baseText, committedText);
    committedText = "";

    setTimeout(() => {
      if (listening) {
        try { recognition.start(); } catch (_) {}
      }
    }, 150);
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      stopListening();
      showToast("Please allow microphone permission.");
    }
  };

  try {
    recognition.start();
    listening = true;
    document.body.classList.add("listening");
    document.getElementById("startBtn").textContent = "⏹ Stop Listening";
    document.getElementById("micStatus").textContent = "● LISTENING LIVE";
    showToast("Listening started — speak naturally.");
  } catch (_) {
    showToast("Microphone could not be started.");
  }
}

function stopListening() {
  listening = false;
  baseText = mergeSpeech(baseText, committedText);
  committedText = "";
  if (recognition) { try { recognition.stop(); } catch (_) {} }
  document.body.classList.remove("listening");
  document.getElementById("startBtn").textContent = "🎤 Start Listening";
  document.getElementById("micStatus").textContent = "● READY";
  document.getElementById("inputText").value = baseText;
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
  status.textContent = "Connecting to translation service...";

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${src}|${tgt}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.responseData?.translatedText) throw new Error("No translation returned");

    lastTranslation = data.responseData.translatedText;
    out.textContent = lastTranslation;
    status.textContent = "✓ Translation completed. Tap Native Pronunciation to hear it.";
    showToast("Translation completed!");
  } catch (error) {
    const fallback = {
      hi: "यह एक आम है।",
      or: "ଏହା ଏକ ଆମ୍ବ।",
      bn: "এটি একটি আম।",
      en: text
    };

    lastTranslation = fallback[tgt] || "Translation service unavailable for this language. Connect a production translation API for full coverage.";
    out.textContent = lastTranslation;
    status.textContent = "Demo fallback used.";
    showToast("Showing demo fallback.");
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

let score = 0;
let answered = 0;

function generateQuiz() {
  score = 0;
  answered = 0;

  const questions = [
    ["What is the source of energy for plants?", ["Sunlight", "Plastic", "Stone", "Car"], 0],
    ["Which helps plants grow?", ["Water", "Phone", "Toy", "TV"], 0],
    ["What improves understanding?", ["Learning in a familiar language", "Skipping lessons", "Ignoring class", "No questions"], 0]
  ];

  const container = document.getElementById("quizContainer");
  container.innerHTML = questions.map((item, index) => `
    <div class="quiz-card">
      <b>Q${index + 1}. ${item[0]}</b>
      <div class="options">
        ${item[1].map((option, optionIndex) => `
          <button class="option" onclick="checkAnswer(this, ${optionIndex}, ${item[2]})">${option}</button>
        `).join("")}
      </div>
    </div>
  `).join("");

  document.getElementById("scoreBox").textContent = "";
}

function checkAnswer(button, selected, correct) {
  const card = button.closest(".quiz-card");
  if (card.dataset.done) return;

  card.dataset.done = "1";
  answered++;

  card.querySelectorAll(".option").forEach((option, index) => {
    option.disabled = true;
    if (index === correct) option.classList.add("correct");
  });

  if (selected === correct) {
    score++;
    showToast("Correct! 🎉");
  } else {
    button.classList.add("wrong");
    showToast("Keep learning!");
  }

  if (answered === 3) {
    document.getElementById("scoreBox").textContent = `Final Score: ${score} / 3 ${score === 3 ? "🏆 Excellent!" : "📚 Keep learning!"}`;
  }
}
