const $=id=>document.getElementById(id);
const symbols=[{s:"🐉",v:10},{s:"🀄",v:8},{s:"🀅",v:5},{s:"🀆",v:4},{s:"🀇",v:3},{s:"🀈",v:2},{s:"🀉",v:2},{s:"🀊",v:1},{s:"🀋",v:1},{s:"✨",wild:true},{s:"🎁",scatter:true}];
let balance=10000,bet=20,lastWin=0,free=0,mult=1,busy=false,auto=false,sound=true;
const grid=$("grid");
function pick(){let n=Math.random();if(n<.025)return symbols[9];if(n<.055)return symbols[10];return symbols[Math.floor(Math.random()*9)];}
function draw(board){grid.innerHTML="";board.forEach((row,c)=>row.forEach((item,r)=>{let el=document.createElement("div");el.className="tile"+(item.wild||item.scatter?" special":"");el.textContent=item.s;el.dataset.c=c;el.dataset.r=r;grid.appendChild(el)}));}
function makeBoard(){return Array.from({length:5},()=>Array.from({length:4},pick));}
let board=makeBoard();draw(board);
function ui(){$("balance").textContent=balance.toLocaleString("th-TH");$("betReadout").textContent=bet;$("betValue").textContent=bet;$("lastWin").textContent=lastWin.toLocaleString("th-TH");$("multiplier").textContent="ตัวคูณ x"+mult;$("status").textContent=free?`FREE SPINS เหลือ ${free}`:"พร้อมเริ่มเกม";}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
function evaluate(b){
 const wins=[], scatterCount=b.flat().filter(x=>x.scatter).length;
 // Demo ways: symbols must appear in consecutive reels from the left; wild substitutes.
 for(let si=0;si<9;si++){let sym=symbols[si],ways=1,cols=0,positions=[];
  for(let c=0;c<5;c++){let rows=[];for(let r=0;r<4;r++)if(b[c][r]===sym||b[c][r].wild)rows.push(r);
   if(!rows.length)break;cols++;ways*=rows.length;positions.push(...rows.map(r=>[c,r]));}
  if(cols>=3)wins.push({sym,cols,ways,positions,pay:sym.v*ways*(cols===3?1:cols===4?2:5)});
 }
 return {wins,scatterCount};
}
async function play(){
 if(busy)return;if(free===0&&balance<bet){$("status").textContent="เครดิตไม่พอ กรุณารีเซ็ต";return}
 busy=true;$("spin").disabled=true;
 if(free===0)balance-=bet;else free--;
 mult=free?Math.min(mult+1,10):1;ui();
 board=makeBoard();draw(board);await wait(450);
 let total=0,round=evaluate(board),cascades=0;
 while(round.wins.length&&cascades<4){
  let positions=new Set(round.wins.flatMap(w=>w.positions.map(p=>p.join(","))));
  grid.querySelectorAll(".tile").forEach(el=>{if(positions.has(el.dataset.c+","+el.dataset.r))el.classList.add("win")});
  let payout=round.wins.reduce((s,w)=>s+w.pay,0)*bet/10*mult;total+=Math.floor(payout);
  $("status").textContent=`ชนะ ${Math.floor(payout).toLocaleString()} เครดิต • Cascade ${cascades+1}`;await wait(450);
  board=board.map(col=>col.map(x=>positions.has(board.indexOf(col)+","+col.indexOf(x))?pick():x)); // replaced below with reliable per-cell refill
  board=board.map((col,c)=>col.map((x,r)=>positions.has(c+","+r)?pick():x));
  draw(board);await wait(350);round=evaluate(board);cascades++;
 }
 let sc=board.flat().filter(x=>x.scatter).length;
 if(sc>=3){free+=8;$("status").textContent="SCATTER! ได้รับ 8 FREE SPINS";}
 balance+=total;lastWin=total;ui();
 if(!total&&free===0)$("status").textContent="ยังไม่ชนะ ลองใหม่ได้";
 busy=false;$("spin").disabled=false;
 if(auto){if(balance>=bet||free>0){await wait(450);play()}else{auto=false;$("auto").textContent="AUTO";}}
}
$("spin").onclick=()=>{auto=false;$("auto").textContent="AUTO";play()};
$("auto").onclick=()=>{auto=!auto;$("auto").textContent=auto?"STOP":"AUTO";if(auto&&!busy)play()};
$("betDown").onclick=()=>{if(!busy){bet=Math.max(10,bet-10);ui()}};
$("betUp").onclick=()=>{if(!busy){bet=Math.min(500,bet+10);ui()}};
$("reset").onclick=()=>{if(!busy){balance=10000;bet=20;free=0;mult=1;lastWin=0;ui();$("status").textContent="รีเซ็ตเครดิตแล้ว"}};
$("help").onclick=()=>$("modal").classList.remove("hidden");$("close").onclick=()=>$("modal").classList.add("hidden");
$("modal").onclick=e=>{if(e.target===$("modal"))$("modal").classList.add("hidden")};
$("sound").onclick=()=>{sound=!sound;$("sound").textContent=sound?"🔊":"🔇"};
ui();