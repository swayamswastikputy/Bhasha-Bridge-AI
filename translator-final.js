/* BHASHA AI — ROBUST TRANSLATOR & DESKTOP VOICE RUNTIME */
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
let audio=null, speaking=false, activeUtterance=null;

function setStatus(x){const e=$('translationStatus');if(e)e.textContent=x}
function toast(x){window.showToast?.(x)}

async function fetchJSON(url,ms=10000){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);
 try{
   const r=await fetch(url,{signal:c.signal,cache:'no-store'});
   if(!r.ok)throw Error('HTTP '+r.status);
   return await r.json();
 } finally { clearTimeout(timer); }
}

async function translateGoogle(text,src,tgt){
 const u='https://translate.googleapis.com/translate_a/single?client=gtx&sl='+encodeURIComponent(src)+'&tl='+encodeURIComponent(tgt)+'&dt=t&q='+encodeURIComponent(text);
 const d=await fetchJSON(u);
 const out=Array.isArray(d?.[0])?d[0].map(x=>x?.[0]||'').join('').trim():'';
 if(!out)throw Error('Empty translation');
 return out;
}
async function translateBackup(text,src,tgt){
 const d=await fetchJSON('https://api.mymemory.translated.net/get?q='+encodeURIComponent(text)+'&langpair='+encodeURIComponent(src+'|'+tgt));
 const raw=d?.responseData?.translatedText;
 if(!raw)throw Error('Empty backup');
 const t=document.createElement('textarea');t.innerHTML=raw;
 return clean(t.value);
}

window.translateLesson=async()=>{
 const input=$('inputText'),s=$('sourceLanguage'),t=$('targetLanguage'),out=$('translationResult');
 if(!input||!s||!t||!out)return;
 const text=clean(input.value),src=s.value,tgt=t.value;
 if(!text){toast('Enter or speak text first.');return;}
 if(src===tgt){
   window.lastTranslation=text;out.textContent=text;
   setStatus('✓ Ready to play pronunciation.');
   return;
 }
 if(NATIVE.has(src)||NATIVE.has(tgt)){
   out.textContent='Dedicated AI model required for this native-language pair.';
   window.lastTranslation='';
   setStatus('⚠ Native-language translation backend is not connected yet.');
   return;
 }
 const key=src+'|'+tgt+'|'+text;
 if(cache.has(key)){
   window.lastTranslation=cache.get(key);out.textContent=window.lastTranslation;
   setStatus('⚡ Instant cached translation.');
   return;
 }
 out.textContent='Translating…';setStatus('🧠 Translating sentence…');
 try{
   let result;
   try{result=await translateGoogle(text,LANG[src]?.translate||src,LANG[tgt]?.translate||tgt);}
   catch(_){result=await translateBackup(text,LANG[src]?.translate||src,LANG[tgt]?.translate||tgt);}
   result=clean(result);cache.set(key,result);window.lastTranslation=result;out.textContent=result;
   setStatus('✓ Translation completed. Click Play Translation.');
 }catch(e){
   console.error(e);window.lastTranslation='';
   out.textContent='Translation failed. Please check your internet and retry.';
   setStatus('⚠ Translation service unavailable.');
 }
};

function getVoices(){return ('speechSynthesis'in window)?speechSynthesis.getVoices():[];}
function chooseVoice(code){
 const all=getVoices(), wanted=(LANG[code]?.locale||'en-US').toLowerCase(), base=wanted.split('-')[0];
 return all.find(v=>v.lang.toLowerCase()===wanted) ||
        all.find(v=>v.lang.toLowerCase().startsWith(base+'-')) ||
        all.find(v=>v.lang.toLowerCase().startsWith(base)) ||
        null;
}
function waitForVoices(ms=1800){
 return new Promise(resolve=>{
   if(!('speechSynthesis'in window))return resolve([]);
   const existing=getVoices(); if(existing.length)return resolve(existing);
   let done=false;
   const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve(getVoices());};
   const timer=setTimeout(finish,ms);
   speechSynthesis.onvoiceschanged=finish;
   speechSynthesis.getVoices();
 });
}

