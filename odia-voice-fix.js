/* ODIA TARGET VOICE FIX
   Loaded after every other translator script so it cannot be overridden. */
(() => {
  const $ = id => document.getElementById(id);
  const ODIA_TTS = "or";

  const clean = value => String(value || "").replace(/\s+/g, " ").trim();

  function setStatus(message) {
    const el = $("translationStatus");
    if (el) el.textContent = message;
  }

  function toast(message) {
    if (typeof window.showToast === "function") window.showToast(message);
  }

  function speakBrowser(text, code) {
    return new Promise((resolve, reject) => {
      if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        reject(new Error("browser speech unavailable"));
        return;
      }
      const voices = speechSynthesis.getVoices();
      const wanted = code === "or" ? "or-IN" : (code + "-IN");
      const base = wanted.split("-")[0].toLowerCase();
      const voice = voices.find(v => v.lang.toLowerCase() === wanted.toLowerCase()) ||
                    voices.find(v => v.lang.toLowerCase().startsWith(base + "-"));
      if (!voice) {
        reject(new Error("no matching browser voice"));
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voice.lang;
      u.voice = voice;
      u.rate = 0.9;
      u.pitch = 1;
      u.volume = 1;
      u.onend = resolve;
      u.onerror = () => reject(new Error("browser speech failed"));
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    });
  }

  function remoteSpeakDirect(text, code) {
    return new Promise((resolve, reject) => {
      const parts = [];
      for (let i = 0; i < text.length; i += 160) parts.push(text.slice(i, i + 160));
      if (!parts.length) return reject(new Error("empty text"));

      let index = 0;
      const playNext = () => {
        if (index >= parts.length) {
          resolve();
          return;
        }
        const url = "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=" +
          encodeURIComponent(code) + "&q=" + encodeURIComponent(parts[index]) + "&r=" + Date.now();
        const audio = new Audio();
        audio.preload = "auto";
        audio.src = url;
        audio.onended = () => { index += 1; playNext(); };
        audio.onerror = () => reject(new Error("remote TTS unavailable"));

        /* First play happens immediately inside the user's button click path. */
        const p = audio.play();
        if (p && typeof p.catch === "function") p.catch(reject);
      };
      playNext();
    });
  }

  window.speakResult = function () {
    const out = $("translationResult");
    const target = $("targetLanguage");
    const text = clean(window.lastTranslation || out?.textContent);
    const code = target?.value || "en";

    if (!text || /translation will appear|temporarily unavailable|requires a dedicated|unavailable right now/i.test(text)) {
      toast("Translate valid text first.");
      return;
    }

    setStatus("🔊 Preparing translated voice…");

    /* Odia has a frequent desktop voice-availability problem. For Odia,
       use remote target-language audio first instead of depending on Windows voices. */
    if (code === "or") {
      remoteSpeakDirect(text, ODIA_TTS)
        .then(() => setStatus("✓ Odia translated voice played successfully."))
        .catch(async () => {
          try {
            await speakBrowser(text, code);
            setStatus("✓ Odia voice played using the available browser voice.");
          } catch (e) {
            setStatus("⚠ Odia audio could not be played. Please check internet access and press the button again.");
            toast("Odia voice playback failed. Please retry.");
          }
        });
      return;
    }

    /* Other languages: browser voice first, remote voice second. */
    speakBrowser(text, code)
      .then(() => setStatus("✓ Translated voice played successfully."))
      .catch(() => remoteSpeakDirect(text, code)
        .then(() => setStatus("✓ Translated voice played using online audio."))
        .catch(() => {
          setStatus("⚠ Translated audio could not be played. Please check internet access.");
          toast("Voice playback failed. Please retry.");
        }));
  };
})();