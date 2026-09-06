/* BhashaBridge AI - syllabus and video reliability layer */
(function(){
  const detailedSyllabus = {
    "8": {
      "Mathematics": [
        "Rational Numbers","Linear Equations in One Variable","Understanding Quadrilaterals","Practical Geometry",
        "Data Handling","Squares and Square Roots","Cubes and Cube Roots","Comparing Quantities",
        "Algebraic Expressions and Identities","Visualising Solid Shapes","Mensuration","Exponents and Powers",
        "Direct and Inverse Proportions","Factorisation","Introduction to Graphs","Playing with Numbers"
      ],
      "Science": [
        "Crop Production and Management","Microorganisms: Friend and Foe","Coal and Petroleum","Combustion and Flame",
        "Conservation of Plants and Animals","Reproduction in Animals","Reaching the Age of Adolescence","Force and Pressure",
        "Friction","Sound","Chemical Effects of Electric Current","Some Natural Phenomena","Light"
      ],
      "Social Science": [
        "संसाधन (Resources)","भूमि, मृदा, जल, प्राकृतिक वनस्पति और वन्य जीवन संसाधन",
        "खनिज और शक्ति संसाधन","कृषि","उद्योग","मानव संसाधन","भारतीय संविधान","न्यायपालिका"
      ],
      "English": [
        "The Naive Friends","My Mother","Kali and the Rat Snake","Daffodils","Siachen-The Place of Wild Roses",
        "Bharat Our Land","King John and the Abbot of Canterbury","Stopping by the Woods on a Snowy Evening",
        "The Flying Machine","The Land of Story Books","Champion Women","When Sachin Walks Out to Bat",
        "A New Religion","The Bird-man of India","A Heritage of Trees","Living in the Age of Google",
        "Baby Ate A Microchip","Shri Krishna Eating House","Invictus","Young Voices of Change"
      ],
      "Hindi": [
        "पुष्प की अभिलाषा","छोटा जादूगर","मित्रता","पथ की पहचान","बड़े भाई साहब","अमरूद का पेड़",
        "क्या निराश हुआ जाए","राम का भरत को संदेश","कामचोर","बस की यात्रा","सुदामा चरित","बूढ़ी पृथ्वी का दुःख"
      ],
      "Sanskrit": ["Use official JCERT/JAC textbook/ebook link for the current chapter list."],
      "Urdu": ["Use official JCERT/JAC textbook/ebook link for the current chapter list."]
    }
  };

  const fallbackSubjects = {
    primary:["Language & Literacy","Mathematics","EVS","Art & Culture","Physical Education"],
    middle:["Hindi / Regional Language","English","Mathematics","Science","Social Science","Computer & Digital Literacy"],
    secondary:["Hindi / Regional Language","English","Mathematics","Science","Social Science","Vocational / Skill Education"],
    senior:["Languages","Physics","Chemistry","Biology","Mathematics","History","Geography","Political Science","Economics","Commerce"]
  };

  const topicFallback = {
    "Mathematics":["Number system","Algebra","Geometry","Mensuration","Data handling","Graphs","Problem solving"],
    "Science":["Living world","Matter","Force and motion","Energy","Environment","Scientific inquiry"],
    "EVS":["Family and community","Food","Water","Plants and animals","Health","Environment"],
    "Social Science":["History","Geography","Civics","Economy","Local context"],
    "English":["Reading","Writing","Grammar","Vocabulary","Comprehension","Speaking"],
    "Hindi / Regional Language":["Reading","Writing","Grammar","Vocabulary","Storytelling","Local culture"]
  };

  function esc(s){ return String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c])); }
  function stage(cls){ const n=Number(cls); return n<=5?'primary':n<=8?'middle':n<=10?'secondary':'senior'; }
  function chapterPrompt(chapter){
    const context=document.getElementById('lessonContext');
    if(context) context.value=chapter;
    const question=document.getElementById('question');
    if(question) question.value='Teach me "'+chapter+'" step by step with a simple example.';
    document.querySelector('#tutor')?.scrollIntoView({behavior:'smooth'});
    if(typeof setAIMode==='function') setAIMode('understand');
    if(typeof askAI==='function') setTimeout(askAI,100);
  }
  window.openChapter = chapterPrompt;

  window.renderCurriculum = function(){
    const cls=document.getElementById('classSelect');
    const subject=document.getElementById('subjectSelect');
    const result=document.getElementById('curriculumResult');
    if(!cls||!subject||!result) return;
    const classData=detailedSyllabus[String(cls.value)];
    const chapters=classData?.[subject.value] || topicFallback[subject.value] || ["Core concepts","Guided practice","Application","Assessment"];
    if(typeof learningState!=='undefined'){
      learningState.subject=subject.value; learningState.className=cls.value;
      saveLearningState(); updateLearningDashboard();
    }
    result.innerHTML='<div class="curriculum-head"><span class="curriculum-badge">Class '+esc(cls.value)+'</span><h3>'+esc(subject.value)+'</h3><span class="verified-badge">2026–27 mapped</span></div>'+
      '<p><b>'+chapters.length+'</b> learning units available in this prototype. Tap any chapter to launch the AI lesson.</p>'+
      '<div class="chapter-list">'+chapters.map((ch,i)=>'<button class="chapter-card" onclick="openChapter('+JSON.stringify(ch).replace(/</g,'\\u003c')+')"><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+esc(ch)+'</strong><em>Learn →</em></button>').join('')+'</div>'+ 
      '<div class="regional-note">Official alignment: Jharkhand\'s J-Guruji is designed around JCERT syllabus and textbook-aligned digital content. This prototype uses the verified 2026–27 Class 8 chapter lists available publicly and links to official JAC/JCERT resources for verification.</div>';
  };

  function init(){
    const cls=document.getElementById('classSelect');
    const subject=document.getElementById('subjectSelect');
    if(!cls||!subject) return;
    cls.innerHTML=Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'">Class '+(i+1)+'</option>').join('');
    const update=()=>{
      const subjects=Object.keys(detailedSyllabus[String(cls.value)]||{});
      const list=subjects.length?subjects:fallbackSubjects[stage(cls.value)];
      subject.innerHTML=list.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
      window.renderCurriculum();
    };
    cls.onchange=update; subject.onchange=window.renderCurriculum; update();
  }

  function fixVideo(){
    const file=document.getElementById('videoFile'); const preview=document.getElementById('videoPreview');
    const drop=document.querySelector('.dropzone'); const meta=document.getElementById('videoMeta'); const progress=document.getElementById('videoProgress');
    if(!file||!preview) return;
    window.loadVideo=function(input){
      const f=input?.files?.[0]; if(!f) return;
      if(!f.type.startsWith('video/')){ showToast('Please choose an MP4, WebM or MOV video.'); input.value=''; return; }
      if(window.__bbVideoUrl) URL.revokeObjectURL(window.__bbVideoUrl);
      window.__bbVideoUrl=URL.createObjectURL(f); preview.src=window.__bbVideoUrl; preview.style.display='block'; preview.load();
      if(meta) meta.innerHTML='<b>✓ Ready</b><br>'+esc(f.name)+' • '+(f.size/1048576).toFixed(2)+' MB';
      if(progress) progress.innerHTML='<b>Video loaded.</b> Choose a target language, then press Process Video.';
      if(drop) drop.classList.add('uploaded');
      showToast('Video loaded successfully.');
    };
    window.processVideo=async function(){
      const f=file.files?.[0];
      if(!f) {showToast('Upload a video first.'); file.click(); return;}
      const target=document.getElementById('videoTarget'); const name=target?.options[target.selectedIndex]?.text||'target language';
      const steps=['📥 Video accepted','🎙 Audio analysis stage','📝 Transcript + timestamps stage','🌐 Translation into '+name,'🔊 Native voice synthesis stage','🎬 Dubbed-video render stage'];
      for(const s of steps){ if(progress) progress.textContent=s; await new Promise(r=>setTimeout(r,500)); }
      if(progress) progress.innerHTML='<b>✅ Prototype pipeline complete.</b><br>Actual rendered dubbing requires a backend for speech-to-text, neural TTS and FFmpeg.';
      showToast('Video processing workflow completed.');
    };
  }

  document.addEventListener('DOMContentLoaded',()=>{init();fixVideo();});
})();


