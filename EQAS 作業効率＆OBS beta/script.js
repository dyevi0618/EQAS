const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DEFAULT_PLACEMENT=[12,9,7,5,4,3,2,2,2,1,1,1,1,1,1,1,1,1,1,1];
const STORAGE_KEY="eqasTournamentToolV3";
const MAX_KILLS=50;

const state={
  version:3,title:"EQ Apex Scrim",format:"normal",matchCount:6,target:50,killPoint:1,
  placement:[...DEFAULT_PLACEMENT],teams:[],matches:[],currentMatch:0,
  bgData:null,logoData:null,finished:false,champion:null,finalView:false,
  broadcastTheme:{primary:"#0a0b0d",accent:"#c9a447",text:"#ffffff"}
};
let toastTimer=null;

function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function fmt(n){return Number.isInteger(Number(n))?String(Number(n)):Number(n).toFixed(1)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function safeName(s){return String(s||"EQAS").replace(/[\\/:*?"<>|]/g,"_")||"EQAS"}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),1800)}
function saveLocal(){normalizeMatchResults();try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(e){toast("自動保存できませんでした")}
  try{if(broadcastWindow&&!broadcastWindow.closed)sendBroadcast(broadcastView,false,broadcastMatchIndex)}catch(e){}
}
function loadLocal(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY));if(!x)return false;Object.assign(state,x);state.version=3;normalizeMatchResults();state.placement=Array.from({length:20},(_,i)=>num(state.placement?.[i]));return true}catch(e){return false}}
function setStep(n){$$(".step").forEach((x,i)=>{x.classList.toggle("active",i===n-1);x.classList.toggle("done",i<n)})}
function show(id){$$(".screen").forEach(x=>x.classList.remove("active"));const el=$("#"+id);if(el)el.classList.add("active");window.scrollTo({top:0,behavior:"smooth"})}
function placementPoint(pos){return num(state.placement[pos-1])}
function resultPoints(r){
  if(!r)return 0;
  const kills=Math.max(0,num(r.kills));
  const place=Math.max(0,Math.floor(num(r.place)));
  return place?placementPoint(place)+kills*num(state.killPoint):0;
}
function normalizeMatchResults(){
  // Rebuild every stored MATCH total from the authoritative inputs.
  // Ranking is always: total PT desc -> kill PT desc -> placement PT desc -> in-game placement asc -> team index.
  state.matches=(state.matches||[]).map((m,mi)=>{
    if(!m)return m;
    const results=(m.results||[]).map((r,i)=>{
      const kills=Math.max(0,num(r?.kills));
      const place=Math.max(0,Math.floor(num(r?.place)));
      const killPT=kills*num(state.killPoint);
      const placementPT=place?placementPoint(place):0;
      return {...r,team:state.teams[i]||r?.team||`TEAM ${i+1}`,place,kills,killPT,placementPT,points:killPT+placementPT};
    });
    return {...m,number:m.number||mi+1,results};
  });
}
function teamTotals(upto=state.matches.length){
  return state.teams.map((_,i)=>state.matches.slice(0,upto).reduce((sum,m)=>sum+resultPoints(m?.results?.[i]),0));
}
function totalKills(upto=state.matches.length){return state.matches.slice(0,upto).reduce((sum,m)=>sum+(m?.results||[]).reduce((a,r)=>a+num(r?.kills),0),0)}
function cumulativeRanks(upto=state.matches.length){
  const totals=teamTotals(upto);
  return state.teams.map((team,index)=>({team,index,total:totals[index]})).sort((a,b)=>b.total-a.total||a.index-b.index)
}
function currentMatchData(){return state.matches[state.currentMatch]}
function currentResults(){return currentMatchData()?.results||[]}

function renderPlacement(){
  $("#placementInputs").innerHTML=state.placement.map((v,i)=>`<label>${i+1}位<input class="place-input" data-i="${i}" type="number" min="0" value="${v}"></label>`).join("");
}
function syncSetup(){
  $("#titleInput").value=state.title||"EQ Apex Scrim";
  $("#matchCountInput").value=state.matchCount||6;
  $("#targetPointsInput").value=state.target||50;
  $("#killPointInput").value=state.killPoint??1;
  $$(".format-card").forEach(b=>b.classList.toggle("selected",b.dataset.format===state.format));
  $("#matchCountWrap").style.display=state.format==="normal"?"block":"none";
  $(".target-wrap").classList.toggle("show",state.format==="matchpoint");
  renderPlacement();
  $("#bgPreview").innerHTML=state.bgData?`<img src="${state.bgData}" alt="">`:"BACKGROUND";
  $("#logoPreview").innerHTML=state.logoData?`<img src="${state.logoData}" alt="">`:"<span>LOGO</span>";
  state.broadcastTheme=Object.assign({primary:"#08090b",accent:"#d94b87",text:"#ffffff"},state.broadcastTheme||{});
  state.broadcastTheme.primary="#08090b";state.broadcastTheme.text="#ffffff";
  const ac=$("#broadcastAccentColor");
  if(ac)ac.value=state.broadcastTheme.accent;
}
function applyBroadcastTheme(){
  const t=Object.assign({primary:"#08090b",accent:"#d94b87",text:"#ffffff"},state.broadcastTheme||{});t.primary="#08090b";t.text="#ffffff";
  document.documentElement.style.setProperty("--broadcast-primary",t.primary);
  document.documentElement.style.setProperty("--broadcast-accent",t.accent);
  document.documentElement.style.setProperty("--broadcast-text",t.text);
  const screen=$("#broadcastScreen");if(screen){screen.style.setProperty("--broadcast-primary",t.primary);screen.style.setProperty("--broadcast-accent",t.accent);screen.style.setProperty("--broadcast-text",t.text);}
}
function setBroadcastThemePreset(name){
  const presets={
    blackpink:{primary:"#08090b",accent:"#d94b87",text:"#ffffff"},
    blackgold:{primary:"#0a0b0d",accent:"#c9a447",text:"#ffffff"},
    blackred:{primary:"#090a0d",accent:"#d83a45",text:"#ffffff"},
    blackblue:{primary:"#080b10",accent:"#4d8dff",text:"#ffffff"},
    blackpurple:{primary:"#0c0910",accent:"#8f6ab8",text:"#ffffff"}
  };
  if(presets[name])state.broadcastTheme={...presets[name]};
  syncSetup();applyBroadcastTheme();saveLocal();
}

function buildTeams(){
  $("#teamInputs").innerHTML=Array.from({length:20},(_,i)=>`<div class="team-row"><div class="team-no">${String(i+1).padStart(2,"0")}</div><input type="text" id="team${i}" placeholder="チーム ${i+1}" maxlength="30"></div>`).join("");
  state.teams.forEach((t,i)=>{if($("#team"+i))$("#team"+i).value=t});
  updateTeamCount();
}
function updateTeamCount(){const n=$$("#teamInputs input").filter(x=>x.value.trim()).length;$("#teamCountLabel").textContent=`${n} / 20 チーム`}
function collectTeams(){return $$("#teamInputs input").map(x=>x.value.trim()).filter(Boolean)}
function blankResults(){
  return Array.from({length:state.teams.length},(_,i)=>({team:i,place:"",kills:"",points:0}));
}
function draftForCurrent(){
  const r=state.matches[state.currentMatch]?.results;
  if(r)return r;
  return blankResults();
}
function optionList(max,selected,placeholder){
  let html=`<option value="">${placeholder}</option>`;
  for(let i=1;i<=max;i++)html+=`<option value="${i}" ${String(selected)===String(i)?"selected":""}>${i}</option>`;
  return html;
}
function killOptions(selected){
  let html=`<option value="">キル</option>`;
  for(let i=0;i<=MAX_KILLS;i++)html+=`<option value="${i}" ${String(selected)===String(i)?"selected":""}>${i} キル</option>`;
  return html;
}
function renderMatchInput(){
  const totals=teamTotals(),draft=draftForCurrent(),existing=Boolean(state.matches[state.currentMatch]);
  $("#matchTitle").textContent=`MATCH ${state.currentMatch+1}`;
  $("#matchProgress").textContent=state.format==="normal"?`${state.currentMatch+1} / ${state.matchCount}`:`MATCH ${state.currentMatch+1} ・ ポーランド形式`;
  $("#formatLabel").textContent=state.format==="normal"?"通常形式":"ポーランド形式";
  const eligible=totals.filter(v=>v>=state.target).length;
  $("#eligibleCount").textContent=`到達 ${eligible}`;
  $("#matchNotice").textContent=existing?"保存済み・編集可能":"入力待ち";
  const notice=$("#matchPointNotice");
  if(state.format==="matchpoint"){
    notice.classList.remove("hidden");
    notice.innerHTML=`<strong>到達ライン ${state.target}PT</strong>　累計が${state.target}PT以上のチームをゴールドで強調します。`;
  }else notice.classList.add("hidden");

  $("#matchInputsGrid").innerHTML=state.teams.map((name,i)=>{
    const r=draft[i]||{team:i,place:"",kills:""};
    return `<div class="match-input-row" data-row="${i}">
      <div class="row-no">${String(i+1).padStart(2,"0")}</div>
      <div class="select-block team-select-block"><span>チーム</span>
        <select class="team-select" data-i="${i}">${state.teams.map((t,j)=>`<option value="${j}" ${String(r.team??i)===String(j)?"selected":""}>${esc(t)}</option>`).join("")}</select>
      </div>
      <div class="select-block"><span>順位</span><select class="place-select" data-i="${i}">${optionList(state.teams.length,r.place,"順位")}</select></div>
      <div class="select-block kill-select-block"><span>キル</span><select class="kill-select" data-i="${i}">${killOptions(r.kills)}</select></div>
      <div class="calc-box"><small>このMATCH</small><strong id="livePt${i}">—</strong><span>PT</span></div>
      <div class="calc-box cumulative"><small>累計</small><strong id="liveTotal${i}">${fmt(totals[i])}</strong><span>PT</span></div>
    </div>`;
  }).join("");
  $$(".team-select,.place-select,.kill-select").forEach(x=>x.addEventListener("change",updateLivePoints));
  updateLivePoints();
}
function updateLivePoints(){
  const rows=$$(".match-input-row");
  const usedTeams=new Set();
  rows.forEach((row,i)=>{
    const team=Number(row.querySelector(".team-select").value);
    const p=Number(row.querySelector(".place-select").value);
    const k=Number(row.querySelector(".kill-select").value);
    const pts=p?placementPoint(p)+(Number.isFinite(k)?k:0)*state.killPoint:0;
    const totals=teamTotals();
    $("#livePt"+i).textContent=p?fmt(pts):"—";
    $("#liveTotal"+i).textContent=fmt((totals[team]||0)+pts);
    row.classList.toggle("duplicate-team",usedTeams.has(team));
    usedTeams.add(team);
  });
}
function readResults(){
  const rows=$$(".match-input-row");
  if(rows.length!==state.teams.length)return null;
  const results=Array(state.teams.length);
  const usedTeams=new Set(),usedPlaces=new Set();
  for(const row of rows){
    const slot=Number(row.dataset.row);
    const team=Number(row.querySelector(".team-select").value);
    const place=Number(row.querySelector(".place-select").value);
    const kills=Number(row.querySelector(".kill-select").value);
    if(!Number.isInteger(team)||team<0||team>=state.teams.length||!place||!Number.isInteger(place)||place<1||place>state.teams.length||!Number.isInteger(kills)||kills<0||kills>MAX_KILLS){toast("チーム・順位・キルをすべて選択してください");return null}
    if(usedTeams.has(team)){toast("同じチームが重複しています");return null}
    if(usedPlaces.has(place)){toast("同じ順位が重複しています");return null}
    usedTeams.add(team);usedPlaces.add(place);
    results[team]={team,place,kills,placementPT:placementPoint(place),killPT:kills*state.killPoint,points:placementPoint(place)+kills*state.killPoint};
  }
  if(results.some(x=>!x)){toast("全チームの入力を確認してください");return null}
  return results;
}
function championFrom(results){
  if(state.format!=="matchpoint")return null;
  const before=teamTotals(Math.max(0,state.matches.length-1));
  for(let i=0;i<state.teams.length;i++)if(before[i]>=state.target&&results[i].place===1)return i;
  return null;
}
function submitMatch(){
  const results=readResults();
  if(!results)return;
  state.matches[state.currentMatch]={number:state.currentMatch+1,results};
  state.champion=championFrom(results);
  state.finished=state.champion!==null||(state.format==="normal"&&state.currentMatch+1>=state.matchCount);
  state.finalView=false;
  saveLocal();renderResult();
}
function matchSorted(matchIndex){
  const m=state.matches[matchIndex], results=m?.results||[];
  return state.teams.map((team,index)=>{
    const r=results[index]||{place:0,kills:0,points:0};
    const kills=Math.max(0,num(r.kills));
    const place=Math.max(0,Math.floor(num(r.place)));
    const killPT=kills*num(state.killPoint);
    const placementPT=place?placementPoint(place):0;
    return {team,index,r:{...r,place,kills,killPT,placementPT,points:placementPT+killPT},total:placementPT+killPT};
  }).sort((a,b)=>{
    if(b.total!==a.total)return b.total-a.total;
    if(b.r.killPT!==a.r.killPT)return b.r.killPT-a.r.killPT;
    if(b.r.placementPT!==a.r.placementPT)return b.r.placementPT-a.r.placementPT;
    if(a.r.place!==b.r.place)return a.r.place-b.r.place;
    return a.index-b.index;
  });
}
function currentSortedFinal(){
  return cumulativeRanks(state.matches.length);
}
function currentTotalForTeam(i){return teamTotals(state.matches.length)[i]||0}
function buildMatchResultHTML(){
  const sorted=matchSorted(state.currentMatch);
  const totalNow=teamTotals(state.matches.length);
  const columns=[sorted.slice(0,10),sorted.slice(10,20)];
  return `<div class="result-section-title"><div><span>試合結果</span><h2>MATCH ${state.currentMatch+1}</h2></div><p>このMATCHの獲得ポイント</p></div>
  <div class="result-grid">${columns.map((col,ci)=>`<div class="result-col"><div class="result-head"><span>順位</span><span>チーム</span><span>キルPT</span><span>順位PT</span><span>トータル</span></div>${col.map((x,i)=>{
    const rank=ci*10+i+1,total=x.r.points;
    return `<div class="result-row ${rank<=3?"top":""}">
      <div class="rank-box">${rank}</div><div class="team-result-name">${esc(x.team)}</div>
      <div class="result-num">${fmt(x.r.kills*state.killPoint)}</div>
      <div class="result-num">${fmt(placementPoint(x.r.place))}</div><div class="result-num result-total">${fmt(total)}</div>
    </div>`}).join("")}${Array.from({length:10-col.length},(_,j)=>`<div class="result-row empty-row"><div class="rank-box">${ci*10+col.length+j+1}</div><div>—</div><div></div><div></div><div></div></div>`).join("")}</div>`).join("")}</div>`;
}
function buildCumulativeHTML(){
  const sorted=currentTotalForTeam?cumulativeRanks(state.matches.length):[];
  if(!sorted.length)return "";
  const cols=[sorted.slice(0,10),sorted.slice(10,20)];
  const matchNames=Array.from({length:state.matches.length},(_,i)=>`M${i+1}`).join(" + ");
  return `<div class="cumulative-card"><div class="result-section-title"><div><span>現在の総合順位</span><h2>${esc(matchNames)}</h2></div><div class="cumulative-tools"><p>ここまでの全MATCH合計</p><button class="btn small secondary" id="downloadCumulativeBtn">この総合順位をPNG保存</button></div></div>
    <div class="result-grid cumulative-grid">${cols.map((col,ci)=>`<div class="result-col"><div class="result-head"><span>順位</span><span>チーム</span><span>合計PT</span></div>${col.map((x,i)=>{
      const rank=ci*10+i+1,lit=x.total>=state.target;
      return `<div class="result-row cumulative-row ${rank<=3?"top":""} ${lit?"lit":""}">
        <div class="rank-box">${rank}</div><div class="team-result-name">${esc(x.team)}</div><div class="result-num result-total">${fmt(x.total)}</div>
      </div>`}).join("")}${Array.from({length:10-col.length},(_,j)=>`<div class="result-row empty-row cumulative-row"><div class="rank-box">${ci*10+col.length+j+1}</div><div>—</div><div></div></div>`).join("")}</div>`).join("")}</div></div>`;
}
function renderResult(){
  normalizeMatchResults();
  show("resultScreen");setStep(4);
  const m=state.matches[state.currentMatch];if(!m){toast("表示するMATCHがありません");return}
  const final=state.finalView;
  if(final){
    $("#resultEyebrow").textContent="FINAL RESULT";$("#resultTitle").textContent="FINAL RESULT";
    $("#resultSub").textContent=`全${state.matches.length}MATCH ・ ${totalKills()}キル`;
    $("#resultTableArea").innerHTML=buildFinalHTML();
    $("#cumulativeArea").innerHTML="";
  }else{
    $("#resultEyebrow").textContent="MATCH RESULT";$("#resultTitle").textContent=`MATCH ${m.number} RESULT`;
    $("#resultSub").textContent=`MATCH ${m.number} ・ ${m.results.reduce((a,b)=>a+b.kills,0)}キル`;
    $("#resultTableArea").innerHTML=buildMatchResultHTML();
    $("#cumulativeArea").innerHTML=buildCumulativeHTML();
    const cumulativeBtn=$("#downloadCumulativeBtn");
    if(cumulativeBtn)cumulativeBtn.onclick=downloadCumulativePNG;
  }
  if(state.champion!==null){
    $("#finalBanner").classList.remove("hidden");
    $("#finalBanner").innerHTML=`<span>CHAMPION</span><strong>${esc(state.teams[state.champion])}</strong><small>${state.target}PT到達後に優勝条件を達成</small>`;
  }else $("#finalBanner").classList.add("hidden");
  const canFinal=state.matches.length>0&&(state.finished||state.matches.length>=state.matchCount);
  $("#finalResultBtn").classList.add("hidden");
  $("#nextMatchBtn").textContent=state.finished?"最終結果 →":"次のMATCH →";
  $("#nextMatchBtn").disabled=false;
  $("#matchHistory").innerHTML=state.matches.map((mm,mi)=>`<button class="history-card ${mi===state.currentMatch&&!final?"active":""}" data-match="${mi}"><strong>MATCH ${mi+1}</strong><span>${mm.results.reduce((a,b)=>a+b.kills,0)} KILLS</span></button>`).join("");
  $$(".history-card").forEach(b=>b.onclick=()=>{state.currentMatch=Number(b.dataset.match);state.finalView=false;renderResult()});
  drawResultCanvas();
}
function buildFinalHTML(){
  const sorted=cumulativeRanks(state.matches.length),cols=[sorted.slice(0,10),sorted.slice(10,20)];
  return `<div class="result-section-title"><div><span>大会最終結果</span><h2>FINAL RESULT</h2></div><p>全MATCH合計</p></div><div class="result-grid">${cols.map((col,ci)=>`<div class="result-col"><div class="result-head"><span>順位</span><span>チーム</span><span>合計PT</span></div>${col.map((x,i)=>{
    const rank=ci*10+i+1,lit=x.total>=state.target,champ=state.champion===x.index;
    return `<div class="result-row cumulative-row ${rank<=3?"top":""} ${lit?"lit":""} ${champ?"champion":""}">
      <div class="rank-box">${rank}</div><div class="team-result-name">${esc(x.team)}</div><div class="result-num result-total">${fmt(x.total)}</div>
    </div>`}).join("")}${Array.from({length:10-col.length},(_,j)=>`<div class="result-row empty-row cumulative-row"><div class="rank-box">${ci*10+col.length+j+1}</div><div>—</div><div></div><div></div></div>`).join("")}</div>`).join("")}</div>`;
}

function drawResultCanvas(mode=null){
  const c=$("#resultCanvas"),ctx=c.getContext("2d",{alpha:false});
  // Keep a 4K backing canvas while the artwork itself uses a stable 1920×1080 layout.
  // This preserves the carefully tuned composition and doubles the export resolution.
  const W=1920,H=1080;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,c.width,c.height);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.scale(c.width/W,c.height/H);
  const viewMode=mode||state.canvasMode||(state.finalView?"final":"match");
  drawCanvasBackground(ctx,W,H,()=>drawCanvasContent(ctx,W,H,viewMode));
}
function drawCanvasBackground(ctx,W,H,done){
  if(state.bgData){const img=new Image();img.onload=()=>{cover(ctx,img,W,H);ctx.fillStyle="#ffffffd9";ctx.fillRect(0,0,W,H);done()};img.onerror=()=>{baseCanvas(ctx,W,H);done()};img.src=state.bgData}
  else{baseCanvas(ctx,W,H);done()}
}
function baseCanvas(ctx,W,H){
  ctx.fillStyle="#f3f4f4";ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="#dfe1e2";ctx.lineWidth=1;
  for(let x=0;x<W;x+=96){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
  for(let y=0;y<H;y+=96){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
  const g=ctx.createLinearGradient(0,0,W,0);g.addColorStop(0,"rgba(210,20,35,.05)");g.addColorStop(.5,"rgba(255,255,255,0)");g.addColorStop(1,"rgba(20,20,20,.04)");ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
}
function cover(ctx,img,W,H){const scale=Math.max(W/img.width,H/img.height),w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(W-w)/2,(H-h)/2,w,h)}
function fitFont(ctx,text,max,size,family="Teko"){let s=size;while(s>16){ctx.font=`900 ${s}px "${family}", "Arial Narrow", sans-serif`;if(ctx.measureText(text).width<=max)break;s--}return s}
function drawCanvasContent(ctx,W,H,viewMode){
  const final=viewMode==="final", cumulative=viewMode==="cumulative", title=state.title||"TOURNAMENT", m=state.matches[state.currentMatch];
  // Premium broadcast-style header: restrained, geometric and readable at 4K.
  ctx.save();
  ctx.fillStyle="rgba(255,255,255,.88)";ctx.fillRect(0,0,W,145);
  ctx.strokeStyle="rgba(18,20,22,.10)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(55,143);ctx.lineTo(1865,143);ctx.stroke();
  ctx.fillStyle="#121416";ctx.textAlign="center";fitFont(ctx,title,1050,64,"Barlow Condensed");ctx.fillText(title,W/2,74);
  ctx.fillStyle="#34373b";ctx.font='900 23px "Teko", "Arial Narrow", sans-serif';
  ctx.fillText(final?"大会最終結果":cumulative?`MATCH 1 ～ MATCH ${state.matches.length}  累計結果`:`MATCH ${m.number} RESULT`,W/2,108);
  const accent=ctx.createLinearGradient(W/2-150,0,W/2+150,0);accent.addColorStop(0,"#17191b");accent.addColorStop(.5,"#c99b22");accent.addColorStop(1,"#17191b");
  ctx.fillStyle=accent;ctx.fillRect(W/2-150,125,300,3);
  ctx.fillStyle="#73777c";ctx.textAlign="left";ctx.font='800 11px "Inter", sans-serif';ctx.fillText("EQ / OFFICIAL TOURNAMENT RESULT",55,31);
  ctx.textAlign="right";ctx.fillText(final?"FINAL":cumulative?"CUMULATIVE":`MATCH ${m.number}`,1865,31);
  ctx.restore();
  if(state.logoData){const logo=new Image();logo.onload=()=>{drawCanvasLogo(ctx,logo,W,H);drawCanvasRows(ctx,W,H,viewMode)};logo.src=state.logoData}else drawCanvasRows(ctx,W,H,viewMode)
}
function drawCanvasLogo(ctx,img,W,H){const maxW=190,maxH=82,s=Math.min(maxW/img.width,maxH/img.height);ctx.drawImage(img,W-235,24,img.width*s,img.height*s)}
function polygon(ctx,points){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath()}
function drawDiagonalBox(ctx,x,y,w,h,fill,stroke=null){polygon(ctx,[[x+18,y],[x+w,y],[x+w-18,y+h],[x,y+h]]);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
function drawCanvasRows(ctx,W,H,viewMode){
  const final=viewMode==="final", cumulative=viewMode==="cumulative";
  const left=55,right=1865,top=160,rowH=73,colGap=32,colW=(right-left-colGap)/2;
  const sorted=final||cumulative?cumulativeRanks(state.matches.length):matchSorted(state.currentMatch);
  for(let c=0;c<2;c++){
    const x0=left+c*(colW+colGap);
    drawDiagonalBox(ctx,x0,top,colW,48,"#17191b");
    ctx.fillStyle="#fff";ctx.font='900 17px "Noto Sans JP", sans-serif';ctx.textAlign="left";
    ctx.fillText("順位",x0+24,top+31);ctx.fillText("チーム",x0+88,top+31);
    ctx.textAlign="right";
    if(final||cumulative){ctx.fillText("合計PT",x0+colW-26,top+31)}
    else{ctx.fillText("キルPT",x0+colW-175,top+31);ctx.fillText("順位PT",x0+colW-92,top+31);ctx.fillText("トータル",x0+colW-18,top+31)}
    for(let i=0;i<10;i++){
      const idx=c*10+i,x=x0,y=top+48+i*rowH,row=sorted[idx];
      const teamIndex=row?.index, totalNow=teamIndex==null?0:currentTotalForTeam(teamIndex),lit=(cumulative||final)&&teamIndex!=null&&totalNow>=state.target,champ=state.champion===teamIndex;
      const rowFill=champ?"#fff4c7":(i%2===0?"#fbfbfa":"#f1f2f2");
      drawDiagonalBox(ctx,x,y,colW,rowH,rowFill,"#d0d2d3");
      if(lit){
        const lg=ctx.createLinearGradient(x,y,x+colW,y+rowH);
        lg.addColorStop(0,"#fffdf0");lg.addColorStop(.32,"#fff0ad");lg.addColorStop(.62,"#dfb944");lg.addColorStop(1,"#fff7cf");
        drawDiagonalBox(ctx,x+1,y+1,colW-2,rowH-2,lg);
        ctx.save();
        ctx.shadowColor="rgba(214,166,44,.34)";ctx.shadowBlur=24;ctx.strokeStyle="rgba(199,151,29,.95)";ctx.lineWidth=2;
        polygon(ctx,[[x+18,y+1],[x+colW-1,y+1],[x+colW-19,y+rowH-1],[x+1,y+rowH-1]]);ctx.stroke();
        ctx.restore();
        // A subtle diagonal highlight, clipped to the same slanted row.
        ctx.save();polygon(ctx,[[x+18,y],[x+colW,y],[x+colW-18,y+rowH],[x,y+rowH]]);ctx.clip();
        const sweep=ctx.createLinearGradient(x,y,x+colW,y);sweep.addColorStop(0.40,"rgba(255,255,255,0)");sweep.addColorStop(0.50,"rgba(255,255,255,.48)");sweep.addColorStop(0.60,"rgba(255,255,255,0)");
        ctx.fillStyle=sweep;ctx.fillRect(x,y,colW,rowH);ctx.restore();
      }
      if(champ){ctx.fillStyle="#fff";ctx.globalAlpha=.13;ctx.fillRect(x,y,colW,rowH);ctx.globalAlpha=1}
      // Balanced column layout: keep the team area wide and center the numeric values.
      const rankCX=x+42;
      const teamX=x+78;
      const teamMax=final||cumulative?colW-215:colW-320;
      ctx.fillStyle="#17191b";ctx.textAlign="center";ctx.font='900 30px "Teko", "Arial Narrow", sans-serif';ctx.fillText(String(idx+1),rankCX,y+47);
      ctx.textAlign="left";ctx.font=`800 ${row?Math.min(23,Math.max(14,Math.floor(1950/Math.max(row.team.length,11)))):15}px "Noto Sans JP", sans-serif`;
      let teamText=row?row.team:"—";
      while(row && ctx.measureText(teamText).width>teamMax && teamText.length>3) teamText=teamText.slice(0,-2)+"…";
      ctx.fillText(teamText,teamX,y+45);
      ctx.textAlign="center";ctx.font='900 24px "Teko", "Arial Narrow", sans-serif';
      if(final||cumulative){
        const totalCX=x+colW-52;
        ctx.fillText(row?fmt(row.total):"",totalCX,y+45);
      } else {
        const r=row?.r||{};
        const killCX=x+colW-214, placeCX=x+colW-128, totalCX=x+colW-48;
        ctx.fillText(row?fmt(r.kills*state.killPoint):"",killCX,y+45);
        ctx.fillText(row?fmt(placementPoint(r.place)):"",placeCX,y+45);
        ctx.font='900 28px "Teko", "Arial Narrow", sans-serif';
        ctx.fillText(row?fmt(r.points):"",totalCX,y+45);
      }

    }
  }
  ctx.fillStyle="#151619";ctx.fillRect(left,1015,right-left,1);
  ctx.save();ctx.fillStyle="#c99b22";ctx.beginPath();ctx.moveTo(left,1012);ctx.lineTo(left+150,1012);ctx.lineTo(left+132,1017);ctx.lineTo(left,1017);ctx.closePath();ctx.fill();ctx.restore();
  ctx.fillStyle="#3b3e42";ctx.textAlign="left";ctx.font='800 14px "Noto Sans JP", sans-serif';
  ctx.fillText(final?`最終結果 / 全${state.matches.length}MATCH`:cumulative?`現在の総合順位 / MATCH 1～${state.matches.length}`:`MATCH ${state.currentMatch+1} RESULT`,left,1045);
  ctx.textAlign="right";ctx.fillText(`${state.teams.length} TEAM`,right,1045)
}
function downloadPNG(){state.canvasMode=state.finalView?"final":"match";drawResultCanvas(state.canvasMode);setTimeout(()=>{const a=document.createElement("a");a.download=`${safeName(state.title)}_${state.finalView?"FINAL":`MATCH${state.currentMatch+1}`}_4K.png`;a.href=$("#resultCanvas").toDataURL("image/png");a.click()},450)}
function downloadCumulativePNG(){if(!state.matches.length)return;state.canvasMode="cumulative";drawResultCanvas("cumulative");setTimeout(()=>{const a=document.createElement("a");a.download=`${safeName(state.title)}_現在の総合順位_MATCH1-${state.matches.length}_4K.png`;a.href=$("#resultCanvas").toDataURL("image/png");a.click();state.canvasMode=null;drawResultCanvas()},450)}
function openPreview(){state.canvasMode=state.finalView?"final":"match";drawResultCanvas(state.canvasMode);$("#previewModal").classList.remove("hidden")}
function resetAll(){if(!confirm("大会データをすべてリセットしますか？"))return;localStorage.removeItem(STORAGE_KEY);location.reload()}
function randomFill(){
  const n=state.teams.length,arr=Array.from({length:n},(_,i)=>i+1).sort(()=>Math.random()-.5);
  const rows=$$(".match-input-row");
  rows.forEach((row,i)=>{row.querySelector(".team-select").value=i;row.querySelector(".place-select").value=arr[i];row.querySelector(".kill-select").value=Math.floor(Math.random()*11)});
  updateLivePoints();
}
function fileToData(file,cb){if(!file)return;const r=new FileReader();r.onload=()=>cb(r.result);r.readAsDataURL(file)}
function exportProject(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${safeName(state.title)}_project.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function importProject(file){const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);Object.assign(state,x);state.version=3;normalizeMatchResults();state.placement=Array.from({length:20},(_,i)=>num(state.placement?.[i]));syncSetup();buildTeams();show("setupScreen");setStep(1);saveLocal();toast("プロジェクトを読み込みました")}catch(e){alert("JSONの読み込みに失敗しました")}};r.readAsText(file)}
function nextMatch(){
  if(state.finished){state.finalView=true;renderResult();return}
  const next=state.currentMatch+1;
  if(next>=state.matchCount&&state.format==="normal"){state.finished=true;state.finalView=true;saveLocal();renderResult();return}
  state.currentMatch=next;state.finalView=false;show("matchScreen");setStep(3);renderMatchInput();saveLocal()
}
function goFinal(){if(!state.matches.length)return;state.finalView=true;renderResult()}
function init(){
  const restored=loadLocal();syncSetup();buildTeams();
  if(restored&&state.teams.length>=2&&state.matches.length){if(state.finished||state.finalView){state.finalView=true;renderResult()}else{show("matchScreen");setStep(3);renderMatchInput()}}else setStep(1);

  $$(".format-card").forEach(b=>b.onclick=()=>{state.format=b.dataset.format;syncSetup();saveLocal()});
  $("#titleInput").oninput=e=>{state.title=e.target.value;saveLocal()};
  $("#matchCountInput").oninput=e=>{state.matchCount=Math.max(1,Math.min(30,num(e.target.value)));saveLocal()};
  $("#targetPointsInput").oninput=e=>{state.target=Math.max(1,num(e.target.value));saveLocal()};
  $("#killPointInput").oninput=e=>{state.killPoint=Math.max(0,num(e.target.value));saveLocal()};
  $("#placementInputs").addEventListener("input",e=>{if(e.target.classList.contains("place-input")){state.placement[num(e.target.dataset.i)]=num(e.target.value);saveLocal()}});
  $("#defaultPointsBtn").onclick=()=>{state.placement=[...DEFAULT_PLACEMENT];state.killPoint=1;syncSetup();saveLocal();toast("標準ポイントに戻しました")};
  $("#bgInput").onchange=e=>fileToData(e.target.files[0],data=>{state.bgData=data;syncSetup();saveLocal();toast("背景を設定しました")});
  $("#clearBgBtn").onclick=()=>{state.bgData=null;syncSetup();saveLocal()};
  $("#logoInput").onchange=e=>fileToData(e.target.files[0],data=>{state.logoData=data;syncSetup();saveLocal();toast("大会ロゴを設定しました")});
  $("#clearLogoBtn").onclick=()=>{state.logoData=null;syncSetup();saveLocal()};
  const accentPicker=$("#broadcastAccentColor");
  if(accentPicker)accentPicker.oninput=()=>{state.broadcastTheme=Object.assign({primary:"#08090b",accent:"#d94b87",text:"#ffffff"},state.broadcastTheme||{});state.broadcastTheme.accent=accentPicker.value;state.broadcastTheme.primary="#08090b";state.broadcastTheme.text="#ffffff";applyBroadcastTheme();saveLocal()};
  $$(".theme-preset").forEach(b=>b.onclick=()=>setBroadcastThemePreset(b.dataset.theme));
  $("#toTeamsBtn").onclick=()=>{show("teamsScreen");setStep(2);buildTeams()};
  $("#backToSetupBtn").onclick=()=>{show("setupScreen");setStep(1)};
  $("#teamInputs").addEventListener("input",updateTeamCount);
  $("#fillSampleBtn").onclick=()=>{$$("#teamInputs input").forEach((x,i)=>x.value=`TEAM ${String(i+1).padStart(2,"0")}`);updateTeamCount()};
  $("#clearTeamsBtn").onclick=()=>{$$("#teamInputs input").forEach(x=>x.value="");updateTeamCount()};
  $("#startTournamentBtn").onclick=()=>{const teams=collectTeams();if(teams.length<2){toast("2チーム以上登録してください");return}state.teams=teams;state.matches=[];state.currentMatch=0;state.finished=false;state.champion=null;state.finalView=false;show("matchScreen");setStep(3);renderMatchInput();saveLocal()};
  $("#backToTeamsBtn").onclick=()=>{show("teamsScreen");setStep(2);buildTeams()};
  $("#submitMatchBtn").onclick=submitMatch;
  $("#fillRandomBtn").onclick=randomFill;
  $("#previewResultBtn").onclick=openPreview;
  $("#downloadResultBtn").onclick=downloadPNG;
  $("#modalDownloadBtn").onclick=downloadPNG;
  $("#closePreviewBtn").onclick=()=>$("#previewModal").classList.add("hidden");
  $("#backToMatchBtn").onclick=()=>{state.finalView=false;show("matchScreen");setStep(3);renderMatchInput()};
  $("#finalResultBtn").onclick=goFinal;
  $("#nextMatchBtn").onclick=nextMatch;
  $("#resetBtn").onclick=resetAll;
  $("#saveProjectBtn").onclick=exportProject;
  $("#loadProjectBtn").onclick=()=>$("#projectFileInput").click();
  $("#projectFileInput").onchange=e=>{if(e.target.files[0])importProject(e.target.files[0])};
  $("#previewModal").addEventListener("click",e=>{if(e.target.id==="previewModal")$("#previewModal").classList.add("hidden")});
}
/* ==========================================
   BROADCAST / OBS OUTPUT MODE
   v14: robust operator -> output bridge
   - BroadcastChannel + postMessage + localStorage fallback
   - live HTML Result (not PNG)
   - explicit button binding / command acknowledgements
   ========================================== */
