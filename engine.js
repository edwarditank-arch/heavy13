(function(root){
const colors=['red','green','blue'];
function fresh(p){p.hand=[0,1,2,3,4,5,6];p.chips={red:2,green:2,blue:2,rainbow:1};}
const aiNames = Object.freeze(['화요리', '쿤쿤쿤', '졔졔', '선수', '예슬', '에스', '쌉티', '금쪽', '너콩', '아리', '유뇨', '패치', '제현', '코난', '너구리']);

function drawOpponents(count, humanNames) {
 const pool = aiNames.map((_, index) => index + 1).filter(id => !humanNames.includes(aiNames[id - 1]));
 for (let i = pool.length - 1; i > 0; i--) {
  const other = Math.floor(Math.random() * (i + 1));
  [pool[i], pool[other]] = [pool[other], pool[i]];
 }
 return pool.slice(0, count);
}

function create(n) {
 return createMatch(['나'], n);
}

function createMatch(humanNames, botCount) {
 const players = humanNames.map(name => ({name, score:0, last:0}));
 for (const rosterId of drawOpponents(botCount, humanNames)) {
  players.push({rosterId, name:aiNames[rosterId - 1], score:0, last:0});
 }
 players.forEach(fresh);
 return {version:1, round:1, leader:Math.floor(Math.random()*players.length),
  piles:{red:[],green:[],blue:[]}, players, phase:'select', queue:[], passed:[], events:[], clock:0, log:[]};
}

// Original saves identified an AI and its preferences by seat number.
function restoreRoster(game) {
 const hasLegacySeats = game.players.slice(1).some(player => !player.rosterId);
 if (!hasLegacySeats) return;
 const previousNames = game.players.map(player => player.name);
 game.players.slice(1).forEach((player, index) => {
  player.rosterId = index + 1;
  player.name = aiNames[index];
 });
 const refreshEvent = event => {
  const oldName = previousNames[event.id];
  if (event.id > 0 && event.text?.startsWith(oldName + ' · ')) {
   event.text = game.players[event.id].name + event.text.slice(oldName.length);
  }
 };
 game.events.forEach(refreshEvent);
 game.log.forEach(round => round.events.forEach(refreshEvent));
}
function sum(a){return a.reduce((a,b)=>a+b,0);}
function order(moves,leader,n){return moves.slice().sort((a,b)=>(+(b.color==='rainbow')-+(a.color==='rainbow'))||b.value-a.value||((a.id-leader+n)%n)-((b.id-leader+n)%n));}
function submit(s,moves){if(s.phase!=='select')throw Error('phase');if(moves.length!==s.players.length||new Set(moves.map(m=>m.id)).size!==moves.length)throw Error('moves');for(const m of moves){const p=s.players[m.id];if(!p||!p.hand.includes(m.value)||!p.chips[m.color])throw Error('illegal');}for(const m of moves){const p=s.players[m.id];p.hand.splice(p.hand.indexOf(m.value),1);p.chips[m.color]--;}
s.moves=moves;s.queue=order(moves,s.leader,s.players.length).map(m=>({...m,deferred:false}));s.passed=[];s.events=[];s.lastPenalty=null;s.phase='chips';}
function reveal(s){if(s.phase==='chips')s.phase='cards';else if(s.phase==='cards')s.phase='resolve';}
function current(s){return s.queue[0];}
function act(s,pass,color){if(s.phase!=='resolve')throw Error('phase');let m=current(s);if(!m)throw Error('empty');if(pass){if(m.deferred)throw Error('double pass');s.queue.shift();s.passed.push({...m,deferred:true});s.events.push({id:m.id,text:s.players[m.id].name+' · 패스',type:'pass'});}else{color=m.color==='rainbow'?color:m.color;if(!colors.includes(color))throw Error('color');s.queue.shift();const pile=s.piles[color];let points=0;if(sum(pile)+m.value>=13){points=pile.length;s.players[m.id].score+=points;s.players[m.id].last=++s.clock;s.lastPenalty=m.id;s.piles[color]=[];}s.piles[color].push(m.value);s.events.push({id:m.id,color,value:m.value,points,text:s.players[m.id].name+' · '+({red:'빨강',green:'초록',blue:'파랑'}[color])+' '+m.value+(points?' → 벌점 +'+points:' → 안전'),type:'place'});}
if(!s.queue.length&&s.passed.length){s.queue=s.passed.reverse();s.passed=[];}
if(!s.queue.length){if(s.lastPenalty!==null)s.leader=s.lastPenalty;s.log.unshift({round:s.round,moves:s.moves.map(m=>({...m})),events:s.events.slice()});s.phase=s.round===14?'finished':'roundEnd';}}
function next(s){if(s.phase!=='roundEnd')throw Error('phase');if(s.round===7)s.players.forEach(fresh);s.round++;s.phase='select';s.moves=[];s.events=[];}
function ranking(s){return s.players.map((p,id)=>({...p,id})).sort((a,b)=>a.score-b.score||a.last-b.last);}
// Submission observations deliberately exclude other players' actual hands and current moves.
const chipColors=[...colors,'rainbow'];
function normalizeProfile(raw={}){
 const result={};for(const key of ['risk','variety','highCards','rainbow'])result[key]=Number.isFinite(raw?.[key])?Math.max(0,Math.min(1,raw[key])):.5;
 return result;
}
// Small, editable differences; no animal is tied to a particular chip color.
function defaultProfile(id){
 const presets=[[.35,.6,.65,.45],[.65,.45,.4,.65],[.4,.65,.6,.35],[.75,.35,.35,.7],[.8,.55,.25,.6],[.35,.4,.75,.4],[.6,.5,.45,.7],[.2,.5,.85,.25],[.5,.75,.5,.35]];
 const values=presets[id-1];return values?Object.fromEntries(['risk','variety','highCards','rainbow'].map((key,i)=>[key,values[i]])):normalizeProfile();
}
function profileFor(s,id,options){return options.profiles===false?normalizeProfile():normalizeProfile(s.aiProfiles?.[id]??defaultProfile(s.players[id]?.rosterId ?? id));}
function observe(s,id){
 const own=s.players[id],start=s.round<=7?1:8;
 const history=(s.log||[]).filter(r=>r.round>=start&&r.round<s.round).slice().sort((a,b)=>a.round-b.round);
 const opponents=[];
 for(let other=0;other<s.players.length;other++){
  if(other===id)continue;
  const hand=[0,1,2,3,4,5,6];let chipOptions=[{red:2,green:2,blue:2,rainbow:1}];
  for(const round of history){
   const known=round.moves?.find(m=>m.id===other),placed=round.events?.find(e=>e.id===other&&e.type==='place');
   const move=known||placed;if(!move)continue;
   const index=hand.indexOf(move.value);if(index!==-1)hand.splice(index,1);
   const possible=known?[known.color]:[placed.color,'rainbow'];const next=[];
   for(const chips of chipOptions)for(const color of possible)if(chips[color]>0){const copy={...chips};copy[color]--;next.push(copy);}
   if(next.length)chipOptions=[...new Map(next.map(c=>[chipColors.map(k=>c[k]).join(','),c])).values()];
  }
  opponents.push({id:other,hand,chipOptions});
 }
 return {id,round:s.round,leader:s.leader,count:s.players.length,hand:own.hand.slice(),chips:{...own.chips},piles:Object.fromEntries(colors.map(c=>[c,s.piles[c].slice()])),opponents};
}
function compactPiles(piles){return Object.fromEntries(colors.map(c=>[c,{total:sum(piles[c]),count:piles[c].length}]));}
function copyPiles(piles){return Object.fromEntries(colors.map(c=>[c,{...piles[c]}]));}
function penalty(piles,color,value){const p=piles[color];return p.total+value>=13?p.count:0;}
function put(piles,color,value){const points=penalty(piles,color,value),p=piles[color];if(p.total+value>=13){p.total=value;p.count=1;}else{p.total+=value;p.count++;}return points;}
function seededRandom(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function weightedIndex(weights,random){let target=random()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<weights.length;i++){target-=weights[i];if(target<0)return i;}return weights.length-1;}
function bestTarget(piles,move,random){
 const opts=move.color==='rainbow'?colors:[move.color];let best=Infinity,choices=[];
 for(const color of opts){const cost=penalty(piles,color,move.value)*100+piles[color].total;if(cost<best){best=cost;choices=[color];}else if(cost===best)choices.push(color);}
 return choices[Math.floor(random()*choices.length)];
}
// The simple continuation assumes remaining actors place; earlier passers return after us.
function simpleAction(piles,queue,random){
 const move=queue[0],color=bestTarget(piles,move,random),now=penalty(piles,color,move.value);
 if(!move.deferred&&now>0){
  const later=copyPiles(piles);
  for(const other of queue.slice(1))put(later,bestTarget(later,other,random),other.value);
  const target=bestTarget(later,move,random);
  if(penalty(later,target,move.value)<now)return {pass:true,color};
 }
 return {pass:false,color};
}
// A bounded rollout: future actors may themselves pass, with no recursive tree expansion.
function runQueue(initial,initialQueue,initialPassed,count,random,aware,force){
 const piles=copyPiles(initial),points=Array(count).fill(0);let queue=initialQueue.map(m=>({...m})),passed=initialPassed.map(m=>({...m}));
 let first=true;
 while(queue.length){
  const move=queue[0],action=first&&force?force:aware?plannedAction(piles,queue,passed,count,random):simpleAction(piles,queue,random);first=false;
  queue.shift();
  if(action.pass&&!move.deferred)passed.push({...move,deferred:true});else points[move.id]+=put(piles,action.color,move.value);
  if(!queue.length&&passed.length){queue=passed.reverse();passed=[];}
 }
 return {points,piles};
}
function plannedAction(piles,queue,passed,count,random){
 const move=queue[0],color=bestTarget(piles,move,random),now=penalty(piles,color,move.value);
 if(move.deferred||now===0)return {pass:false,color};
 const result=runQueue(piles,queue,passed,count,random,false,{pass:true,color});
 return {pass:result.points[move.id]<now,color};
}
function sampleOpponent(opponent,piles,count,random){
 const chips=opponent.chipOptions[Math.floor(random()*opponent.chipOptions.length)],candidates=[],weights=[];
 // Mix cautious and exploratory opponents instead of assuming equal color traffic.
 const temperature=.45+random()*.9;
 for(const value of opponent.hand)for(const color of chipColors){
  if(!chips[color])continue;
  const options=color==='rainbow'?colors:[color];
  const risk=Math.min(...options.map(c=>{
   const p=piles[c];return p.total+value>=13?p.count:Math.max(0,(p.total+value+(count-1)*.43-10)/4)*(p.count+1);
  }));
  const cost=risk+(color==='rainbow'?.3:0)-value*.055;
  candidates.push({id:opponent.id,value,color});weights.push(Math.exp(-cost/temperature));
 }
 return candidates[weightedIndex(weights,random)];
}
function remainingCost(hand,chips,move,piles,profile){
 const values=hand.filter(v=>v!==move.value),remaining={...chips};remaining[move.color]--;
 if(!values.length)return 0;
 let risk=0,units=0;
 for(const color of chipColors){if(!remaining[color])continue;const opts=color==='rainbow'?colors:[color];
  const average=values.reduce((total,v)=>total+Math.min(...opts.map(c=>penalty(piles,c,v))),0)/values.length;
  risk+=remaining[color]*average;units+=remaining[color];
 }
 const concentration=chipColors.reduce((total,c)=>total+remaining[c]*remaining[c],0)/(units*units);
 const high=values.reduce((a,b)=>a+b,0)/(values.length*6);
 const reserve=remaining.rainbow>0?(values.length/6)*(.15+.35*profile.rainbow):0;
 return .22*risk/units+.12*concentration*high-reserve;
}
function choose(s,id,options={}){
 const view=observe(s,id),profile=profileFor(s,id,options),piles=compactPiles(view.piles),candidates=[];
 for(const value of view.hand)for(const color of chipColors)if(view.chips[color])candidates.push({id,value,color});
 if(candidates.length===1)return candidates[0];
 const samples=Number.isFinite(options.samples)?Math.max(8,Math.min(96,Math.floor(options.samples))):24;
 const scenarios=Array.from({length:samples},()=>({moves:view.opponents.map(p=>sampleOpponent(p,piles,view.count,Math.random)),seed:Math.floor(Math.random()*4294967296)}));
 const costs=candidates.map(move=>{
  let total=0,squares=0,future=0;
  for(const scenario of scenarios){
   const queue=order([...scenario.moves,move],view.leader,view.count).map(m=>({...m,deferred:false}));
   const result=runQueue(piles,queue,[],view.count,seededRandom(scenario.seed),options.passes!==false);
   const points=result.points[id];total+=points;squares+=points*points;
   if(options.resources!==false)future+=remainingCost(view.hand,view.chips,move,result.piles,profile);
  }
  const average=total/samples,spread=Math.sqrt(Math.max(0,squares/samples-average*average));
  return average+(.1+.4*profile.risk)*spread+future/samples-move.value*(.015+.055*profile.highCards);
 });
 const best=Math.min(...costs),temperature=.1+.4*profile.variety,gap=.35+.8*profile.variety;
 const weights=costs.map(c=>c-best>gap?0:Math.exp(-(c-best)/temperature));
 return candidates[weightedIndex(weights,Math.random)];
}
function botAction(s,options={}){
 const piles=compactPiles(s.piles),queue=s.queue,move=queue[0];
 if(!move)throw Error('empty');
 return options.passes===false?simpleAction(piles,queue,Math.random):plannedAction(piles,queue,s.passed,s.players.length,Math.random);
}
const api={colors,aiNames,restoreRoster,fresh,create,createMatch,sum,order,submit,reveal,current,act,next,ranking,choose,botAction,observe,normalizeProfile,defaultProfile};if(typeof module!=='undefined')module.exports=api;else root.Game=api;
})(typeof window!=='undefined'?window:globalThis);
