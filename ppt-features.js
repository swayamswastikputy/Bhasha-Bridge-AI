/* BHASHA AI - final UI and simple-answer reliability layer */
document.addEventListener("DOMContentLoaded",()=>{
  /* Keep one consistent AI name everywhere */
  document.querySelectorAll(".brand, .ai-sidebar h3, .ai-chat-head b").forEach(node=>{
    if(/bhasha/i.test(node.textContent)) node.textContent="BHASHA AI";
  });

  document.querySelectorAll('a[href="#architecture"],a[href="#impact"],a[href="#roadmap"]').forEach(a=>a.addEventListener("click",e=>{
    e.preventDefault(); document.querySelector(a.getAttribute("href"))?.scrollIntoView({behavior:"smooth"});
  }));

  /* Run after ai-core.js has attached its handlers, then replace the fallback behaviour */
  setTimeout(()=>{
    const prompt=document.getElementById("aiPrompt");
    const send=document.getElementById("aiSendBtn");
    const box=document.getElementById("aiMessages");
    const status=document.getElementById("aiConnectionText");
    if(!prompt||!send||!box) return;

    function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
    function add(role,text){
      const d=document.createElement("div");
      d.className="ai-msg "+role;
      d.innerHTML=esc(text);
      box.appendChild(d);
      box.scrollTop=box.scrollHeight;
    }

    function answer(q){
      const t=q.toLowerCase().replace(/[?!.]/g," ").replace(/\s+/g," ").trim();

      const direct=[
        [/who is the prime minister of india|prime minister of india/, "The Prime Minister of India is Narendra Modi. He is the head of the Government of India."],
        [/who is the president of india|president of india/, "The President of India is Droupadi Murmu. The President is the constitutional head of the Republic of India."],
        [/capital of india/, "The capital of India is New Delhi."],
        [/capital of jharkhand/, "The capital of Jharkhand is Ranchi."],
        [/national animal of india/, "The national animal of India is the Bengal Tiger."],
        [/national bird of india/, "The national bird of India is the Indian Peacock."],
        [/national flower of india/, "The national flower of India is the Lotus."],
        [/national anthem of india/, "India's national anthem is Jana Gana Mana, written by Rabindranath Tagore."],
        [/national song of india/, "India's national song is Vande Mataram."],
        [/how many states in india|number of states in india/, "India has 28 states and 8 Union Territories."],
        [/largest state in india/, "Rajasthan is the largest state in India by area."],
        [/smallest state in india/, "Goa is the smallest state in India by area."],
        [/independence day/, "India celebrates Independence Day on 15 August."],
        [/republic day/, "India celebrates Republic Day on 26 January."],
        [/first prime minister of india/, "Jawaharlal Nehru was the first Prime Minister of independent India."],
        [/father of the nation|father of nation/, "Mahatma Gandhi is widely known as the Father of the Nation in India."],
        [/red planet/, "Mars is called the Red Planet."],
        [/largest planet/, "Jupiter is the largest planet in our Solar System."],
        [/smallest planet/, "Mercury is the smallest planet in our Solar System."],
        [/sun is a|what is the sun/, "The Sun is a star and the centre of our Solar System."],
        [/formula of water|water formula/, "The chemical formula of water is H₂O."],
        [/largest ocean/, "The Pacific Ocean is the largest ocean on Earth."],
        [/jharkhand formation|jharkhand foundation/, "Jharkhand was formed on 15 November 2000."]
      ];
      for(const [r,a] of direct) if(r.test(t)) return a;

      if(/^(hi|hello|hey|namaste)$/.test(t)) return "Hello! 👋 I am BHASHA AI. Ask me any simple question, General Knowledge question, or school subject question.";
      if(/what is your name|your name/.test(t)) return "My name is BHASHA AI. I am your multilingual learning and knowledge assistant.";

      const m=t.match(/(?:what is|calculate|solve)?\s*(\d+(?:\.\d+)?)\s*([+\-*x×/])\s*(\d+(?:\.\d+)?)/);
      if(m){
        const a=Number(m[1]), b=Number(m[3]), op=m[2];
        const r=op==="+"?a+b:op==="-"?a-b:(op==="*"||op==="x"||op==="×")?a*b:b===0?null:a/b;
        return r===null?"Division by zero is undefined.":"Answer: "+r+"\n\nStep: "+a+" "+op+" "+b+" = "+r;
      }

      if(t.includes("photosynthesis")) return "Photosynthesis is the process by which green plants make food using sunlight, carbon dioxide and water.\n\nSimple formula: Carbon dioxide + Water → Glucose + Oxygen.";
      if(t.includes("democracy")) return "Democracy is a form of government in which people choose their representatives through elections.";
      if(t.includes("cell")) return "A cell is the basic structural and functional unit of life.";
      if(t.includes("fraction")) return "A fraction represents a part of a whole. It has a numerator and a denominator.";

      return "I understand your question: \""+q+"\"\n\nI am BHASHA AI and I can answer General Knowledge, India facts, Jharkhand facts, Mathematics, Science, English and Social Science questions. Please ask your question directly, for example: 'What is gravity?' or 'Who is the Prime Minister of India?'";
    }

    function sendSimple(){
      const q=prompt.value.trim();
      if(!q) return;
      add("user",q);
      prompt.value="";
      add("assistant",answer(q));
      if(status) status.textContent="BHASHA AI ready";
    }

    /* Replace old handler completely */
    const fresh=send.cloneNode(true);
    send.parentNode.replaceChild(fresh,send);
    fresh.addEventListener("click",sendSimple);
    prompt.addEventListener("keydown",e=>{
      if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();e.stopImmediatePropagation();sendSimple();}
    },true);

    if(status) status.textContent="BHASHA AI ready";
  },50);
});


