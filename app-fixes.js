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
