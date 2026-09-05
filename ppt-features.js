/* Bhasha Bridge AI: UI actions for PPT-aligned architecture */
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll('a[href="#architecture"],a[href="#impact"],a[href="#roadmap"]').forEach(a=>a.addEventListener("click",e=>{
    e.preventDefault(); document.querySelector(a.getAttribute("href"))?.scrollIntoView({behavior:"smooth"});
  }));
  const brand=document.querySelectorAll(".brand, .ai-sidebar h3, .ai-chat-head b");
  brand.forEach(node=>{ if(node.textContent.includes("Bhasha AI")) node.textContent=node.textContent.replace(/Bhasha AI/g,"Bhasha Bridge AI"); });
});