/* BHASHA AI — FINAL TRANSLATOR & PRONUNCIATION RUNTIME */
(() => {
'use strict';
const LANG={
 en:{name:'English',translate:'en',locale:'en-IN'},hi:{name:'Hindi',translate:'hi',locale:'hi-IN'},
 bn:{name:'Bengali',translate:'bn',locale:'bn-IN'},or:{name:'Odia',translate:'or',locale:'or-IN'},
 ur:{name:'Urdu',translate:'ur',locale:'ur-IN'},ta:{name:'Tamil',translate:'ta',locale:'ta-IN'},
 te:{name:'Telugu',translate:'te',locale:'te-IN'},mr:{name:'Marathi',translate:'mr',locale:'mr-IN'}
};
const NATIVE=new Set(['sat','unr','hoc','kru','kha','nag','kfy','kho','ppg']);
const $=id=>document.getElementById(id);
const clean=x=>String(x||'').replace(/\s+/g,' ').trim();
const cache=new Map();
let audio=null, speaking=false;

function setStatus(x){const e=$('translationStatus');if(e)e.textContent=x}
function toast(x){window.showToast?.(x)}
async function fetchJSON(url,ms=9000){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);
 try{const r=await fetch(url,{signal:c.signal,cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}
 finally{clearTimeout(timer)}
}
async function translateGoogle(text,src,tgt){
 const u='https://translate.googleapis.com/translate_a/single?client=gtx&sl='+encodeURIComponent(src)+'&tl='+encodeURIComponent(tgt)+'&dt=t&q='+encodeURIComponent(text);
 const d=await fetchJSON(u);const out=Array.isArray(d?.[0])?d[0].map(x=>x?.[0]||'').join('').trim():'';
 if(!out)throw Error('Empty translation');return out;
}
async function translateBackup(text,src,tgt){
 const d=await fetchJSON('https://api.mymemory.translated.net/get?q='+encodeURIComponent(text)+'&langpair='+encodeURIComponent(src+'|'+tgt));
 const raw=d?.responseData?.translatedText;if(!raw)throw Error('Empty backup');
 const t=document.createElement('textarea');t.innerHTML=raw;return clean(t.value);
}

window.translateLesson=async()=>{
 const input=$('inputText'),s=$('sourceLanguage'),t=$('targetLanguage'),out=$('translationResult');
 if(!input||!s||!t||!out)return;
 const text=clean(input.value),src=s.value,tgt=t.value;
 if(!text){toast('Enter or speak text first.');return}
 if(src===tgt){window.lastTranslation=text;out.textContent=text;setStatus('✓ Ready to play pronunciation.');return}
 if(NATIVE.has(src)||NATIVE.has(tgt)){
   out.textContent='Dedicated AI model required for this native-language pair.';
   window.lastTranslation='';
   setStatus('⚠ This prototype does not fake translation for this language. A dedicated Santali/Jharkhand-language backend is required.');
   return;
 }
 const key=src+'|'+tgt+'|'+text;
 if(cache.has(key)){window.lastTranslation=cache.get(key);out.textContent=window.lastTranslation;setStatus('⚡ Instant cached translation.');return}
 out.textContent='Translating…';setStatus('🧠 Translating sentence…');
 try{
   let result;try{result=await translateGoogle(text,LANG[src]?.translate||src,LANG[tgt]?.translate||tgt)}
   catch(e){result=await translateBackup(text,LANG[src]?.translate||src,LANG[tgt]?.translate||tgt)}
   result=clean(result);cache.set(key,result);window.lastTranslation=result;out.textContent=result;setStatus('✓ Translation completed. Click Play Translation.');
 }catch(e){console.error(e);window.lastTranslation='';out.textContent='Translation failed. Please check your internet and retry.';setStatus('⚠ Translation service unavailable.')}
};

function voices(){return ('speechSynthesis'in window)?speechSynthesis.getVoices():[]}
function chooseVoice(code){
 const all=voices(),wanted=(LANG[code]?.locale||'en-US').toLowerCase(),base=wanted.split('-')[0];
 return all.find(v=>v.lang.toLowerCase()===wanted)||
        all.find(v=>v.lang.toLowerCase().startsWith(base+'-'))||
        all.find(v=>v.lang.toLowerCase().startsWith(base))||
        all.find(v=>v.default)||all[0]||null;
}
function speakBrowser(text,code){
 return new Promise((resolve,reject)=>{
  if(!('speechSynthesis'in window))return reject(Error('Speech synthesis unavailable'));
  const run=()=>{
   const v=chooseVoice(code),u=new SpeechSynthesisUtterance(text);
   // IMPORTANT: Never fail just because exact native voice is missing.
   u.voice=v||null;u.lang=v?.lang||LANG[code]?.locale||'en-US';u.rate=.88;u.pitch=1;u.volume=1;
   u.onstart=()=>setStatus(v?'🔊 Playing pronunciation…':'🔊 Playing with system voice…');
   u.onend=()=>resolve();u.onerror=e=>reject(Error(e.error||'Speech failed'));
   speechSynthesis.cancel();setTimeout(()=>speechSynthesis.speak(u),80);
  };
  if(voices().length)run();
  else{
   let done=false;
   const timer=setTimeout(()=>{if(!done){done=true;run()}},700);
   speechSynthesis.onvoiceschanged=()=>{if(!done){done=true;clearTimeout(timer);run()}};
   speechSynthesis.getVoices();
  }
 });
}
function speakRemote(text,code){
 // Backup only. Browser TTS is primary because desktop autoplay/CORS policies can block remote audio.
 const lang=LANG[code]?.translate;if(!lang)return Promise.reject(Error('No remote route'));
 return new Promise((resolve,reject)=>{
  const url='https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl='+encodeURIComponent(lang)+'&q='+encodeURIComponent(text.slice(0,180))+'&r='+Date.now();
  audio?.pause();audio=new Audio(url);audio.crossOrigin='anonymous';
  audio.onended=resolve;audio.onerror=()=>reject(Error('Remote audio failed'));
  const p=audio.play();if(p)p.catch(reject);
 });
}
window.speakResult=async()=>{
 const out=$('translationResult'),target=$('targetLanguage');
 const text=clean(window.lastTranslation||out?.textContent),code=target?.value||'en';
 if(!text||/translation will appear|translation failed|dedicated ai model|required/i.test(text)){toast('Translate valid text first.');return}
 if(NATIVE.has(code)){setStatus('⚠ Native pronunciation model is not connected for this language yet.');toast('Dedicated native TTS backend required.');return}
 if(speaking){speechSynthesis?.cancel();audio?.pause();speaking=false;setStatus('Playback stopped.');return}
 speaking=true;setStatus('🔊 Preparing voice…');
 try{await speakBrowser(text,code);setStatus('✓ Pronunciation completed.')}
 catch(e){console.warn('Browser TTS failed',e);try{await speakRemote(text,code);setStatus('✓ Pronunciation completed.')}catch(e2){console.error(e2);setStatus('⚠ Voice playback failed. In Chrome/Edge, click the button again and ensure system audio is enabled.');toast('Voice could not be played.')}}
 finally{speaking=false}
};
document.addEventListener('DOMContentLoaded',()=>{
 if('speechSynthesis'in window){speechSynthesis.getVoices();speechSynthesis.onvoiceschanged=()=>speechSynthesis.getVoices()}
 const b=[...document.querySelectorAll('button')].find(x=>/play translation|pronunciation/i.test(x.textContent));if(b)b.textContent='🔊 Play Translation';
 setStatus('✓ Translator ready.');
});
})();