// ---------------- TRANSLATOR + PRONUNCIATION RELIABILITY FIX ----------------
(() => {
  const translationCache = new Map();
  const speechLang = {
    en:"en-US", hi:"hi-IN", bn:"bn-IN", or:"or-IN", ur:"ur-IN",
    sat:"sat", ta:"ta-IN", te:"te-IN", mr:"mr-IN"
  };
  const unsupportedNative = new Set(["unr","hoc","kru","kha","nag","kfy","kho","ppg"]);

  const timeoutFetch = async (url, ms=7000) => {
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), ms);
    try {
      const res = await fetch(url,{signal:controller.signal});
      if(!res.ok) throw new Error("Translation service unavailable");
      return res;
    } finally { clearTimeout(timer); }
  };

  window.translateLesson = async function () {
    const input=document.getElementById("inputText");
    const source=document.getElementById("sourceLanguage");
    const target=document.getElementById("targetLanguage");
    const out=document.getElementById("translationResult");
    const status=document.getElementById("translationStatus");
    if(!input||!source||!target||!out) return;

    const text=input.value.trim(), src=source.value, tgt=target.value;
    if(!text){ window.showToast?.("Enter or speak text first."); return; }
    if(src===tgt){
      window.lastTranslation=text; out.textContent=text;
      if(status) status.textContent="✓ Same-language mode.";
      return;
    }
    if(unsupportedNative.has(src)||unsupportedNative.has(tgt)){
      out.textContent="This prototype does not yet have a verified translation engine for the selected Jharkhand native-language pair.";
      if(status) status.textContent="⚠ Native-language pair requires a dedicated language model/backend.";
      window.lastTranslation="";
      window.showToast?.("Dedicated language model required for this language pair.");
      return;
    }

    const key=src+"|"+tgt+"|"+text;
    if(translationCache.has(key)){
      window.lastTranslation=translationCache.get(key);
      out.textContent=window.lastTranslation;
      if(status) status.textContent="✓ Instant result from local cache.";
      return;
    }

    out.textContent="Translating…";
    if(status) status.textContent="Connecting to translation service…";

    try{
      const url="https://translate.googleapis.com/translate_a/single?client=gtx&sl="+
        encodeURIComponent(src)+"&tl="+encodeURIComponent(tgt)+"&dt=t&q="+encodeURIComponent(text);
      const res=await timeoutFetch(url,7000);
      const data=await res.json();
      const translated=Array.isArray(data?.[0]) ? data[0].map(p=>p?.[0]||"").join("").trim() : "";
      if(!translated) throw new Error("Empty translation");
      translationCache.set(key,translated);
      window.lastTranslation=translated;
      out.textContent=translated;
      if(status) status.textContent="✓ Translation completed.";
      window.showToast?.("Translation completed!");
    }catch(err){
      console.warn("Translator:",err);
      out.textContent="Translation is temporarily unavailable. Please retry.";
      window.lastTranslation="";
      if(status) status.textContent=err?.name==="AbortError"?"⚠ Request timed out. Please retry.":"⚠ Translation service unavailable.";
      window.showToast?.("Translation failed or timed out.");
    }
  };

  window.speakResult = function () {
    const out=document.getElementById("translationResult");
    const target=document.getElementById("targetLanguage");
    const status=document.getElementById("translationStatus");
    const text=(window.lastTranslation||out?.textContent||"").trim();
    const code=target?.value;
    if(!text || /appear here|temporarily unavailable|verified translation engine/i.test(text)){
      window.showToast?.("Translate text first."); return;
    }
    if(unsupportedNative.has(code)){
      if(status) status.textContent="⚠ No verified browser pronunciation voice for this language. A native TTS backend is required.";
      window.showToast?.("Native pronunciation model required for this language.");
      return;
    }
    const speak=()=>{
      const voices=speechSynthesis.getVoices();
      const lang=speechLang[code]||code;
      const voice=voices.find(v=>v.lang.toLowerCase()===lang.toLowerCase()) ||
                  voices.find(v=>v.lang.toLowerCase().startsWith(lang.split("-")[0].toLowerCase()));
      if(!voice && code!=="en"){
        if(status) status.textContent="⚠ Native browser voice is not installed on this device.";
        window.showToast?.("Install a compatible device voice for native pronunciation.");
        return;
      }
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);
      u.lang=lang; if(voice) u.voice=voice;
      u.rate=0.88; u.pitch=1;
      u.onstart=()=>{ if(status) status.textContent="🔊 Playing pronunciation…"; };
      u.onend=()=>{ if(status) status.textContent="✓ Pronunciation completed."; };
      u.onerror=()=>{ if(status) status.textContent="⚠ Pronunciation playback failed."; };
      speechSynthesis.speak(u);
    };
    if(speechSynthesis.getVoices().length) speak();
    else speechSynthesis.onvoiceschanged=speak;
  };

  // Preload available browser voices to reduce first-play delay.
  try { speechSynthesis.getVoices(); } catch(e) {}
})();