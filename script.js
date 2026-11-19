const symbols = ["🀄","🀅","🀆","🀇","🀈","🀉","🀊","🀋","🀌","🀍"];
let credits = 1000, bet = 10, busy = false;
const $ = id => document.getElementById(id);
const reels = [...document.querySelectorAll(".reel")];
function render(){ $("credits").textContent=credits; $("betLabel").textContent=bet; $("betValue").textContent=bet; }
function randomSymbol(){return symbols[Math.floor(Math.random()*symbols.length)];}
function spin(){
  if(busy)return;
  if(credits<bet){$("message").textContent="เครดิตไม่พอ กรุณารีเซ็ตเครดิต";return;}
  busy=true; credits-=bet; $("win").textContent="0"; $("spin").disabled=true; render();
  let ticks=0;
  const timer=setInterval(()=>{
    reels.forEach(r=>r.textContent=randomSymbol());
    ticks++;
    if(ticks>=12){
      clearInterval(timer);
      const result=reels.map(()=>randomSymbol());
      reels.forEach((r,i)=>r.textContent=result[i]);
      const counts={}; result.forEach(s=>counts[s]=(counts[s]||0)+1);
      const matches=Math.max(...Object.values(counts));
      let prize=0;
      if(matches>=3) prize=bet*(matches===3?2:matches===4?5:12);
      credits+=prize; $("win").textContent=prize;
      $("message").textContent=prize?`ยินดีด้วย! ได้ ${prize} เครดิตทดลอง`:"ยังไม่ถูกรางวัล ลองใหม่ได้";
      busy=false; $("spin").disabled=false; render();
    }
  },85);
}
$("spin").addEventListener("click",spin);
$("minus").addEventListener("click",()=>{if(!busy){bet=Math.max(10,bet-10);render();}});
$("plus").addEventListener("click",()=>{if(!busy){bet=Math.min(100,bet+10);render();}});
$("reset").addEventListener("click",()=>{if(!busy){credits=1000;bet=10;$("win").textContent="0";$("message").textContent="รีเซ็ตเครดิตแล้ว";render();}});
render();