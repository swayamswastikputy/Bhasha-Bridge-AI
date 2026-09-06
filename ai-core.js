(() => {
  const API_URL = window.BHASHA_BRIDGE_AI_ENDPOINT || localStorage.getItem("BHASHA_BRIDGE_AI_ENDPOINT") || "";
  const state = { messages: [], busy:false, recognition:null };

  const el = id => document.getElementById(id);
  const messagesEl = () => el("aiMessages");
  const escapeHtml = s => String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

  function add(role, content){
    const node=document.createElement("div");
    node.className="ai-msg "+role;
    node.innerHTML=escapeHtml(content);
    messagesEl().appendChild(node);
    messagesEl().scrollTop=messagesEl().scrollHeight;
    return node;
  }
  function setStatus(text, online=false){
    const label=el("aiConnectionText"), dot=document.querySelector(".ai-status span");
    if(label) label.textContent=text;
    if(dot) dot.style.background=online?"#50e3a4":"#8b7cf6";
  }
  function newChat(){
    state.messages=[];
    messagesEl().innerHTML="";
    add("assistant","Hello! I’m BHASHA AI. Ask me about Mathematics, Science, English, Social Science, languages, definitions, formulas or step-by-step solutions. I can also use the connected AI service when available.");
    el("aiPrompt").focus();
  }

  const lessons = {
    photosynthesis:{d:"Photosynthesis is the process by which green plants make food using sunlight, carbon dioxide and water.",f:"Carbon dioxide + Water → Glucose + Oxygen",e:"Chlorophyll in leaves absorbs sunlight. The plant then uses that energy to prepare glucose.",q:"Why is chlorophyll important for photosynthesis?"},
    respiration:{d:"Respiration is the process in which living organisms release energy from food.",f:"Glucose + Oxygen → Carbon dioxide + Water + Energy",e:"Cells use released energy for growth, movement and all life processes.",q:"What is the difference between breathing and respiration?"},
    cell:{d:"A cell is the basic structural and functional unit of life.",f:"Key parts: cell membrane, cytoplasm and nucleus.",e:"Plant cells also typically contain a cell wall, chloroplasts and a large vacuole.",q:"Name two differences between plant and animal cells."},
    force:{d:"Force is a push or pull that can change an object's state of motion or shape.",f:"F = m × a",e:"Force may start, stop, speed up, slow down or change the direction of an object.",q:"Give three examples of force in daily life."},
    motion:{d:"Motion is the change in position of an object with time relative to a reference point.",f:"Speed = Distance ÷ Time",e:"Examples include linear, circular and periodic motion.",q:"A car travels 120 km in 2 hours. Find its speed."},
    pythagoras:{d:"Pythagoras theorem states that for a right-angled triangle, the square of the hypotenuse equals the sum of the squares of the other two sides.",f:"a² + b² = c²",e:"Example: 3² + 4² = 9 + 16 = 25, so c = 5.",q:"Find the hypotenuse when the other sides are 5 cm and 12 cm."},
    fraction:{d:"A fraction represents a part of a whole.",f:"Fraction = Numerator / Denominator",e:"For example, 3/4 means three equal parts out of four.",q:"Add 1/4 + 2/4."},
    algebra:{d:"Algebra uses symbols and variables to represent unknown quantities.",f:"Example: 2x + 3 = 11 → 2x = 8 → x = 4",e:"The same operation must be applied to both sides of an equation.",q:"Solve: 3x + 5 = 20."},
    democracy:{d:"Democracy is a system of government in which people participate in choosing their representatives.",f:"Key ideas: participation, equality, rule of law and accountability.",e:"India is the world's largest constitutional democracy.",q:"Why are free and fair elections important?"},
    constitution:{d:"A constitution is the fundamental framework of laws and principles by which a country is governed.",f:"India adopted its Constitution on 26 November 1949; it came into effect on 26 January 1950.",e:"It defines institutions, rights and responsibilities.",q:"What are Fundamental Rights?"},
    noun:{d:"A noun is a word used to name a person, place, thing or idea.",f:"Examples: Riya, Jharkhand, book, honesty.",e:"Common categories include proper, common, collective, material and abstract nouns.",q:"Identify the nouns in: 'The children played in the garden.'"},
    verb:{d:"A verb is a word that expresses an action, occurrence or state.",f:"Examples: run, write, is, become.",e:"Verbs change form according to tense and subject.",q:"Find the verb in: 'She reads every day.'"},
    adjective:{d:"An adjective describes or modifies a noun or pronoun.",f:"Examples: beautiful flower, three books, honest student.",e:"It can describe quality, quantity, number or possession.",q:"Identify the adjective in: 'It is a difficult question.'"}
  };

  function mathAnswer(q){
    const clean=q.toLowerCase().replace(/[?,]/g," ").trim();
    const m=clean.match(/(?:what is|calculate|solve)?\s*(\d+(?:\.\d+)?)\s*([+\-*\/])\s*(\d+(?:\.\d+)?)/);
    if(!m) return null;
    const a=Number(m[1]), op=m[2], b=Number(m[3]);
    let r;
    if(op==="+") r=a+b;
    if(op==="-") r=a-b;
    if(op==="*") r=a*b;
    if(op==="/") { if(b===0) return "Division by zero is undefined."; r=a/b; }
    return "Step-by-step solution:\n1. Expression: "+a+" "+op+" "+b+"\n2. Perform the operation.\n3. Answer = "+r+"\n\nTip: Check the answer by doing the inverse operation.";
  }

  function localAnswer(question){
    const q=question.toLowerCase().trim();
    const calc=mathAnswer(q);
    if(calc) return calc;

    if(/hello|hi|namaste/.test(q) && q.length<30)
      return "Hello! 👋 I’m BHASHA AI. Tell me your class, subject or question. I can explain concepts in simple steps and give examples and practice questions.";

    for(const [key,v] of Object.entries(lessons)){
      if(q.includes(key)){
        const hindi = /hindi|हिंदी|समझाओ/.test(q);
        if(hindi){
          return "📘 "+key.toUpperCase()+"\n\nपरिभाषा:\n"+v.d+"\n\nमुख्य सूत्र / तथ्य:\n"+v.f+"\n\nसरल व्याख्या:\n"+v.e+"\n\nअभ्यास प्रश्न:\n"+v.q;
        }
        return "📘 "+key.charAt(0).toUpperCase()+key.slice(1)+"\n\nDefinition:\n"+v.d+"\n\nFormula / Key fact:\n"+v.f+"\n\nSimple explanation:\n"+v.e+"\n\nPractice question:\n"+v.q;
      }
    }

    const generalKnowledge = [
      {keys:["capital of india","india capital"], answer:"The capital of India is New Delhi. It is the seat of the Government of India."},
      {keys:["president of india"], answer:"For current office-holder questions, a live AI/backend connection should be used because this information can change. In general, the President is the constitutional head of the Republic of India."},
      {keys:["national animal of india"], answer:"The national animal of India is the Bengal Tiger (Panthera tigris tigris)."},
      {keys:["national bird of india"], answer:"The national bird of India is the Indian Peacock (Pavo cristatus)."},
      {keys:["national flower of india"], answer:"The national flower of India is the Lotus (Nelumbo nucifera)."},
      {keys:["national anthem of india"], answer:"India's national anthem is Jana Gana Mana, written by Rabindranath Tagore."},
      {keys:["national song of india"], answer:"India's national song is Vande Mataram, written by Bankim Chandra Chattopadhyay."},
      {keys:["father of nation","father of the nation"], answer:"Mahatma Gandhi is widely known as the Father of the Nation in India."},
      {keys:["largest state in india"], answer:"Rajasthan is the largest Indian state by area."},
      {keys:["smallest state in india"], answer:"Goa is the smallest Indian state by area."},
      {keys:["longest river in india"], answer:"The Ganga is commonly taught as India's longest river."},
      {keys:["highest mountain in india"], answer:"Kangchenjunga is the highest mountain peak located in India."},
      {keys:["how many states in india","number of states in india"], answer:"India has 28 states and 8 Union Territories."},
      {keys:["independence day"], answer:"India celebrates Independence Day on 15 August, marking independence in 1947."},
      {keys:["republic day"], answer:"India celebrates Republic Day on 26 January, commemorating the Constitution coming into effect in 1950."},
      {keys:["jharkhand capital"], answer:"The capital of Jharkhand is Ranchi."},
      {keys:["jharkhand formation","jharkhand foundation day"], answer:"Jharkhand was formed on 15 November 2000. The date is also observed as Jharkhand Foundation Day."},
      {keys:["first prime minister of india"], answer:"Jawaharlal Nehru was the first Prime Minister of independent India."},
      {keys:["largest planet"], answer:"Jupiter is the largest planet in our Solar System."},
      {keys:["smallest planet"], answer:"Mercury is the smallest planet in our Solar System."},
      {keys:["red planet"], answer:"Mars is known as the Red Planet because iron oxide gives its surface a reddish appearance."},
      {keys:["sun is a"], answer:"The Sun is a star. It is the central star of our Solar System."},
      {keys:["water formula","formula of water"], answer:"The chemical formula of water is H₂O: two hydrogen atoms and one oxygen atom."},
      {keys:["who invented telephone","invented telephone"], answer:"Alexander Graham Bell is commonly credited with inventing and patenting the first practical telephone."},
      {keys:["largest ocean"], answer:"The Pacific Ocean is the largest ocean on Earth."}
    ];
    const gk = generalKnowledge.find(item => item.keys.some(key => q.includes(key)));
    if(gk) return "🌍 General Knowledge\n\n"+gk.answer+"\n\n💡 Want to learn more? Ask me for the definition, history, importance or a quiz on this topic.";
    
    const subject = /math|equation|geometry|number|fraction|algebra/.test(q) ? "Mathematics" :
      /science|plant|physics|chemistry|biology|cell|energy/.test(q) ? "Science" :
      /history|geography|civics|democracy|constitution/.test(q) ? "Social Science" :
      /grammar|english|noun|verb|adjective/.test(q) ? "Language" : "General Studies";

    return "I don't have a reliable answer for that question in offline mode yet. Please ask a specific school or general-knowledge question, for example: What is gravity? What is the capital of India? Explain photosynthesis.";
  }

  async function tryBackend(prompt){
    if(!API_URL) throw new Error("No backend configured");
    const res=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      messages:[
        {role:"system",content:"You are BHASHA AI, a multilingual educational assistant for Jharkhand and CBSE students. Give accurate age-appropriate explanations. Structure answers with Definition, Explanation, Example, Key Points and Practice Question when useful. Do not invent syllabus facts."},
        ...state.messages,
        {role:"user",content:prompt}
      ]
    })});
    if(!res.ok) throw new Error("Backend returned "+res.status);
    const data=await res.json();
    return data.reply || data.message || data.output || data.choices?.[0]?.message?.content;
  }

  async function send(){
    const prompt=el("aiPrompt").value.trim();
    if(!prompt||state.busy)return;
    add("user",prompt);
    state.messages.push({role:"user",content:prompt});
    el("aiPrompt").value="";
    state.busy=true; el("aiSendBtn").disabled=true;
    const typing=add("assistant","Thinking…");
    try{
      let reply;
      try{
        reply=await tryBackend(prompt);
        if(!reply) throw new Error("Empty reply");
        setStatus("Live AI connected",true);
      }catch(err){
        reply=localAnswer(prompt);
        setStatus("Study assistant mode",true);
      }
      typing.remove();
      add("assistant",reply);
      state.messages.push({role:"assistant",content:reply});
    }catch(err){
      typing.remove();
      add("assistant","I could not process that question. Please try again with the topic and your class.");
      setStatus("Ready",true);
    }finally{
      state.busy=false;
      el("aiSendBtn").disabled=false;
    }
  }

  function voiceInput(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){add("assistant","Voice input requires Chrome or another browser supporting Web Speech Recognition.");return;}
    if(state.recognition){try{state.recognition.stop()}catch(e){}state.recognition=null;return;}
    const r=new SR(); state.recognition=r; r.lang="en-IN"; r.interimResults=true; r.continuous=false;
    r.onresult=e=>{let t=""; for(let i=e.resultIndex;i<e.results.length;i++) t+=e.results[i][0].transcript+" "; el("aiPrompt").value=t.trim();};
    r.onend=()=>state.recognition=null;
    r.onerror=()=>{state.recognition=null; add("assistant","I couldn't hear that clearly. Please try speaking again or type your question.");};
    r.start();
  }

  document.addEventListener("DOMContentLoaded",()=>{
    newChat();
    el("aiSendBtn").onclick=send;
    el("newChatBtn").onclick=newChat;
    el("clearChatBtn").onclick=newChat;
    el("aiVoiceBtn").onclick=voiceInput;
    el("aiPrompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}});
    setStatus(API_URL ? "Connecting to AI service…" : "Study assistant ready",true);
  });
})();