/* FINAL LIVE TRANSLATION + LAPTOP MICROPHONE + DESKTOP AUDIO RELIABILITY LAYER — loaded last */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const locales = {
    en:"en-US", hi:"hi-IN", bn:"bn-IN", or:"or-IN", ur:"ur-IN",
    sat:"sat-IN", unr:"unr-IN", hoc:"hoc-IN", kru:"kru-IN", kha:"kha-IN",
    nag:"nag-IN", kfy:"kfy-IN", kho:"kho-IN", ppg:"ppg-IN",
    ta:"ta-IN", te:"te-IN", mr:"mr-IN"
  };

  const ttsCodes = {
    en:"en", hi:"hi", bn:"bn", or:"or", ur:"ur", ta:"ta", te:"te", mr:"mr"
  };

  function toast(msg) {
    if (typeof window.showToast === "function") window.showToast(msg);
    else console.log(msg);
  }

  function micStatus(msg) {
    const el = $("micStatus");
    if (el) el.textContent = msg;
  }

  function translationStatus(msg) {
    const el = $("translationStatus");
    if (el) el.textContent = msg;
  }

  function explainMicError(code) {
    const messages = {
      "not-allowed":"Microphone access is blocked. Click the 🔒 icon beside the website address, allow Microphone, then reload the page.",
      "service-not-allowed":"The speech-recognition service is unavailable. Use Chrome or Edge and make sure you are online.",
      "audio-capture":"No working microphone was found. Check your laptop microphone and Windows microphone input settings.",
      "network":"Speech recognition needs an internet connection in many desktop browsers.",
      "language-not-supported":"This browser does not support the selected recognition language. Try English or Hindi first.",
      "aborted":"Listening stopped. Press Start Listening again.",
      "no-speech":"No speech was detected. Speak clearly near the microphone and try again."
    };
    return messages[code] || ("Microphone error: " + code + ". Please try again.");
  }

  async function requestMicrophonePermission() {
    if (!navigator.mediaDevices?.getUserMedia) return true;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({audio:true});
      stream.getTracks().forEach(t => t.stop());
      return true;
    } catch (e) {
      console.error("getUserMedia:", e);
      const code = e.name === "NotAllowedError" ? "not-allowed" : "audio-capture";
      toast(explainMicError(code));
      micStatus("● MICROPHONE BLOCKED");
      return false;
    }
  }

  function startLaptopListening() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      toast("Live voice recognition is not supported by this browser. Please use the latest Google Chrome or Microsoft Edge.");
      micStatus("● VOICE RECOGNITION NOT SUPPORTED");
      return;
    }

    const source = $("sourceLanguage");
    const input = $("inputText");
    const startBtn = $("startBtn");
    if (!source || !input || !startBtn) return;

    try { window.recognition?.abort?.(); } catch (_) {}

    const recognition = new Recognition();
    window.recognition = recognition;

    recognition.lang = locales[source.value] || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalParts = [];
    let lastInterim = "";
    let stoppedByUser = false;
    let restarting = false;

    recognition.onstart = () => {
      window.listening = true;
      document.body.classList.add("listening");
      startBtn.textContent = "⏹ Stop Listening";
      micStatus("● LISTENING LIVE");
      toast("Microphone is listening — speak now.");
    };

    recognition.onresult = event => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim() || "";
        if (result.isFinal && text) finalParts[i] = text;
        if (!result.isFinal && text) interim += text + " ";
      }

      lastInterim = interim.trim();

      const clean = ([...finalParts.filter(Boolean), lastInterim].join(" "))
        .replace(/\s+/g," ")
        .trim()
        .replace(/\b(\w+)(?:\s+\1\b)+/gi,"$1");

      input.value = clean;
      micStatus("● LISTENING LIVE");
    };

    recognition.onerror = event => {
      console.warn("SpeechRecognition error:", event.error);
      if (event.error === "no-speech") {
        micStatus("● LISTENING — NO SPEECH DETECTED");
        return;
      }
      if (event.error === "aborted") return;

      toast(explainMicError(event.error));
      micStatus("● " + event.error.toUpperCase());
      if (["not-allowed","service-not-allowed","audio-capture"].includes(event.error)) window.listening = false;
    };

    recognition.onend = () => {
      if (stoppedByUser || !window.listening) {
        document.body.classList.remove("listening");
        startBtn.textContent = "🎤 Start Listening";
        micStatus("● READY");
        return;
      }
      if (restarting) return;
      restarting = true;
      setTimeout(() => {
        restarting = false;
        if (!stoppedByUser && window.listening) {
          try { recognition.start(); } catch (_) {}
        }
      }, 250);
    };

    window.stopDesktopRecognition = () => {
      stoppedByUser = true;
      window.listening = false;
      try { recognition.stop(); } catch (_) { try { recognition.abort(); } catch (_) {} }
      document.body.classList.remove("listening");
      startBtn.textContent = "🎤 Start Listening";
      micStatus("● READY");
    };

    requestMicrophonePermission().then(ok => {
      if (!ok) { window.listening = false; return; }
      try { recognition.start(); }
      catch (e) {
        console.warn("recognition.start:", e);
        toast("Could not start the microphone. Allow microphone permission and try again.");
        window.listening = false;
      }
    });
  }

  window.toggleListening = async () => {
    if (window.listening) {
      window.stopDesktopRecognition?.();
      return;
    }
    startLaptopListening();
  };

  // Remote TTS fallback for desktops where Windows/Chrome has no Hindi or other target voice.
  // This is a playback-only fallback; it does not expose an API key.
  async function remoteSpeak(text, code) {
    const tl = ttsCodes[code];
    if (!tl) throw new Error("No remote TTS route for this language");
    const parts = [];
    const clean = String(text).replace(/\s+/g," ").trim();
    for (let i=0;i<clean.length;i+=180) parts.push(clean.slice(i,i+180));
    for (const part of parts) {
      const url = "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=" +
        encodeURIComponent(tl) + "&q=" + encodeURIComponent(part) + "&r=" + Date.now();
      await new Promise((resolve,reject)=>{
        const audio = new Audio();
        audio.preload = "auto";
        audio.src = url;
        audio.onended = resolve;
        audio.onerror = () => reject(new Error("Remote audio unavailable"));
        audio.play().catch(reject);
      });
    }
  }

  function browserSpeak(text, code) {
    return new Promise((resolve,reject)=>{
      if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return reject(new Error("Speech synthesis unsupported"));
      const wanted=(locales[code]||code||"en").toLowerCase();
      const base=wanted.split("-")[0];
      const voices=speechSynthesis.getVoices();
      const voice=voices.find(v=>v.lang.toLowerCase()===wanted) || voices.find(v=>v.lang.toLowerCase().startsWith(base+"-")) || voices.find(v=>v.lang.toLowerCase().startsWith(base));
      const u=new SpeechSynthesisUtterance(text);
      u.lang=voice?.lang||wanted;
      if(voice) u.voice=voice;
      u.rate=.9; u.pitch=1; u.volume=1;
      u.onend=resolve; u.onerror=()=>reject(new Error("Browser speech failed"));
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    });
  }

  window.speakResult = async () => {
    const result=$("translationResult");
    const target=$("targetLanguage");
    const text=(window.lastTranslation || result?.textContent || "").trim();
    const code=target?.value || "en";
    if(!text || /translation will appear|temporarily unavailable|requires a dedicated/i.test(text)) {
      toast("Translate valid text first.");
      return;
    }

    try {
      translationStatus("🔊 Preparing translated voice…");
      // Prefer a real browser voice when available for the target language.
      try {
        if (speechSynthesis.getVoices().length === 0) speechSynthesis.getVoices();
        const wanted=(locales[code]||code||"en").toLowerCase();
        const base=wanted.split("-")[0];
        const hasVoice=(speechSynthesis.getVoices()||[]).some(v=>v.lang.toLowerCase()===wanted || v.lang.toLowerCase().startsWith(base+"-") || v.lang.toLowerCase().startsWith(base));
        if(hasVoice){
          await browserSpeak(text,code);
          translationStatus("✓ Translated voice played using the best available desktop voice.");
          return;
        }
      } catch (_) {}

      // When desktop has no target-language voice, use remote translated audio.
      await remoteSpeak(text,code);
      translationStatus("✓ Translated voice played successfully.");
    } catch (error) {
      console.error("TTS error",error);
      translationStatus("⚠ Desktop could not play the translated audio. Check internet access and press again.");
      toast("Translated voice could not be played. Please try again.");
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const source=$("sourceLanguage");
    if(source) source.addEventListener("change",()=>{
      if(window.listening){ window.stopDesktopRecognition?.(); setTimeout(startLaptopListening,150); }
    });
    if("speechSynthesis" in window) {
      speechSynthesis.getVoices();
      speechSynthesis.onvoiceschanged=()=>speechSynthesis.getVoices();
    }
  });
})();
