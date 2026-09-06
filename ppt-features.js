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