let broadcastChannel=null;
let broadcastWindow=null;
let broadcastView="counting";
let broadcastMatchIndex=null;
let broadcastSequence=0;
let broadcastReady=false;

function isBroadcastOnly(){return new URLSearchParams(location.search).get("display")==="1"}
function broadcastSnapshot(){normalizeMatchResults();return JSON.parse(JSON.stringify(state))}
function ensureBroadcastChannel(){
  if(broadcastChannel || !("BroadcastChannel" in window))return;
  broadcastChannel=new BroadcastChannel("eqas_tournament_broadcast_v2");
  broadcastChannel.onmessage=e=>handleBroadcastMessage(e.data);
}
function sendBroadcastReady(){
  const msg={type:"eqas-broadcast-ready",ts:Date.now()};
  try{window.opener?.postMessage(msg,"*")}catch(e){}
  try{localStorage.setItem("eqasBroadcastReady",JSON.stringify(msg))}catch(e){}
}
function makeBroadcastMessage(view,transition=false,matchIndex=null){
  if(matchIndex!==null && matchIndex!==undefined)broadcastMatchIndex=Number(matchIndex);
  return {type:"eqas-broadcast",view,transition:!!transition,matchIndex:broadcastMatchIndex,state:broadcastSnapshot(),ts:Date.now(),nonce:Math.random().toString(36).slice(2)};
}
function sendBroadcast(view="counting",transition=false,matchIndex=null){
  ensureBroadcastChannel();
  const msg=makeBroadcastMessage(view,transition,matchIndex);
  broadcastView=msg.view;
  try{broadcastChannel?.postMessage(msg)}catch(e){}
  try{if(broadcastWindow&&!broadcastWindow.closed)broadcastWindow.postMessage(msg,"*")}catch(e){}
  try{localStorage.setItem("eqasBroadcastMessage",JSON.stringify(msg))}catch(e){}
  return msg;
}
function handleBroadcastMessage(msg){
  if(!msg)return;
  if(msg.type==="eqas-broadcast-ready"){
    broadcastReady=true;
    sendBroadcast(broadcastView,broadcastView!=="counting",broadcastMatchIndex);
    return;
  }
  if(msg.type!=="eqas-broadcast")return;
  if(msg.state)Object.assign(state,msg.state);
  if(msg.matchIndex!==null&&msg.matchIndex!==undefined)broadcastMatchIndex=Number(msg.matchIndex);
  broadcastView=msg.view||"counting";
  if(isBroadcastOnly())renderBroadcast(Boolean(msg.transition));
}
function openBroadcast(){
  ensureBroadcastChannel();
  applyBroadcastTheme();
  const url=location.href.split("?")[0]+"?display=1&t="+Date.now();
  broadcastWindow=window.open(url,"EQAS_BROADCAST","width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no,resizable=yes");
  if(!broadcastWindow){toast("ポップアップがブロックされています。ブラウザのポップアップを許可してください");return}
  $("#broadcastControl").classList.remove("hidden");
  updateBroadcastMatchButtons();
  // Send immediately, then repeatedly until the output acknowledges readiness.
  broadcastReady=false;
  const initial=makeBroadcastMessage("counting",false,null);
  const push=()=>{
    if(!broadcastWindow||broadcastWindow.closed||broadcastReady)return;
    try{broadcastChannel?.postMessage(initial)}catch(e){}
    try{broadcastWindow.postMessage(initial,"*")}catch(e){}
    try{localStorage.setItem("eqasBroadcastMessage",JSON.stringify(initial))}catch(e){}
  };
  push();setTimeout(push,350);setTimeout(push,900);setTimeout(push,1600);
  toast("配信用モードを開きました。操作ボタンを使用できます");
}
function setBroadcastView(view,transition=true,matchIndex=null){
  if(view==="matchStart"){
    const next=matchIndex!==null?Number(matchIndex):Math.min(state.currentMatch+1,Math.max(0,state.matches.length));
    broadcastView="matchStart";broadcastMatchIndex=next;sendBroadcast("matchStart",true,next);return;
  }
  broadcastView=view;
  if(matchIndex!==null)broadcastMatchIndex=Number(matchIndex);
  sendBroadcast(view,transition,broadcastMatchIndex);
}
function updateBroadcastLogo(){
  const img=$("#broadcastLogo");if(!img)return;
  if(state.logoData){img.src=state.logoData;img.style.display="block"}else{img.removeAttribute("src");img.style.display="none"}
}
function updateBroadcastMatchButtons(){
  const holder=$("#broadcastMatchButtons");if(!holder)return;
  const count=Math.max(1,Math.min(6,num(state.matchCount)||6));
  holder.innerHTML=Array.from({length:count},(_,i)=>`<button type="button" class="btn" data-broadcast-match="${i}" ${!state.matches[i]?"disabled":""}>MATCH ${i+1} RESULT</button>`).join("");
  holder.querySelectorAll("[data-broadcast-match]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const i=Number(btn.dataset.broadcastMatch);
      if(!state.matches[i]){toast(`MATCH ${i+1} はまだ確定していません`);return}
      setBroadcastView("match",true,i);
    });
  });
}
function broadcastSelectedMatchIndex(){
  if(broadcastMatchIndex!==null&&state.matches[broadcastMatchIndex])return broadcastMatchIndex;
  if(state.matches[state.currentMatch])return state.currentMatch;
  return Math.max(0,state.matches.length-1);
}
function liveResultHeader(title,sub){
  return `<div class="live-result-title"><div><span class="live-kicker">${esc(state.title||"TOURNAMENT RESULT")}</span><h2>${esc(title)}</h2><p>${esc(sub)}</p></div></div>`;
}
function buildBroadcastLiveResult(){
  const box=$("#broadcastLiveResult");if(!box)return;
  box.innerHTML="";box.className="broadcast-live-result";
  if(broadcastView==="counting"||broadcastView==="matchStart")return;
  if(broadcastView==="cumulative"||broadcastView==="final"){
    const sorted=cumulativeRanks(state.matches.length);
    box.className=`broadcast-live-result ${broadcastView}`;
    box.innerHTML=liveResultHeader(broadcastView==="final"?"FINAL RESULT":"現在の総合順位",broadcastView==="final"?"大会最終結果":`MATCH 1 ～ MATCH ${state.matches.length} / 累計結果`)+liveGrid(sorted,"cumulative",broadcastView==="final");
    return;
  }
  const mi=broadcastSelectedMatchIndex(),m=state.matches[mi];if(!m)return;
  const sorted=(m.results||[]).map((r,i)=>{
    const kills=Math.max(0,num(r?.kills));
    const place=Math.max(0,Math.floor(num(r?.place)));
    const killPT=kills*num(state.killPoint);
    const placementPT=place?placementPoint(place):0;
    return {team:state.teams[i]||`TEAM ${i+1}`,index:i,place:place||999,kills,killPT,placementPT,total:killPT+placementPT};
  }).sort((a,b)=>{
    if(b.total!==a.total)return b.total-a.total;
    if(b.killPT!==a.killPT)return b.killPT-a.killPT;
    if(b.placementPT!==a.placementPT)return b.placementPT-a.placementPT;
    if(a.place!==b.place)return a.place-b.place;
    return a.index-b.index;
  });
  box.className="broadcast-live-result match";
  box.innerHTML=liveResultHeader(`MATCH ${m.number} RESULT`,`MATCH ${m.number} / 獲得ポイント`)+liveGrid(sorted,"match",false);
}
function liveGrid(sorted,mode,isFinal=false){
  const cols=[sorted.slice(0,10),sorted.slice(10,20)];
  return `<div class="broadcast-live-grid">${cols.map((col,ci)=>`<div class="broadcast-live-col"><div class="broadcast-live-head ${mode==='match'?'match-head':'sum-head'}">${mode==='match'?'<span>順位</span><span>チーム</span><span>キルPT</span><span>順位PT</span><span>トータル</span>':'<span>順位</span><span>チーム</span><span>トータル</span>'}</div>${Array.from({length:10},(_,i)=>{const x=col[i],rank=ci*10+i+1;if(!x)return `<div class="broadcast-live-row empty"><div class="live-rank">${rank}</div><div>—</div>${mode==='match'?'<div></div><div></div><div></div>':'<div></div>'}</div>`;const lit=mode!=="match"&&x.total>=state.target,champ=isFinal&&state.champion===x.index;return `<div class="broadcast-live-row ${lit?'lit':''} ${champ?'champ':''}"><div class="live-rank">${rank}</div><div class="live-team">${esc(x.team)}</div>${mode==='match'?`<div class="live-num">${fmt(x.killPT)}</div><div class="live-num">${fmt(x.placementPT)}</div><div class="live-num total">${fmt(x.total)}</div>`:`<div class="live-num total">${fmt(x.total)}</div>`}</div>`}).join("")}</div>`).join("")}</div>`;
}
function renderBroadcast(transition=false){
  const screen=$("#broadcastScreen");if(!screen)return;
  applyBroadcastTheme();updateBroadcastLogo();
  const seq=++broadcastSequence,transitionEl=$("#broadcastTransition"),kicker=$("#broadcastKicker"),title=$("#broadcastTitle"),sub=$("#broadcastSub"),wrap=$("#broadcastResultWrap"),live=$("#broadcastLiveResult"),status=$("#broadcastStatus");
  screen.classList.remove("show-result","broadcast-burst","interstitial-play","result-play");
  [kicker,title,sub].forEach(el=>{if(el){el.style.opacity="1";el.style.visibility="visible";el.style.transform="none";}});
  void screen.offsetWidth;
  screen.classList.add("broadcast-burst");
  wrap.style.opacity="0";wrap.style.transform="scale(.965)";
  if(live){live.innerHTML="";live.className="broadcast-live-result"}
  [kicker,title,sub].forEach(el=>{if(el){el.style.animation="none";void el.offsetWidth}});
  if(broadcastView==="counting"){
    kicker.textContent=state.title||"TOURNAMENT";title.textContent="集計中です";sub.textContent="RESULT IS BEING PREPARED";if(status)status.textContent="CALCULATING";screen.classList.add("interstitial-play");
    [kicker,title,sub].forEach((el,i)=>el.style.animation=`broadcastTextIn 1.05s ${i*.18}s both`);
    if(transition){transitionEl.classList.remove("play");void transitionEl.offsetWidth;transitionEl.classList.add("play")};return;
  }
  if(broadcastView==="matchStart"){
    const n=Math.min(6,Math.max(1,(broadcastMatchIndex??state.currentMatch)+1));
    screen.classList.add("interstitial-play");
    kicker.textContent=state.title||"TOURNAMENT";title.textContent=`MATCH ${n} START`;sub.textContent=n===1?"TOURNAMENT START":`MATCH ${n-1} RESULT COMPLETE  /  MATCH ${n} START`;if(status)status.textContent="NEXT MATCH";
    [kicker,title,sub].forEach((el,i)=>el.style.animation=`broadcastTextIn 1.25s ${i*.22}s both`);
    if(transition){transitionEl.classList.remove("play");void transitionEl.offsetWidth;transitionEl.classList.add("play")};return;
  }
  const final=broadcastView==="final",cumulative=broadcastView==="cumulative",mi=broadcastSelectedMatchIndex();
  kicker.textContent=final?"FINAL RESULT":cumulative?"CURRENT STANDINGS":`MATCH ${mi+1} RESULT`;
  title.textContent=final?"FINAL RESULT":cumulative?"現在の総合順位":`MATCH ${mi+1} RESULT`;
  sub.textContent=final?"TOURNAMENT CHAMPION":cumulative?`MATCH 1 ～ MATCH ${state.matches.length} / CUMULATIVE`:"OFFICIAL MATCH RESULT";
  if(status)status.textContent=final?"FINAL":cumulative?"CUMULATIVE":"RESULT";
  [kicker,title,sub].forEach((el,i)=>el.style.animation=`none`);
  void screen.offsetWidth;screen.classList.add("result-play");
  if(transition){transitionEl.classList.remove("play");void transitionEl.offsetWidth;transitionEl.classList.add("play")};
  const revealDelay=transition?4700:850;
  setTimeout(()=>{if(seq!==broadcastSequence)return;buildBroadcastLiveResult();wrap.style.opacity="1";wrap.style.transform="scale(1)";screen.classList.add("show-result","result-burst");setTimeout(()=>screen.classList.remove("result-burst"),1900)},revealDelay);
}

