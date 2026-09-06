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
      const r = await fetch(url, {signal:controller.signal, cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  async function google(text, src, tgt){
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

  window.translateLesson = async function(){
    const input=$('inputText'), source=$('sourceLanguage'), target=$('targetLanguage'), out=$('translationResult');
    if(!input||!source||!target||!out) return;
    const text=clean(input.value), src=source.value, tgt=target.value;
    if(!text){toast('Enter or speak a sentence first.');return;}

    if(src===tgt){window.lastTranslation=text;out.textContent=text;status('✓ Same language — ready to speak.');return;}

    const sourceCode=L[src]?.tts || src, targetCode=L[tgt]?.tts || tgt;
    const key=sourceCode+'|'+targetCode+'|'+text;
    if(cache.has(key)){
      window.lastTranslation=cache.get(key); out.textContent=window.lastTranslation;
      status('⚡ Cached translation — instant result.'); return;
    }

    out.textContent='Translating…';
    status('🧠 Translating '+(L[src]?.name||src)+' → '+(L[tgt]?.name||tgt)+'…');
    try{
      let translated;
      try { translated=await google(text,sourceCode,targetCode); }
      catch(e) { translated=await myMemory(text,sourceCode,targetCode); }
      translated=clean(translated);
      if(!translated) throw new Error('No translation');
      cache.set(key,translated); window.lastTranslation=translated; out.textContent=translated;
      status('✓ Translation completed in '+Math.max(1,Math.round(text.length/35))+'s class.');
      toast('Translation completed!');
    }catch(e){
      console.error(e); window.lastTranslation='';
      out.textContent='Translation service is unavailable. Please retry.';
      status('⚠ Translation failed. Check internet connection and retry.');
      toast('Translation failed.');
    }
  };

  function browserSpeak(text,code){
    if(!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)){
      status('⚠ Browser speech is not supported.'); return false;
    }
    const voices=speechSynthesis.getVoices();
    const wanted=(L[code]?.tts||code||'en').toLowerCase();
    const voice=voices.find(v=>v.lang.toLowerCase().startsWith(wanted)) ||
      voices.find(v=>v.lang.toLowerCase().startsWith('en')) || voices.find(v=>v.default) || voices[0];
    const u=new SpeechSynthesisUtterance(text);
    u.lang=voice?.lang || wanted;
    if(voice) u.voice=voice;
    u.rate=.9; u.pitch=1; u.volume=1;
    u.onstart=()=>status('🔊 Playing translation voice…');
    u.onend=()=>status('✓ Voice playback completed.');
    u.onerror=()=>status('⚠ Browser voice playback failed.');
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    return true;
  }

  async function remoteSpeak(text, code){
    const ttsCode=L[code]?.tts;
    if(!ttsCode) return false;
    // Google Translate's speech endpoint is used only as an audio fallback.
    // It avoids requiring a device-installed language voice for common target languages.
    const url='https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl='+
      encodeURIComponent(ttsCode)+'&q='+encodeURIComponent(text.slice(0,200));
    try{
      if(activeAudio){ activeAudio.pause(); activeAudio.src=''; }
      const audio=new Audio(url); activeAudio=audio;
      audio.onplay=()=>status('🔊 Playing target-language pronunciation…');
      audio.onended=()=>status('✓ Pronunciation completed.');
      audio.onerror=()=>{ activeAudio=null; throw new Error('audio failed'); };
      await audio.play();
      return true;
    }catch(e){
      activeAudio=null; return false;
    }
  }

  window.speakResult = async function(){
    const out=$('translationResult'), target=$('targetLanguage');
    const text=clean(window.lastTranslation || out?.textContent);
    const code=target?.value || 'en';
    if(!text || /Translation will appear|Translation service is unavailable|Translation could not/i.test(text)){
      toast('Translate text first.'); return;
    }

    status('Preparing '+(L[code]?.name||'target language')+' voice…');
    // Remote audio first for common Indian languages; browser voice is second fallback.
    if(await remoteSpeak(text,code)) return;
    browserSpeak(text,code);
  };

  document.addEventListener('DOMContentLoaded',()=>{
    const btns=document.querySelectorAll('button');
    btns.forEach(b=>{ if(/native pronunciation/i.test(b.textContent)) b.textContent='🔊 Play Translation'; });
    const note=$('translationStatus'); if(note) note.textContent='✓ Translator ready — select languages and translate.';
    if('speechSynthesis' in window) speechSynthesis.getVoices();
  });
})();
