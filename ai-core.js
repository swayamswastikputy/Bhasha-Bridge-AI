(() => {
  const API_URL = window.BHASHABRIDGE_AI_ENDPOINT || localStorage.getItem("BHASHABRIDGE_AI_ENDPOINT") || "/api/chat";
  const state = { messages: [], busy:false, recognition:null };

  const el = id => document.getElementById(id);
  const messagesEl = () => el("aiMessages");

  function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
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
    if(dot) dot.style.background=online?"#50e3a4":"#ffc857";
  }
  function newChat(){
    state.messages=[];
    messagesEl().innerHTML="";
    add("assistant","Hello! I’m Bhasha AI. Ask me anything about learning, languages, concepts, or your studies.");
    el("aiPrompt").focus();
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
      const res=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        messages:[
          {role:"system",content:"You are Bhasha AI, a helpful multilingual educational assistant for students in Jharkhand. Answer naturally, accurately, and conversationally. Adapt explanations to the student's level. Do not pretend to know facts you are unsure about."},
          ...state.messages
        ]
      })});
      if(!res.ok) throw new Error("AI backend returned "+res.status);
      const data=await res.json();
      const reply=data.reply || data.message || data.output || data.choices?.[0]?.message?.content;
      if(!reply) throw new Error("No AI reply received");
      typing.remove();
      add("assistant",reply);
      state.messages.push({role:"assistant",content:reply});
      setStatus("AI connected",true);
    }catch(err){
      typing.remove();
      const isMissing = err instanceof TypeError || /404|Failed to fetch|backend returned/i.test(String(err.message||err));
      add("system", isMissing
        ? "⚠️ Live AI service is not configured for this GitHub Pages deployment. The chat interface is working, but a real AI model cannot run directly inside static GitHub Pages."
        : "⚠️ The AI service is temporarily unavailable. Please try again.");
      setStatus("Live AI service unavailable",false);
      console.error(err);
    }finally{state.busy=false;el("aiSendBtn").disabled=false;}
  }
  function voiceInput(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){add("system","Voice input requires Chrome or another browser that supports Web Speech Recognition.");return;}
    if(state.recognition){try{state.recognition.stop()}catch(e){}state.recognition=null;return;}
    const r=new SR();state.recognition=r;r.lang="en-IN";r.interimResults=true;r.continuous=false;
    r.onresult=e=>{let t="";for(let i=e.resultIndex;i<e.results.length;i++)t+=e.results[i][0].transcript+" ";el("aiPrompt").value=t.trim();};
    r.onend=()=>{state.recognition=null;};r.start();
  }
  document.addEventListener("DOMContentLoaded",()=>{
    newChat();
    el("aiSendBtn").onclick=send;
    el("newChatBtn").onclick=newChat;
    el("clearChatBtn").onclick=newChat;
    el("aiVoiceBtn").onclick=voiceInput;
    el("aiPrompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}});
    setStatus("Connecting to AI service…",false);
  });
})();