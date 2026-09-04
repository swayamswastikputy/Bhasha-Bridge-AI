let recognition = null;
let listening = false;
let lastTranslation = "";
let baseText = "";
let finalResults = [];

const langMap = { en:"en-US", hi:"hi-IN", bn:"bn-IN", or:"or-IN", ta:"ta-IN", te:"te-IN", mr:"mr-IN" };

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