/* Browser TTS fallback. Keep utterance globally alive and resume desktop speech engine. */
async function speakBrowser(text,code){
 if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window))throw Error('Speech synthesis unavailable');
 await waitForVoices();
 const v=chooseVoice(code), u=new SpeechSynthesisUtterance(text);
 activeUtterance=u;
 u.voice=v||null;
 u.lang=v?.lang||LANG[code]?.locale||'en-US';
 u.rate=.88;u.pitch=1;u.volume=1;
 return new Promise((resolve,reject)=>{
   let started=false, finished=false;
   const fail=e=>{if(finished)return;finished=true;activeUtterance=null;reject(e);};
   const timer=setTimeout(()=>{
     if(!started){try{speechSynthesis.cancel();}catch(_){};fail(Error('Browser voice did not start'));}},3500);
   u.onstart=()=>{
     started=true;clearTimeout(timer);
     setStatus('🔊 Playing pronunciation with system voice…');
     try{speechSynthesis.resume();}catch(_){}
   };
   u.onend=()=>{
     if(finished)return;finished=true;clearTimeout(timer);activeUtterance=null;resolve();
   };
   u.onerror=e=>{clearTimeout(timer);fail(Error(e.error||'Speech failed'));};
   try{
     speechSynthesis.cancel();
     setTimeout(()=>{
       try{
         speechSynthesis.resume();
         speechSynthesis.speak(u);
         // Chrome desktop can pause queued speech; resume once more after queuing.
         setTimeout(()=>{try{if(speechSynthesis.paused)speechSynthesis.resume();}catch(_){}},120);
       }catch(e){fail(e);}
     },100);
   }catch(e){fail(e);}
 });
}

function playAudioUrl(url){
 return new Promise((resolve,reject)=>{
   const a=new Audio();
   audio?.pause?.(); audio=a;
   a.preload='auto';a.volume=1;a.muted=false;a.playsInline=true;
   a.src=url;
   let started=false,done=false;
   const finish=(err)=>{
     if(done)return;done=true;clearTimeout(timer);
     a.oncanplay=a.onplaying=a.onended=a.onerror=null;
     err?reject(err):resolve();
   };
   const timer=setTimeout(()=>finish(Error('Audio start timeout')),7000);
   a.onplaying=()=>{started=true;setStatus('🔊 Playing pronunciation…');};
   a.onended=()=>finish();
   a.onerror=()=>finish(Error('Remote audio failed'));
   a.load();
   const tryPlay=()=>{
     const p=a.play();
     if(p)p.catch(e=>finish(e));
   };
   a.oncanplay=tryPlay;
   // Some browsers already have enough data before handler.
   setTimeout(()=>{if(!started&&!done)tryPlay();},250);
 });
}

async function speakRemote(text,code){
 const lang=LANG[code]?.translate;
 if(!lang)throw Error('No remote TTS route');
 // Google TTS has practical URL length limits, so play short chunks sequentially.
 const chunks=[];
 const words=clean(text).split(' ');
 let part='';
 for(const word of words){
   if((part+' '+word).trim().length>170){if(part)chunks.push(part);part=word;}
   else part=(part+' '+word).trim();
 }
 if(part)chunks.push(part);
 for(const chunk of chunks){
   const q=encodeURIComponent(chunk),tl=encodeURIComponent(lang),stamp=Date.now();
   const urls=[
     'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl='+tl+'&q='+q+'&r='+stamp,
     'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl='+tl+'&q='+q+'&r='+stamp
   ];
   let last;
   for(const url of urls){
     try{await playAudioUrl(url);last=null;break;}
     catch(e){last=e;console.warn('TTS endpoint failed:',e);}
   }
   if(last)throw last;
 }
}

window.speakResult=async()=>{
 const out=$('translationResult'),target=$('targetLanguage');
 const text=clean(window.lastTranslation||out?.textContent);
 const code=target?.value||'en';
 if(!text||/translation will appear|translation failed|dedicated ai model|required/i.test(text)){
   toast('Translate valid text first.');return;
 }
 if(NATIVE.has(code)){
   setStatus('⚠ Native pronunciation model is not connected for this language yet.');
   toast('Dedicated native TTS backend required.');
   return;
 }
 if(speaking){
   try{speechSynthesis?.cancel();}catch(_){}
   try{audio?.pause();audio.currentTime=0;}catch(_){}
   speaking=false;setStatus('Playback stopped.');return;
 }
 speaking=true;setStatus('🔊 Preparing voice…');
 try{
   // Remote audio first: it does not depend on a Windows language voice being installed.
   await speakRemote(text,code);
   setStatus('✓ Pronunciation completed.');
 }catch(remoteError){
   console.warn('Remote TTS unavailable, switching to browser TTS.',remoteError);
   try{
     await speakBrowser(text,code);
     setStatus('✓ Pronunciation completed.');
   }catch(browserError){
     console.error('All TTS methods failed:',browserError);
     setStatus('⚠ Voice could not start. Check browser autoplay/site sound permissions and try again.');
     toast('Voice playback failed. Please allow sound for this website.');
   }
 }finally{
   speaking=false;activeUtterance=null;
 }
};

document.addEventListener('DOMContentLoaded',()=>{
 if('speechSynthesis'in window){speechSynthesis.getVoices();setTimeout(()=>speechSynthesis.getVoices(),500);}
 const b=[...document.querySelectorAll('button')].find(x=>/play translation|pronunciation/i.test(x.textContent));
 if(b)b.textContent='🔊 Play Translation';
 setStatus('✓ Translator ready.');
});
})();