/* BHASHA AI FINAL TRANSLATOR RUNTIME
   Loaded last so older prototype functions cannot overwrite translation/voice behavior.
*/
(() => {
  'use strict';

  const L = {
    en:{name:'English', tts:'en'}, hi:{name:'Hindi', tts:'hi'}, bn:{name:'Bengali', tts:'bn'},
    or:{name:'Odia', tts:'or'}, ur:{name:'Urdu', tts:'ur'}, ta:{name:'Tamil', tts:'ta'},
    te:{name:'Telugu', tts:'te'}, mr:{name:'Marathi', tts:'mr'},
    sat:{name:'Santali', tts:'hi'}, unr:{name:'Mundari', tts:'hi'}, hoc:{name:'Ho', tts:'hi'},
    kru:{name:'Kurukh', tts:'hi'}, kha:{name:'Kharia', tts:'hi'}, nag:{name:'Nagpuri', tts:'hi'},
    kfy:{name:'Kurmali', tts:'hi'}, kho:{name:'Khortha', tts:'hi'}, ppg:{name:'Panchpargania', tts:'hi'}
  };

  const cache = new Map();
  let activeAudio = null;

  const $ = id => document.getElementById(id);
  const clean = x => String(x || '').replace(/\s+/g,' ').trim();
  const status = x => { const e=$('translationStatus'); if(e) e.textContent=x; };
  const toast = x => { if(typeof window.showToast==='function') window.showToast(x); };

  async function getJSON(url, timeout=10000){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const r=await fetch(url,{signal:controller.signal,cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  async function google(text,src,tgt){
    const url='https://translate.googleapis.com/translate_a/single?client=gtx&sl='+
      encodeURIComponent(src)+'&tl='+encodeURIComponent(tgt)+'&dt=t&q='+encodeURIComponent(text);
    const d=await getJSON(url,10000);
    const result=Array.isArray(d?.[0]) ? d[0].map(p=>p?.[0]||'').join('').trim() : '';
    if(!result) throw new Error('empty translation');
    return result;
  }

  async function myMemory(text,src,tgt){
    const url='https://api.mymemory.translated.net/get?q='+encodeURIComponent(text)+
      '&langpair='+encodeURIComponent(src+'|'+tgt);
    const d=await getJSON(url,10000);
    const raw=d?.responseData?.translatedText;
    if(!raw) throw new Error('empty backup translation');
    const box=document.createElement('textarea'); box.innerHTML=raw;
    return box.value.trim();
  }

  window.translateLesson=async function(){
    const input=$('inputText'), source=$('sourceLanguage'), target=$('targetLanguage'), out=$('translationResult');
    if(!input||!source||!target||!out) return;
    const text=clean(input.value), src=source.value, tgt=target.value;
    if(!text){toast('Enter or speak a sentence first.');return;}
    if(src===tgt){window.lastTranslation=text;out.textContent=text;status('✓ Same language — ready to speak.');return;}

    const sourceCode=L[src]?.tts || src;
    const targetCode=L[tgt]?.tts || tgt;
    const key=sourceCode+'|'+targetCode+'|'+text;
    if(cache.has(key)){
      window.lastTranslation=cache.get(key);out.textContent=window.lastTranslation;
      status('⚡ Cached translation — instant result.');return;
    }

    out.textContent='Translating…';
    status('🧠 Translating '+(L[src]?.name||src)+' → '+(L[tgt]?.name||tgt)+'…');
    try{
      let translated;
      try{ translated=await google(text,sourceCode,targetCode); }
      catch(e){ translated=await myMemory(text,sourceCode,targetCode); }
      translated=clean(translated);
      if(!translated) throw new Error('No translation');
      cache.set(key,translated);window.lastTranslation=translated;out.textContent=translated;
      status('✓ Translation completed.');toast('Translation completed!');
    }catch(e){
      console.error(e);window.lastTranslation='';
      out.textContent='Translation service is unavailable. Please retry.';
      status('⚠ Translation failed. Check internet connection and retry.');toast('Translation failed.');
    }
  };

  function browserSpeak(text,code){
    if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)) return Promise.reject(new Error('speech synthesis unsupported'));
    const wanted=(L[code]?.tts||code||'en').toLowerCase();
    const voices=speechSynthesis.getVoices();
    const voice=voices.find(v=>v.lang.toLowerCase()===wanted+'-in')||
      voices.find(v=>v.lang.toLowerCase()===wanted)||
      voices.find(v=>v.lang.toLowerCase().startsWith(wanted+'-'));
    if(!voice) return Promise.reject(new Error('no target voice'));
    return new Promise((resolve,reject)=>{
      const u=new SpeechSynthesisUtterance(text);
      u.lang=voice.lang;u.voice=voice;u.rate=.9;u.pitch=1;u.volume=1;
      u.onstart=()=>status('🔊 Playing '+(L[code]?.name||'target')+' voice…');
      u.onend=()=>{status('✓ Pronunciation completed.');resolve();};
      u.onerror=()=>reject(new Error('browser voice playback failed'));
      speechSynthesis.cancel();speechSynthesis.speak(u);
    });
  }

  /* Important desktop fix: create and start the audio from the button event path.
     The previous implementation awaited inside remoteSpeak before play(), which can
     trigger browser autoplay protection on desktop. */
  function remoteSpeak(text,code){
    const ttsCode=L[code]?.tts;
    if(!ttsCode) return Promise.reject(new Error('No remote TTS route'));
    const parts=[];const cleanText=clean(text);
    for(let i=0;i<cleanText.length;i+=160) parts.push(cleanText.slice(i,i+160));
    if(!parts.length) return Promise.reject(new Error('empty text'));

    return new Promise((resolve,reject)=>{
      let i=0;
      const next=()=>{
        if(i>=parts.length){activeAudio=null;status('✓ Pronunciation completed.');resolve();return;}
        const url='https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl='+
          encodeURIComponent(ttsCode)+'&q='+encodeURIComponent(parts[i])+'&r='+Date.now();
        const audio=new Audio();
        activeAudio=audio;
        audio.preload='auto';audio.src=url;
        audio.onplay=()=>status('🔊 Playing '+(L[code]?.name||'target')+' voice…');
        audio.onended=()=>{i++;next();};
        audio.onerror=()=>{activeAudio=null;reject(new Error('remote TTS unavailable'));};
        /* Call play immediately. This is critical for desktop autoplay policy. */
        const p=audio.play();
        if(p&&typeof p.catch==='function') p.catch(reject);
      };
      next();
    });
  }

  window.speakResult=function(){
    const out=$('translationResult'),target=$('targetLanguage');
    const text=clean(window.lastTranslation||out?.textContent);const code=target?.value||'en';
    if(!text||/Translation will appear|Translation service is unavailable|Translation failed|required/i.test(text)){
      toast('Translate text first.');return;
    }

    status('🔊 Preparing '+(L[code]?.name||'target language')+' voice…');

    // Odia explicitly uses remote audio first because Windows/browser installations
    // frequently do not expose an or-IN speechSynthesis voice.
    if(code==='or'){
      const remote=remoteSpeak(text,code);
      remote.catch(async()=>{
        try{await browserSpeak(text,code);}catch(e){
          status('⚠ Odia voice could not be played. Check internet access and try again.');
          toast('Odia voice playback failed.');
        }
      });
      return;
    }

    const remote=remoteSpeak(text,code);
    remote.then(()=>{}).catch(async()=>{
      try{await browserSpeak(text,code);}catch(e){
        status('⚠ Translated audio could not be played. Check internet access and try again.');
        toast('Voice playback failed.');
      }
    });
  };

  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('button').forEach(b=>{
      if(/native pronunciation/i.test(b.textContent)) b.textContent='🔊 Play Translation';
    });
    const note=$('translationStatus');if(note)note.textContent='✓ Translator ready — select languages and translate.';
    if('speechSynthesis' in window)speechSynthesis.getVoices();
  });
})();