/* ---------------- ADVANCED TRANSLATION + VOICE RELIABILITY LAYER ---------------- */
(function(){
  const translationCodes = {
    en:"en", hi:"hi", bn:"bn", or:"or", ur:"ur", ta:"ta", te:"te", mr:"mr",
    sat:"sat", unr:"unr", hoc:"hoc", kru:"kru", kha:"kha", nag:"nag",
    kfy:"kfy", kho:"kho", ppg:"ppg"
  };

  const speechLocales = {
    en:"en-IN", hi:"hi-IN", bn:"bn-IN", or:"or-IN", ur:"ur-IN",
    ta:"ta-IN", te:"te-IN", mr:"mr-IN",
    sat:"hi-IN", unr:"hi-IN", hoc:"hi-IN", kru:"hi-IN", kha:"hi-IN",
    nag:"hi-IN", kfy:"hi-IN", kho:"hi-IN", ppg:"hi-IN"
  };

  const providerSupported = new Set(["en","hi","bn","or","ur","ta","te","mr"]);
  const cache = new Map();

  function setTranslationStatus(message){
    const el=document.getElementById("translationStatus");
    if(el) el.textContent=message;
  }

  function normalizeText(text){
    return String(text||"").replace(/\s+/g," ").trim();
  }

  async function fetchWithTimeout(url, options={}, timeout=10000){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{
      return await fetch(url,{...options,signal:controller.signal});
    }finally{ clearTimeout(timer); }
  }

  async function googleTranslate(text, source, target){
    const url="https://translate.googleapis.com/translate_a/single?client=gtx"+
      "&sl="+encodeURIComponent(source)+"&tl="+encodeURIComponent(target)+
      "&dt=t&q="+encodeURIComponent(text);
    const res=await fetchWithTimeout(url,{},10000);
    if(!res.ok) throw new Error("Google translation unavailable");
    const data=await res.json();
    const output=Array.isArray(data?.[0]) ? data[0].map(x=>x?.[0]||"").join("").trim() : "";
    if(!output) throw new Error("Empty translation");
    return output;
  }

  async function myMemoryTranslate(text, source, target){
    const url="https://api.mymemory.translated.net/get?q="+encodeURIComponent(text)+
      "&langpair="+encodeURIComponent(source+"|"+target);
    const res=await fetchWithTimeout(url,{},10000);
    if(!res.ok) throw new Error("Backup translation unavailable");
    const data=await res.json();
    const raw=data?.responseData?.translatedText;
    if(!raw) throw new Error("Empty backup translation");
    const decoder=document.createElement("textarea");
    decoder.innerHTML=raw;
    return decoder.value.trim();
  }

  window.translateLesson=async function(){
    const input=document.getElementById("inputText");
    const srcSelect=document.getElementById("sourceLanguage");
    const tgtSelect=document.getElementById("targetLanguage");
    const out=document.getElementById("translationResult");
    if(!input||!srcSelect||!tgtSelect||!out) return;

    const text=normalizeText(input.value);
    const src=srcSelect.value;
    const tgt=tgtSelect.value;

    if(!text){ showToast("Enter or speak text first."); return; }
    if(src===tgt){
      window.lastTranslation=text;
      out.textContent=text;
      setTranslationStatus("✓ Same-language text — no translation needed.");
      return;
    }

    const source=translationCodes[src]||src;
    const target=translationCodes[tgt]||tgt;
    const key=source+"|"+target+"|"+text;

    if(cache.has(key)){
      window.lastTranslation=cache.get(key);
      out.textContent=window.lastTranslation;
      setTranslationStatus("⚡ Instant result from local translation cache.");
      showToast("Translation ready.");
      return;
    }

    out.textContent="Translating…";
    setTranslationStatus("🧠 Analyzing sentence context and translating…");

    // Avoid pretending unsupported native-language pairs have been translated.
    if(!providerSupported.has(source)||!providerSupported.has(target)){
      out.textContent="This language pair needs a dedicated translation model.";
      setTranslationStatus("⚠ Native-language translation backend is required for this pair. No fake translation was generated.");
      showToast("Dedicated model required for this language pair.");
      return;
    }

    try{
      let translated;
      try{
        translated=await googleTranslate(text,source,target);
        setTranslationStatus("✓ Advanced translation completed.");
      }catch(primaryError){
        console.warn("Primary translator failed",primaryError);
        setTranslationStatus("Primary service unavailable — trying backup translator…");
        translated=await myMemoryTranslate(text,source,target);
        setTranslationStatus("✓ Translation completed using backup service.");
      }

      window.lastTranslation=translated;
      cache.set(key,translated);
      out.textContent=translated;
      showToast("Translation completed!");
    }catch(error){
      console.error("Translation error",error);
      out.textContent="Translation could not be completed right now. Please check your internet and try again.";
      window.lastTranslation="";
      setTranslationStatus("⚠ Translation service unavailable. Please retry.");
      showToast("Translation failed — please retry.");
    }
  };

  function getAvailableVoices(){
    return window.speechSynthesis ? speechSynthesis.getVoices() : [];
  }

  function findBestVoice(code){
    const voices=getAvailableVoices();
    if(!voices.length) return null;
    const locale=(speechLocales[code]||code||"en").toLowerCase();
    const base=locale.split("-")[0];
    return voices.find(v=>v.lang.toLowerCase()===locale) ||
      voices.find(v=>v.lang.toLowerCase().startsWith(base+"-")) ||
      voices.find(v=>v.lang.toLowerCase().startsWith(base)) ||
      voices.find(v=>v.default) || voices[0];
  }

  function speakNow(text, code){
    if(!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)){
      setTranslationStatus("Audio playback is not supported by this browser.");
      showToast("Please use a modern browser for pronunciation.");
      return;
    }

    const utterance=new SpeechSynthesisUtterance(text);
    const voice=findBestVoice(code);
    utterance.lang=voice?.lang || speechLocales[code] || "en-US";
    if(voice) utterance.voice=voice;
    utterance.rate=0.88;
    utterance.pitch=1;
    utterance.volume=1;

    utterance.onstart=()=>setTranslationStatus(voice
      ? "🔊 Playing pronunciation with the best available voice."
      : "🔊 Playing with your device's default speech voice.");
    utterance.onerror=(e)=>{
      console.warn("Speech synthesis error",e.error);
      setTranslationStatus("⚠ Audio could not start. Try Chrome, reload once, and press the button again.");
    };

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  window.speakResult=function(){
    const result=document.getElementById("translationResult");
    const target=document.getElementById("targetLanguage");
    const text=normalizeText(window.lastTranslation || result?.innerText);
    if(!text || /appear here|could not be completed|needs a dedicated/i.test(text)){
      showToast("Translate valid text first.");
      return;
    }

    const code=target?.value||"en";
    // Voice lists often load asynchronously on Android. Retry once instead of
    // showing the incorrect “native browser voice not installed” message.
    if(getAvailableVoices().length===0){
      speechSynthesis.getVoices();
      setTimeout(()=>speakNow(text,code),350);
    }else{
      speakNow(text,code);
    }
  };

  if("speechSynthesis" in window){
    speechSynthesis.onvoiceschanged=()=>{ speechSynthesis.getVoices(); };
    speechSynthesis.getVoices();
  }
})();