function broadcastPlayResult(kind, matchIndex=null){
  // One-click operator flow: title animation -> result table.
  setBroadcastView(kind, true, matchIndex);
}
function broadcastCurrentMatch(){
  const i=state.matches[state.currentMatch] ? state.currentMatch : Math.max(0,state.matches.length-1);
  if(!state.matches[i]){toast("まだ確定したMATCHがありません");return}
  broadcastPlayResult("match",i);
}
function broadcastCurrentCumulative(){
  if(!state.matches.length){toast("まだ確定したMATCHがありません");return}
  // Always use the latest confirmed total at the moment the button is pressed.
  broadcastMatchIndex=state.matches.length-1;
  broadcastPlayResult("cumulative",broadcastMatchIndex);
}
function broadcastNextStart(){
  const next=Math.min(state.matchCount-1, Math.max(0,state.matches.length));
  setBroadcastView("matchStart",true,next);
}
function setupBroadcastShortcuts(){
  window.addEventListener("keydown",e=>{
    if(e.target && /input|select|textarea/i.test(e.target.tagName))return;
    if(!broadcastWindow || broadcastWindow.closed)return;
    const k=e.key.toLowerCase();
    if(k==="c"){e.preventDefault();broadcastCurrentCumulative()}
    else if(k==="r"){e.preventDefault();broadcastCurrentMatch()}
    else if(k==="f"){e.preventDefault();setBroadcastView("final",true,broadcastMatchIndex)}
    else if(k==="s"){e.preventDefault();broadcastNextStart()}
    else if(/^[1-9]$/.test(k)){
      const i=Number(k)-1;
      if(state.matches[i])broadcastPlayResult("match",i);
    }
  });
}
function initBroadcastOnly(){
  document.body.classList.add("broadcast-only");ensureBroadcastChannel();
  window.addEventListener("message",e=>{if(e.data&&e.data.type==="eqas-broadcast")handleBroadcastMessage(e.data)});
  window.addEventListener("storage",e=>{if(e.key==="eqasBroadcastMessage"&&e.newValue){try{handleBroadcastMessage(JSON.parse(e.newValue))}catch(err){}}});
  try{const saved=localStorage.getItem(STORAGE_KEY);if(saved)Object.assign(state,JSON.parse(saved))}catch(e){}
  applyBroadcastTheme();updateBroadcastLogo();renderBroadcast(false);setTimeout(sendBroadcastReady,80);setTimeout(sendBroadcastReady,500);
}
const __eqasOriginalInit=init;
init=function(){
  if(isBroadcastOnly()){initBroadcastOnly();return}
  __eqasOriginalInit();ensureBroadcastChannel();applyBroadcastTheme();updateBroadcastMatchButtons();
  $("#openBroadcastBtn").onclick=openBroadcast;
  $$('[data-broadcast]').forEach(btn=>btn.addEventListener("click",()=>{
    const v=btn.dataset.broadcast;
    if(v==="transition"){sendBroadcast(broadcastView,true,broadcastMatchIndex);return}
    if(v==="matchStart"){broadcastNextStart();return}
    if(v==="cumulative"){broadcastCurrentCumulative();return}
    if(v==="match"){broadcastCurrentMatch();return}
    setBroadcastView(v,true,broadcastMatchIndex);
  }));
  setupBroadcastShortcuts();
  $("#nextMatchBtn").addEventListener("click",()=>setTimeout(()=>{if(state.matches.length)setBroadcastView("matchStart",true,Math.min(state.currentMatch+1,5))},120));
  // MATCH確定後は、配信画面で「MATCH X RESULT」の文字演出を出してから、
  // 自動的にそのMATCHの順位表へ切り替える。オペレーター操作は不要。
  $("#submitMatchBtn").addEventListener("click",()=>setTimeout(()=>{
    if(state.matches.length){
      updateBroadcastMatchButtons();
      broadcastMatchIndex=state.currentMatch;
      sendBroadcast("match",true,state.currentMatch);
    }
  },250));
  $("#finalResultBtn").addEventListener("click",()=>setTimeout(()=>sendBroadcast("final",true,broadcastMatchIndex),150));
  window.addEventListener("beforeunload",()=>{try{broadcastChannel?.close()}catch(e){}});
};

document.addEventListener("DOMContentLoaded",init);
