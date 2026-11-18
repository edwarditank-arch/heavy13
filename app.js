const G=Game,$=s=>document.querySelector(s),names={red:'빨강',green:'초록',blue:'파랑',rainbow:'레인보우'},key='heavy13-save-v1';let state=null,card=null,chip=null,target=null;try{let old=JSON.parse(localStorage.getItem(key));if(old&&old.version===1&&old.players.length>=2&&old.players.length<=10)state=old;}catch(e){}function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch(e){}}
if (state) G.restoreRoster(state);

function portraitPosition(rosterId) {
 const index = rosterId - 1;
 return `${(index % 5) * 25}% ${Math.floor(index / 5) * 50}%`;
}

function playerAvatar(id) {
 if (!id) return '<span class="avatar sdFace selfFace" aria-hidden="true"></span>';
 const position = portraitPosition(state.players[id].rosterId);
 return `<span class="avatar sdFace" style="background-position:${position}" aria-hidden="true"></span>`;
}

function traitBadge(rosterId) {
 const profile=G.persona(rosterId);
 return profile ? '<span class="traitBadge">'+profile.trait+'</span>' : '';
}
function profilesForMatch(game, preferences) {
 return Object.fromEntries(game.players.slice(1).map((player, index) =>
  [index + 1, {...preferences[player.rosterId]}]));
}
const aiSettingsKey='heavy13-ai-profiles-v1',aiFields={risk:'aiRisk',variety:'aiVariety',highCards:'aiHighCards',rainbow:'aiRainbow'};
function copyAIProfiles(source={}){
 return Object.fromEntries(G.aiNames.map((_,index)=>{const id=index+1,raw=source?.[id];return [id,G.normalizeProfile({...G.defaultProfile(id),...(raw&&typeof raw==='object'?raw:{})})];}));
}
function migrateProfiles(source){
 const legacy=[[.35,.6,.65,.45],[.65,.45,.4,.65],[.4,.65,.6,.35],[.75,.35,.35,.7],[.8,.55,.25,.6],[.35,.4,.75,.4],[.6,.5,.45,.7],[.2,.5,.85,.25],[.5,.75,.5,.35]];
 const profiles=copyAIProfiles();
 for(const [id,settings] of Object.entries(source || {})){
  if(!profiles[id] || !settings)continue;
  Object.keys(aiFields).forEach((field,index)=>{
   if(Number.isFinite(settings[field]) && settings[field] !== (legacy[id-1]?.[index] ?? .5))profiles[id][field]=settings[field];
  });
 }
 return profiles;
}
function loadAIProfiles(){
 try{const stored=JSON.parse(localStorage.getItem(aiSettingsKey));if(stored?.profiles && typeof stored.profiles==='object'){
  if(stored.version===2)return copyAIProfiles(stored.profiles);
  if(stored.version===1)return migrateProfiles(stored.profiles);
 }}catch(e){}
 const byRoster = {};
 if (state?.aiProfiles) {
  state.players.slice(1).forEach((player, index) => {
   byRoster[player.rosterId] = state.aiProfiles[index + 1];
  });
 }
 return state?.traitProfiles ? copyAIProfiles(byRoster) : migrateProfiles(byRoster);
}
let aiPreferences=loadAIProfiles(),aiDraft=null,aiSettingsReturnToSetup=false;
if(state){if(!state.traitProfiles || state.phase==='select' || !state.aiProfiles)state.aiProfiles=profilesForMatch(state,aiPreferences);state.traitProfiles=true;save();}
function renderAISettings(){
 if(!aiDraft)return;
 const id=Number($('#aiPlayer').value),profile=aiDraft[id];if(!profile)return;
 $('#profileDetail').textContent=G.persona(id).description;
 $('#profilePortrait').style.backgroundPosition=portraitPosition(id);
 for(const [field,inputId] of Object.entries(aiFields)){
  const value=Math.round(profile[field]*100);$('#'+inputId).value=value;$('#'+inputId+'Value').textContent=value;
 }
}
function openAISettings(){
 aiDraft=copyAIProfiles(aiPreferences);
 $('#aiPlayer').innerHTML=G.aiNames.map((name,index)=>`<option value="${index+1}">${name} · ${G.persona(index+1).trait}</option>`).join('');
 $('#aiPlayer').value=String(state?.players[1]?.rosterId ?? 1);renderAISettings();
 aiSettingsReturnToSetup=$('#setup').open;
 if(aiSettingsReturnToSetup)$('#setup').close();
 $('#aiSettings').showModal();
}
function closeAISettings(){
 aiDraft=null;$('#aiSettings').close();
 if(aiSettingsReturnToSetup){aiSettingsReturnToSetup=false;openSetup();}
}
function cancelAISettings(){closeAISettings();}
function applyAISettings(){
 if(!aiDraft)return;
 aiPreferences=copyAIProfiles(aiDraft);
 try{localStorage.setItem(aiSettingsKey,JSON.stringify({version:2,profiles:aiPreferences}));}catch(e){}
 // Keep an already submitted round on its original settings until the next submission.
 if(state?.phase==='select'){state.aiProfiles=profilesForMatch(state,aiPreferences);save();}
 closeAISettings();
}
function resetAIProfile(all=false){
 if(!aiDraft)return;
 if(all)aiDraft=copyAIProfiles();else{const id=Number($('#aiPlayer').value);aiDraft[id]=G.defaultProfile(id);}
 renderAISettings();
}
$('#aiOpen').onclick=openAISettings;$('#aiSetupOpen').onclick=openAISettings;
$('#aiPlayer').onchange=renderAISettings;
for(const [field,inputId] of Object.entries(aiFields))$('#'+inputId).oninput=e=>{
 if(!aiDraft)return;
 const id=Number($('#aiPlayer').value);
 aiDraft[id]=G.normalizeProfile({...aiDraft[id],[field]:Number(e.target.value)/100});
 $('#'+inputId+'Value').textContent=Math.round(aiDraft[id][field]*100);
};
$('#aiResetPlayer').onclick=()=>resetAIProfile();$('#aiResetAll').onclick=()=>resetAIProfile(true);
$('#aiApply').onclick=applyAISettings;$('#aiCancel').onclick=cancelAISettings;
$('#aiSettings').addEventListener('cancel',e=>{e.preventDefault();cancelAISettings();});
function openSetup(){ $('#cancelSetup').hidden=!state;$('#setup').showModal();}$('#count').oninput=e=>{ $('#countLabel').textContent=e.target.value+'명'; $('#totalCount').textContent=String(Number(e.target.value)+1); };$('#start').onclick=()=>{stopPlayback();state=G.create(+$('#count').value);state.traitProfiles=true;state.aiProfiles=profilesForMatch(state,aiPreferences);card=chip=target=null;save();$('#setup').close();render();};$('#cancelSetup').onclick=()=>$('#setup').close();$('#newOpen').onclick=openSetup;$('#rulesOpen').onclick=()=>$('#rules').showModal();$('#rulesClose').onclick=()=>$('#rules').close();$('#setup').addEventListener('cancel',e=>{if(!state)e.preventDefault();});
// Playback is transient: save only complete engine actions, so reload never duplicates a stone.
let playback=null,playbackError='';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function livePlayback(run){return playback===run&&state===run.game;}
function reducedMotion(){return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;}
function stopPlayback(){
 const old=playback;playback=null;playbackError='';
 if(old){for(const animation of old.animations)animation.cancel();for(const node of old.floating)node.remove();}
}
async function tableReady(run){
 while(livePlayback(run)&&(document.hidden||document.querySelector('dialog[open]')))await pause(100);
 return livePlayback(run);
}
async function motion(run,element,frames,duration){
 if(!element||typeof element.animate!=='function'){await pause(duration);return;}
 let animation;
 try{animation=element.animate(frames,{duration,easing:'ease-in-out',fill:'forwards'});run.animations.add(animation);await animation.finished;}catch(e){/* A cancelled or unavailable visual effect must not change game rules. */}
 finally{if(animation){run.animations.delete(animation);animation.cancel();}}
}
async function animateAction(run,action){
 if(!await tableReady(run)||!livePlayback(run))return false;
 const move={...G.current(state)},color=move.color==='rainbow'?action.color:move.color;
 const points=action.pass?0:(G.sum(state.piles[color])+move.value>=13?state.piles[color].length:0);
 Object.assign(run,{move,color,points,pass:action.pass,landed:false,feedbackDone:false});target=null;render();
 const short=reducedMotion();await pause(short?80:260);
 if(!await tableReady(run)||!livePlayback(run))return false;
 const source=document.querySelector('.move[data-player="'+move.id+'"]');
 if(action.pass){
  await motion(run,source,short?[{opacity:1},{opacity:.55}]:[{transform:'translateX(0)',opacity:1},{transform:'translateX(10px)',opacity:.45},{transform:'translateX(0)',opacity:.65}],short?180:420);
 }else{
  const pile=document.querySelector('.pile[data-pile="'+color+'"]'),stones=pile?.querySelector('.stones');
  const origin=source?.querySelector('strong')?.getBoundingClientRect();
  let slot;
  if(stones){
   const empty=stones.querySelector('.empty');if(empty)empty.hidden=true;
   slot=document.createElement('span');slot.className='stone arrivalSlot';slot.textContent=move.value;slot.setAttribute('aria-hidden','true');stones.appendChild(slot);run.floating.add(slot);
  }
  const destination=(points?stones?.querySelector('.stone'):slot)?.getBoundingClientRect();
  if(origin&&destination){
   const stone=document.createElement('div');stone.className='flyingStone '+color;stone.textContent=move.value;stone.setAttribute('aria-hidden','true');
   const x=origin.left+origin.width/2-20,y=origin.top+origin.height/2-20;
   stone.style.left=x+'px';stone.style.top=y+'px';document.body.appendChild(stone);run.floating.add(stone);
   const dx=destination.left+destination.width/2-20-x,dy=destination.top+destination.height/2-20-y;
   run.flying=true;
   await motion(run,stone,short?[{opacity:0},{opacity:1}]:[
    {transform:'translate(0,0) scale(1)',opacity:1},
    {transform:'translate('+dx*.5+'px,'+(dy*.5-65)+'px) scale(1.25)',offset:.5,opacity:1},
    {transform:'translate('+dx+'px,'+dy+'px) scale(.65)',opacity:1}
   ],short?100:680);
   run.flying=false;stone.remove();run.floating.delete(stone);
  }else await pause(short?100:680);
  if(slot){slot.remove();run.floating.delete(slot);}
  if(!await tableReady(run)||!livePlayback(run))return false;
  if(points)await motion(run,stones,short?[{opacity:1},{opacity:.3}]:[{transform:'translateY(0)',opacity:1},{transform:'translateY(14px)',opacity:0}],short?100:220);
 }
 if(!await tableReady(run)||!livePlayback(run))return false;
 G.act(state,action.pass,color);save();run.landed=true;render();
 if(action.pass)await pause(short?160:420);
 else{
  const pile=document.querySelector('.pile[data-pile="'+color+'"]');
  const feedback=points?animatePenalty(run,short):Promise.resolve();
  await motion(run,pile,short?[{opacity:.7},{opacity:1}]:[
   {transform:'scale(1)'},{transform:points?'translateX(-4px) scale(1.02)':'scale(1.025)',offset:.35},
   {transform:points?'translateX(4px)':'scale(1.01)',offset:.65},{transform:'scale(1)'}
  ],short?180:420);
  await feedback;
  await pause(short?80:200);
 }
 return livePlayback(run);
}
function penaltyHtml(playerId){
 const run=playback;
 if(!run?.landed||!run.points||run.feedbackDone)return '';
 if(playerId!==run.move.id)return '';
 return '<span class="penaltyDelta">+'+run.points+'점</span>';
}
async function animatePenalty(run,short){
 const nodes=[document.querySelector('.move[data-player="'+run.move.id+'"] .penaltyDelta'),document.querySelector('.player[data-player="'+run.move.id+'"] .penaltyDelta')].filter(Boolean);
 const frames=short?[{opacity:0},{opacity:1,offset:.15},{opacity:1,offset:.65},{opacity:0}]:[
  {opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)',offset:.15},
  {opacity:1,transform:'translateY(0)',offset:.6},{opacity:0,transform:'translateY(-8px)'}
 ];
 await Promise.all(nodes.map(node=>motion(run,node,frames,short?900:1250)));
 run.feedbackDone=true;
 for(const node of nodes)node.remove();
}
async function playSequence(firstAction=null){
 if(playback||!state||state.phase!=='resolve'||(!firstAction&&G.current(state).id===0))return;
 const run={game:state,animations:new Set(),floating:new Set()};playback=run;playbackError='';
 try{
  while(livePlayback(run)&&state.phase==='resolve'){
   const move=G.current(state);if(move.id===0&&!firstAction)break;
   const action=firstAction||G.botAction(state);firstAction=null;
   if(!await animateAction(run,action))break;
  }
 }catch(error){if(livePlayback(run)){playbackError='배치 진행이 멈췄습니다. 다시 진행해 주세요.';console.error(error);}}
 finally{
  for(const animation of run.animations)animation.cancel();for(const node of run.floating)node.remove();
  if(livePlayback(run)){playback=null;target=null;render();}
 }
}
function advanceBots(){return playSequence();}
function clickCard(n){if(playback)return;card=n;render();}
function clickChip(c){if(playback)return;chip=c;render();}
function selectTarget(c){if(playback)return;target=c;render();}
function commit(){if(playback||card===null||!chip||state.phase!=='select')return;state.aiProfiles=profilesForMatch(state,aiPreferences);let moves=state.players.map((p,id)=>id?G.choose(state,id):{id:0,value:card,color:chip});G.submit(state,moves);card=chip=null;save();render();}
function uncover(){if(playback||!state||!['chips','cards'].includes(state.phase))return;G.reveal(state);save();render();if(state.phase==='resolve')return advanceBots();}
function place(pass=false){if(playback||!state||state.phase!=='resolve')return;let m=G.current(state);if(!m||m.id!==0||(pass&&m.deferred))return;if(!pass&&m.color==='rainbow'&&!target)return;return playSequence({pass,color:target});}
function nextRound(){if(playback||state?.phase!=='roundEnd')return;G.next(state);card=chip=target=null;save();render();}
function pileHtml(c) {
 const active = playback?.color === c && !playback.pass;
 return HeavyBoard.pedestal(c, state.piles[c], active, active && playback.landed && playback.points > 0);
}
function movesHtml(){
 const order=state.phase==='chips'?state.moves:G.order(state.moves,state.roundLeader??state.leader,state.players.length);
 const cur=playback?.move||(state.phase==='resolve'?G.current(state):null);
 return '<div class="moves">'+order.map(m=>{
  const placed=state.events.some(e=>e.id===m.id&&e.type==='place'),passed=state.events.some(e=>e.id===m.id&&e.type==='pass');
  const active=cur?.id===m.id;
  const status=placed?'배치 완료':active?(m.id===0?'내 차례':'차례'):passed?'패스 대기':'';
  return '<div class="move '+m.color+(active?' active':'')+(placed?' played':'')+(passed&&!placed?' deferred':'')+'" data-player="'+m.id+'"><small class="movePlayer">'+playerAvatar(m.id)+'<span class="moveName">'+state.players[m.id].name+'</span></small><strong>'+(state.phase==='chips'?'?':m.value)+'</strong><span>'+names[m.color]+'</span><div class="moveStatus">'+status+'</div><div class="moveScore">현재 벌점 <b>'+state.players[m.id].score+'점</b></div><div class="moveFeedback">'+penaltyHtml(m.id)+'</div></div>';
 }).join('')+'</div>';
}
function playbackHtml(){
 const run=playback,who=state.players[run.move.id].name;
 const text=run.pass?who+' · 패스':who+' · '+names[run.color]+' '+run.move.value+' 배치'+(run.landed?' 완료':' 중');
 const detail=run.pass?'패스한 플레이어는 역순으로 돌아옵니다.':run.landed?(run.points?'13 이상! 벌점 +'+run.points+' · 새 돌만 남습니다.':'합계 '+G.sum(state.piles[run.color])+' · 안전하게 배치했습니다.'):'돌이 단상에 도착하면 다음 차례로 넘어갑니다.';
 return '<div class="playbackNotice '+(run.landed&&run.points?'danger':'')+'" role="status">'+playerAvatar(run.move.id)+'<div><div class="phaseTitle">'+text+'</div><p class="phaseDesc">'+detail+'</p></div></div>'+movesHtml();
}
function stageHtml(){let s=state;if(playback?.move)return playbackHtml();if(s.phase==='resolve'&&G.current(s).id!==0)return `<div class="phaseTitle">AI의 배치 차례입니다.</div>${movesHtml()}<p class="phaseDesc">${playbackError||'다음 배치를 준비하고 있습니다.'}</p><button class="primary" onclick="advanceBots()">배치 계속</button>`;if(s.phase==='select')return `<div class="phaseTitle">당신의 무게를 선택하세요.</div><p class="phaseDesc">아래에서 숫자 카드와 색깔 칩을 고르세요. 모두의 선택은 동시에 확정됩니다.</p>`;
if(s.phase==='chips'||s.phase==='cards')return `<div class="phaseTitle">${s.phase==='chips'?'색깔 칩 공개':'숫자 카드 공개'}</div><p class="phaseDesc">${s.phase==='chips'?'AI도 선택을 마쳤습니다. 숫자를 공개해 배치 순서를 확인하세요.':'레인보우 → 높은 숫자 → 선 플레이어부터 좌석 순. 테두리로 현재 차례를 표시합니다.'}</p>${movesHtml()}<button class="primary" onclick="uncover()">${s.phase==='chips'?'숫자 카드 공개':'배치 시작'} <span>→</span></button>`;
if(s.phase==='resolve'){let m=G.current(s);let c=m.color==='rainbow'?target:m.color;let p=c?s.piles[c]:null,hit=p&&G.sum(p)+m.value>=13;return `<div class="phaseTitle">당신의 배치 차례입니다.</div>${movesHtml()}<div class="decision"><p class="phaseDesc">${m.deferred?'패스 후 다시 돌아온 차례입니다. 이번에는 배치해야 합니다.':'지금 배치하거나 한 번 패스할 수 있습니다.'} 카드 <b>${m.value}</b> · ${names[m.color]}</p>${m.color==='rainbow'?`<div class="chipRow">${G.colors.map(c=>`<button class="chip ${c} ${target===c?'selected':''}" onclick="selectTarget('${c}')"><i class="dot"></i>${names[c]} · ${G.sum(s.piles[c])+m.value>=13?'벌점 +'+s.piles[c].length:'합계 '+(G.sum(s.piles[c])+m.value)}</button>`).join('')}</div>`:''}<p class="hint ${hit?'danger':''}" style="margin:12px 0 0">${p?(hit?`13 이상! 기존 바위 ${p.length}개를 수거하고 벌점 +${p.length}를 받습니다.`:`배치 후 합계 ${G.sum(p)+m.value}. 벌점 없이 바위가 추가됩니다.`):'레인보우를 놓을 받침대를 선택하세요.'}</p><div class="controls"><button class="primary" onclick="place(false)" ${!c?'disabled':''}>${hit?'벌점 받고 배치':'바위 배치'} <span>↓</span></button><button class="secondary" onclick="place(true)" ${m.deferred?'disabled':''}>패스 · 마지막 순서로</button></div></div>`;}
if(s.phase==='roundEnd')return `<div class="eyebrow">ROUND COMPLETE</div><div class="phaseTitle">${s.round}라운드가 끝났습니다.</div><p class="phaseDesc">다음 선 플레이어: ${s.players[s.leader].name}${s.lastPenalty===null?' (벌점 없이 선 유지)':''}<br>${s.round===7?'새 카드와 칩을 지급합니다. 받침대의 바위는 그대로 유지됩니다.':'받침대와 벌점은 다음 라운드로 이어집니다.'}</p><button class="primary" onclick="nextRound()">${s.round+1}라운드 시작 <span>→</span></button>`;
const ranking=G.ranking(s);let rank=0;return `<div class="eyebrow">FINAL RESULTS</div><div class="phaseTitle">${ranking[0].id===0?'가장 가벼운 선택, 당신의 승리입니다.':'14라운드의 모든 선택이 끝났습니다.'}</div><p class="phaseDesc">벌점이 적을수록 상위 · 동점은 마지막 벌점 시점으로 판정</p>${ranking.map((p,i)=>{if(i===0||p.score!==ranking[i-1].score||p.last!==ranking[i-1].last)rank=i+1;return `<div class="resultRow ${p.id===0?'me':''}"><strong>${rank}</strong>${playerAvatar(p.id)}<span>${p.name}${traitBadge(p.rosterId)}${p.id===0?' · YOU':''}</span><b>${p.score}점</b></div>`;}).join('')}<button style="margin-top:20px" class="primary" onclick="openSetup()">다시 도전 <span>↗</span></button>`;}
function render(){if(!state){$('#app').innerHTML='<div class="intro"><div><div class="eyebrow">무거운 13 · AI 연습</div><h1>13의 형벌을 받을 자 누구인가.</h1><p class="subtitle">세 받침대에 쌓이는 숫자들. 지금 돌을 놓을까, 한 번뿐인 패스로 다음 사람에게 차례를 넘길까?</p></div></div>';return;}
let s=state,p=s.players[0],playing=s.phase==='select';if(s.phase==='chips')s.roundLeader=s.leader;let history=s.events.slice().reverse().map(e=>`<p class="${e.points?'penalty':''}">${e.text}</p>`).join('');let previous=s.log.filter(l=>l.round!==s.round).slice(0,3).map(l=>`<div class="round">ROUND ${String(l.round).padStart(2,'0')}</div>${l.events.map(e=>`<p class="${e.points?'penalty':''}">${e.text}</p>`).join('')}`).join('');$('#app').innerHTML=`<div class="intro"><div><div class="eyebrow">무거운 13 · AI 연습</div><h1>13의 형벌을 받을 자 누구인가.</h1><p class="subtitle">세 받침대에 쌓이는 숫자들. 지금 돌을 놓을까, 한 번뿐인 패스로 다음 사람에게 차례를 넘길까?</p></div><div class="roundTag"><strong>${String(s.round).padStart(2,'0')}</strong><span>ROUND<br>OF 14</span></div></div><div class="layout"><section><div class="table"><div class="tableTop"><span>THE TABLE · ${s.players.length} PLAYERS</span><span class="badge">선 플레이어 · ${s.players[s.leader].name}</span></div><div class="piles">${G.colors.map(pileHtml).join('')}</div><div class="stage" aria-live="polite">${stageHtml()}</div></div>${s.phase!=='finished'?`<div class="handPanel"><div class="panelHeading"><h3>나의 바위 카드</h3><span>SET ${s.round<=7?'01':'02'} · ${p.hand.length}장 남음</span></div><div class="hand">${[0,1,2,3,4,5,6].map(n=>`<button class="card ${card===n?'selected':''}" ${!playing||!p.hand.includes(n)?'disabled':''} onclick="clickCard(${n})" aria-label="숫자 ${n} 카드" aria-pressed="${card===n}"><small>${n}</small>${n}</button>`).join('')}</div><div class="panelHeading"><h3>나의 색깔 칩</h3><span>레인보우는 배치할 때 색깔 선택</span></div><div class="chipRow">${[...G.colors,'rainbow'].map(c=>`<button class="chip ${c} ${chip===c?'selected':''}" ${!playing||!p.chips[c]?'disabled':''} onclick="clickChip('${c}')" aria-pressed="${chip===c}"><i class="dot"></i>${names[c]}<b>×${p.chips[c]}</b></button>`).join('')}</div>${playing?`<div class="handBottom"><span class="hint">${card!==null&&chip?`선택: ${card} · ${names[chip]}`:'카드 1장 + 색깔 칩 1개를 선택하세요.'}<br>제출 후에는 바꿀 수 없습니다.</span><button class="primary" onclick="commit()" ${card===null||!chip?'disabled':''}>선택 제출 <span>→</span></button></div>`:''}</div>`:''}</section><aside><div class="sidepanel"><h3>플레이어 <span style="color:var(--muted)">/ 벌점</span></h3>${s.players.map((p,i)=>`<div class="player ${i===0?'me':''}" data-player="${i}">${playerAvatar(i)}<div class="playerName">${p.name}${traitBadge(p.rosterId)}${s.leader===i?'<small>◆ 선 플레이어</small>':''}</div><div class="points">${p.score}<small>점</small>${penaltyHtml(i)}</div></div>`).join('')}<div class="saved">진행 상황이 이 브라우저에 자동 저장됩니다.</div></div><div class="sidepanel"><h3>매치 기록 <span style="color:var(--gold)">↙</span></h3><div class="log">${history||'<p>제출한 선택과 배치 결과가<br>이곳에 기록됩니다.</p>'}${previous}</div></div></aside></div>`;}
render();if(!state)openSetup();else if(state.phase==='resolve')advanceBots();
