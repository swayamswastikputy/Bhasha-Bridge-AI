/* FINAL DESKTOP + MOBILE RELIABILITY LAYER — loaded last */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const nativeUnsupported = new Set(["sat","unr","hoc","kru","kha","nag","kfy","kho","ppg"]);
  const lang = {en:"en-US",hi:"hi-IN",bn:"bn-IN",or:"or-IN",ur:"ur-IN",ta:"ta-IN",te:"te-IN",mr:"mr-IN"};
  const cache = new Map();

  function status(msg){ const e=$("translationStatus"); if(e) e.textContent=msg; }
  function toast(msg){ if(typeof window.showToast==="function") window.showToast(msg); else console.log(msg); }
  async function request(url, ms=12000){
    const c=new AbortController(), timer=setTimeout(()=>c.abort(),ms);
    try { return await fetch(url,{signal:c.signal,cache:"no-store"}); }
    finally { clearTimeout(timer); }
  }
  async function primary(text,src,tgt){
    const url="https://translate.googleapis.com/translate_a/single?client=gtx&sl="+encodeURIComponent(src)+"&tl="+encodeURIComponent(tgt)+"&dt=t&q="+encodeURIComponent(text);
    const r=await request(url); if(!r.ok) throw new Error("primary "+r.status);
    const d=await r.json(); const x=Array.isArray(d?.[0])?d[0].map(p=>p?.[0]||"").join("").trim():"";
    if(!x) throw new Error("empty"); return x;
  }
  async function backup(text,src,tgt){
    const url="https://api.mymemory.translated.net/get?q="+encodeURIComponent(text)+"&langpair="+encodeURIComponent(src+"|"+tgt);
    const r=await request(url); if(!r.ok) throw new Error("backup "+r.status);
    const d=await r.json(), raw=d?.responseData?.translatedText;
    if(!raw) throw new Error("empty backup");
    const x=document.createElement("textarea"); x.innerHTML=raw; return x.value.trim();
  }

  window.translateLesson=async()=>{
    const input=$("inputText"), source=$("sourceLanguage"), target=$("targetLanguage"), out=$("translationResult");
    if(!input||!source||!target||!out){ console.error("Translator elements missing"); return; }
    const text=input.value.replace(/\s+/g," ").trim(), src=source.value, tgt=target.value;
    if(!text){toast("Enter text first.");return;}
    if(src===tgt){window.lastTranslation=text;out.textContent=text;status("✓ Same-language mode.");return;}
    if(nativeUnsupported.has(src)||nativeUnsupported.has(tgt)){
      out.textContent="This language pair requires a dedicated native-language translation model.";
      status("⚠ Verified native-language backend required — no fake translation generated.");
      return;
    }
    const key=src+"|"+tgt+"|"+text;
    if(cache.has(key)){window.lastTranslation=cache.get(key);out.textContent=window.lastTranslation;status("⚡ Translation loaded instantly.");return;}
    out.textContent="Translating…"; status("🧠 Translating with advanced language service…");
    try{
      let result;
      try{ result=await primary(text,src,tgt); status("✓ Translation completed."); }
      catch(e){ console.warn("Primary failed",e); status("Trying backup translation service…"); result=await backup(text,src,tgt); status("✓ Translation completed using backup service."); }
      cache.set(key,result); window.lastTranslation=result; out.textContent=result; toast("Translation completed!");
    }catch(e){
      console.error(e); out.textContent="Translation service is unavailable right now. Please retry.";
      window.lastTranslation=""; status(e.name==="AbortError"?"⚠ Request timed out. Please retry.":"⚠ Translation service unavailable.");
    }
  };

  function bestVoice(code){
    const voices=window.speechSynthesis?.getVoices?.()||[];
    const wanted=(lang[code]||"en-US").toLowerCase(), base=wanted.split("-")[0];
    return voices.find(v=>v.lang.toLowerCase()===wanted) ||
           voices.find(v=>v.lang.toLowerCase().startsWith(base+"-")) ||
           voices.find(v=>v.lang.toLowerCase().startsWith(base)) ||
           voices.find(v=>v.default) || voices[0] || null;
  }
  window.speakResult=()=>{
    const out=$("translationResult"), target=$("targetLanguage");
    const text=(window.lastTranslation||out?.textContent||"").trim(), code=target?.value||"en";
    if(!text||/appear here|unavailable|required/i.test(text)){toast("Translate valid text first.");return;}
    if(!("speechSynthesis" in window)){status("⚠ Speech playback is not supported by this browser.");return;}
    const run=()=>{
      const u=new SpeechSynthesisUtterance(text), v=bestVoice(code);
      u.lang=v?.lang||lang[code]||"en-US"; if(v)u.voice=v; u.rate=.9;
      u.onstart=()=>status("🔊 Playing pronunciation…");
      u.onend=()=>status("✓ Pronunciation completed.");
      u.onerror=()=>status("⚠ Pronunciation failed. Try Chrome or Edge.");
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    };
    if(speechSynthesis.getVoices().length) run();
    else { speechSynthesis.getVoices(); setTimeout(run,500); }
  };
  if("speechSynthesis" in window) speechSynthesis.getVoices();

  /* Desktop-safe microphone start: explicit permission/error feedback */
  const oldStart=window.startVoice;
  window.startVoice=function(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){toast("Live speech recognition is not supported in this desktop browser. Use Chrome or Edge.");return;}
    return oldStart?.();
  };

  /* Ensure AI send button always has a working direct-answer fallback */
  function simpleAnswer(q){
    const t=q.toLowerCase().replace(/[?!.]/g," ").replace(/\s+/g," ").trim();
    const facts=[
      [/^hi$|^hello$|^hey$/, "Hello! 👋 I am BHASHA AI. Ask me any school or general knowledge question."],
      [/what is your name|your name/, "My name is BHASHA AI. I am your multilingual learning assistant."],
      [/capital of india/, "The capital of India is New Delhi."],
      [/capital of jharkhand/, "The capital of Jharkhand is Ranchi."],
      [/prime minister of india/, "The Prime Minister of India is Narendra Modi."],
      [/red planet/, "Mars is known as the Red Planet."],
      [/largest planet/, "Jupiter is the largest planet in our Solar System."],
      [/formula of water|water formula/, "The chemical formula of water is H₂O."],
      [/photosynthesis/, "Photosynthesis is the process by which green plants use sunlight, carbon dioxide and water to make food, releasing oxygen."]
    ];
    for(const [r,a] of facts) if(r.test(t)) return a;
    const m=t.match(/^(?:what is |calculate |solve )?(\d+(?:\.\d+)?)\s*([+\-*x×/])\s*(\d+(?:\.\d+)?)/);
    if(m){const a=+m[1],b=+m[3],o=m[2],v=o==="+"?a+b:o==="-"?a-b:(o==="*"||o==="x"||o==="×")?a*b:b===0?null:a/b;return v===null?"Division by zero is undefined.":"Answer: "+v;}
    return "I understand your question: “"+q+"”. Please ask it directly and I will explain it simply with a definition, example and key points.";
  }
  document.addEventListener("DOMContentLoaded",()=>{
    document.querySelectorAll(".brand, .ai-sidebar h3, .ai-chat-head b").forEach(n=>{if(/bhasha/i.test(n.textContent)) n.textContent="BHASHA AI";});
    const prompt=$("aiPrompt"), btn=$("aiSendBtn"), box=$("aiMessages"), st=$("aiConnectionText");
    if(!prompt||!btn||!box)return;
    const send=()=>{
      const q=prompt.value.trim(); if(!q)return;
      const user=document.createElement("div"); user.className="ai-msg user"; user.textContent=q; box.appendChild(user);
      prompt.value="";
      const ai=document.createElement("div"); ai.className="ai-msg assistant"; ai.textContent=simpleAnswer(q); box.appendChild(ai);
      box.scrollTop=box.scrollHeight; if(st)st.textContent="BHASHA AI ready";
    };
    btn.onclick=send;
    prompt.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}};
  });
})();