(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const colors = {red:'빨강',green:'초록',blue:'파랑',rainbow:'레인보우'};
  const pileColors = ['red','green','blue'];
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const validCode = /^[A-HJ-NP-Z2-9]{6}$/;
  const api = 'https://mybanmespeirddniashf.supabase.co/functions/v1/heavy13-rooms';
  const inviteCode = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  const recentKey = 'heavy13.recentRoom';
  let code = '', token = '', state = null, busy = false, timer, selected = {}, disconnected = false;
  const localKey = c => 'heavy13.seat.' + c;
  const mem = new Map();
  function read(key) { try { return localStorage.getItem(key) || mem.get(key); } catch { return mem.get(key); } }
  function write(key,val) {
    mem.set(key,val);
    try { if(val) localStorage.setItem(key,val); else localStorage.removeItem(key); } catch { /* This session can still play. */ }
  }
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const say = message => { $('#notice').textContent = message; };
  const makeCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>alphabet[b%alphabet.length]).join('');
  const makeToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  const total = a => a.reduce((n,x)=>n+x,0);
  const btn = (action,text,klass='primary',disabled=false) => '<button class="'+klass+'" data-action="'+action+'" '+(disabled?'disabled':'')+'>'+text+'</button>';
  async function request(action, extra={}) {
    const response=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
      signal:AbortSignal.timeout(15000),body:JSON.stringify({code,token,action,round:state?.round,phase:state?.phase,revision:state?.revision,...extra})});
    const data=await response.json();
    if(!response.ok) { const err=new Error(data.error || '방을 불러오지 못했습니다.'); err.status=response.status; throw err; }
    return data;
  }
  function accept(data) {
    if(data.unchanged || (state && data.revision<state.revision)) return;
    if(!state || data.round!==state.round || data.phase!==state.phase) selected={};
    const gameChanged=!state || (data.gameRevision ?? data.revision)!==(state.gameRevision ?? state.revision);
    if(state?.queuePosition && !data.queuePosition)
      say(data.spectator?'게임이 시작되어 관전석으로 이동했습니다.':'자리가 생겨 플레이어로 합류했습니다.');
    state=data;
    if(data.spectator)roomChat.reset();else roomChat.show(code,'방 '+code,data.chat ?? []);
    $('#modeLabel').textContent=data.aiTable?'AI 대전 관전':data.queuePosition?'참가 대기 중':data.spectator?'친구 대전 관전':'친구 대전';
    $('#roomInfo').hidden=!!data.aiTable;
    $('#exitWatch').hidden=!data.spectator || !!data.queuePosition;
    $('#exitWatch').href=data.aiTable?'/':'/friends.html'; $('#entry').hidden=true; $('#match').hidden=false; $('#codeText').textContent=code;
    $('#title').textContent=data.phase==='lobby'?'대기실':data.phase==='finished'?'최종 순위':data.round+'라운드';
    if(gameChanged)render();
  }
  function schedule(ms=1900) {
    clearTimeout(timer);
    if(state && !state.aiTable && !document.hidden) timer=setTimeout(sync,ms);
  }
  async function sync() {
    if(!state || document.hidden || busy) return;
    const activeCode=code;
    try {
      const data=await request(state.spectator && !state.queuePosition?'watch':'read');
      if(!state || activeCode!==code) return;
      if(disconnected) {say('');disconnected=false;}
      accept(data);
    } catch(e) {
      if(activeCode!==code || !state) return;
      if([403,404].includes(e.status)) { toEntry();say(e.message);return; }
      disconnected=true;say('연결을 확인하고 있습니다. 잠시 후 자동으로 다시 연결합니다.');
    } finally { schedule(disconnected?4000:1900); }
  }
  function toEntry() {
    roomChat.reset();clearTimeout(timer);state=null;code='';token='';selected={};disconnected=false;
    history.replaceState(null,'',location.pathname);$('#entry').hidden=false;$('#match').hidden=true;
    $('#resume').hidden=!read(recentKey);
    $('#create').hidden=false;$('#roomSize').hidden=false;$('#roomCode').value='';
    $('#join').className='secondary';$('#join').textContent='코드로 입장';
  }
  async function enter(action,roomCode) {
    if(busy)return;
    const name=$('#nickname').value.trim();
    if(!validCode.test(roomCode)){say('영문과 숫자로 된 6자리 방 코드를 입력해 주세요.');return;}
    busy=true;code=roomCode;token=read(localKey(code)) || makeToken();
    write(localKey(code),token);
    let needsName=false;
    const form=$('#entryForm');for(const el of form.elements)el.disabled=true;
    try {
      const data=await request(action,action==='create' ? {name,capacity:Number($('#capacity').value)} : {name});
      if(data.needsName){
        needsName=true;
        say('닉네임을 입력하고 방에 입장해 주세요.');
        return;
      }
      if(name && (!data.spectator || data.queuePosition))write('heavy13.nickname',name);
      write(recentKey,code);
      history.replaceState(null,'','?room='+code);
      say('');accept(data);
    } catch(e) {
      if(action==='read' && [403,404].includes(e.status) && read(recentKey)===roomCode)write(recentKey,'');
      if(action==='create' && !e.status){write(recentKey,roomCode);$('#roomCode').value=roomCode;}
      $('#resume').hidden=!read(recentKey);
      say(e.status?e.message:'연결에 실패했습니다. 같은 방 코드로 다시 시도해 주세요.');
    } finally {busy=false;for(const el of form.elements)el.disabled=false;if(needsName)$('#nickname').focus();render();schedule();}
  }
  function botPortrait(id) {
    const n = id - 1;
    return '<span class="sdFace" aria-hidden="true" style="background-position:'+((n%5)*25)+'% '+(Math.floor(n/5)*50)+'%"></span>';
  }
  function traitFor(name, rosterId) {
    return Game.persona(rosterId || Game.aiNames.indexOf(name) + 1)?.trait || '';
  }
  function traitBadge(p) {
    const trait=traitFor(p.name,p.rosterId);
    return trait ? '<span class="traitBadge">'+esc(trait)+'</span>' : '';
  }
  function playerList(s) {
    return '<ul class="onlinePlayers">'+s.players.map((p,i)=>'<li><span'+(p.rosterId?' class="botName"':'')+'>'+(p.rosterId?botPortrait(p.rosterId):'')+esc(p.name)+traitBadge(p)+(p.rosterId?' <small>AI</small>':'')+(i===s.id?' <small>나</small>':'')+
      (i===0 && !s.aiTable?' <small>방장</small>':'')+(s.phase!=='lobby' && s.leader===i?' <small>선</small>':'')+'</span>'+
      (s.phase==='lobby'?'':(s.phase==='select'?(p.submitted?'제출 완료':'선택 중')+' · ':'')+'<b>'+p.score+'점</b>')+'</li>').join('')+'</ul>';
  }
  function piles(s) {
    return '<div class="piles">' + pileColors.map(color => HeavyBoard.pedestal(color, s.piles[color])).join('') + '</div>';
  }
  function hand(s) {
    return '<div class="handPanel"><div class="panelHeading"><h3>내 숫자 카드</h3><span>'+s.hand.length+'장 남음</span></div><div class="hand">'+
      Array.from({length:7},(_,n)=>'<button class="card '+(n===selected.value?'selected':'')+'" data-value="'+n+'" aria-label="숫자 '+n+' 카드" aria-pressed="'+(n===selected.value)+'" '+(s.hand.includes(n)?'':'disabled')+'>'+n+'</button>').join('')+
      '</div><div class="panelHeading"><h3>내 색깔 칩</h3></div><div class="chipRow">'+Object.keys(colors).map(c=>'<button class="chip '+c+' '+(selected.color===c?'selected':'')+'" data-color="'+c+'" aria-pressed="'+(selected.color===c)+'" '+(s.chips[c]?'':'disabled')+'><i class="dot"></i>'+colors[c]+' ×'+s.chips[c]+'</button>').join('')+'</div>'+
      btn('submit','선택 확정','primary',!Number.isInteger(selected.value)||!selected.color)+'</div>';
  }
  function moves(s) {
    if(!s.moves)return '';
    return '<div class="moves">'+s.moves.map(m=>'<div class="move '+m.color+(s.turn?.id===m.id?' active':'')+'"><small>'+esc(s.players[m.id].name)+'</small><strong>'+(m.value??'?')+'</strong><span>'+colors[m.color]+'</span></div>').join('')+'</div>';
  }
  function stage(s) {
    if(s.spectator){
      const headings={select:'카드와 칩을 고르는 중',chips:'색깔 칩 공개',cards:'숫자 카드 공개',
        roundEnd:s.round+'라운드 종료',resolve:s.turn?esc(s.players[s.turn.id].name)+'님의 배치 차례':''};
      return '<div class="phaseTitle">'+headings[s.phase]+'</div>'+moves(s);
    }
    if(s.phase==='select')return s.mine?'<div class="phaseTitle">선택을 확정했습니다</div><p>내 선택은 '+s.mine.value+' · '+colors[s.mine.color]+'입니다. 다른 참가자의 제출을 기다립니다.</p>':'<div class="phaseTitle">카드 한 장과 칩 한 개를 고르세요.</div><p>모두가 확정하면 색깔 칩부터 공개합니다.</p>';
    if(s.phase==='chips'||s.phase==='cards')return '<div class="phaseTitle">'+(s.phase==='chips'?'색깔 칩 공개':'배치 순서')+'</div>'+moves(s)+btn('advance',s.phase==='chips'?'숫자 공개':'배치 시작');
    if(s.phase==='roundEnd')return '<div class="phaseTitle">'+s.round+'라운드 종료</div><p>다음 선 플레이어 · '+esc(s.players[s.leader].name)+'</p>'+btn('advance',(s.round+1)+'라운드 시작');
    if(s.phase==='resolve'){
      const t=s.turn, mine=t.id===s.id;
      let out='<div class="phaseTitle">'+(mine?'내':esc(s.players[t.id].name)+'님의')+' 배치 차례</div>'+moves(s);
      if(!mine)return out+'<p>상대가 배치를 결정하고 있습니다.</p>';
      let c=t.color==='rainbow'?selected.target:t.color;
      if(t.color==='rainbow')out+='<p>레인보우를 놓을 받침대를 선택하세요.</p><div class="chipRow">'+pileColors.map(x=>'<button class="chip '+x+(c===x?' selected':'')+'" data-target="'+x+'">'+colors[x]+' · '+(total(s.piles[x])+t.value)+'</button>').join('')+'</div>';
      if(c){const n=total(s.piles[c])+t.value;out+='<p>'+colors[c]+'에 '+t.value+' 배치 · 합계 '+n+' · '+(n>=13?'벌점 +'+s.piles[c].length:'안전')+'</p>';}
      return out+'<div class="controls">'+btn('place','바위 배치','primary',!c)+btn('pass','패스','secondary',t.deferred)+'</div>';
    }
    return '';
  }
  function lobby(s) {
    const humans=s.players.length, size=s.capacity ?? 10;
    const waiting=s.waiting ?? [];
    const isHost=s.id===0;
    const options=Array.from({length:9},(_,index)=>{
      const n=index+2;
      return '<option value="'+n+'" '+(n===size?'selected ':'')+(n<humans?'disabled':'')+'>'+n+'명</option>';
    }).join('');
    const capacity=isHost?'<label class="lobbyCapacity">플레이어 정원 <select id="lobbyCapacity">'+options+'</select></label>':'';
    const empty=size-humans;
    const summary=!s.capacity?'두 명부터 시작할 수 있습니다.':empty?'시작하면 빈자리 '+empty+'석에 AI가 합류합니다.':'플레이어 자리가 모두 찼습니다.';
    const controls=(isHost?btn('start','친구 대전 시작','primary',!s.capacity && humans<2):'')+
      (!s.spectator || s.queuePosition?btn('leave',s.queuePosition?'대기 취소하고 나가기':'대기실 나가기','quiet'):'');
    const list=waiting.length?'<ol>'+waiting.map((name,i)=>
      '<li><span>'+esc(name)+'</span>'+(s.queuePosition===i+1?' <small>나</small>':'')+'</li>').join('')+'</ol>':'';
    let queueNote='자리가 생기면 먼저 기다린 사람부터 합류합니다.';
    if(s.queuePosition)queueNote='내 대기 순서 '+s.queuePosition+'번째 · 자리가 생기면 자동으로 합류하고, 게임이 먼저 시작되면 관전합니다.';
    else if(!waiting.length)queueNote='정원이 차면 다음 참가자가 여기에 표시됩니다.';
    return '<section class="lobby"><div class="lobbyHeading"><h2>플레이어 '+humans+' / '+size+'명</h2>'+capacity+'</div>'+
      playerList(s)+'<p>'+summary+'</p><div class="controls">'+controls+'</div></section>'+
      '<section class="lobby queuePanel"><h2>대기 명단 <span>'+waiting.length+'명</span></h2>'+list+'<p>'+queueNote+'</p></section>';
  }
  function render() {
    const s=state;if(!s)return;
    let content;
    if(s.phase==='lobby'){
      content=lobby(s);
    } else if(s.phase==='finished'){
      let rank=0;
      content='<div class="lobby">'+s.ranking.map((p,i,all)=>{if(!i||p.score!==all[i-1].score||p.last!==all[i-1].last)rank=i+1;
        return '<div class="rankLine"><strong>'+rank+'위</strong>'+esc(s.players[p.id].name)+traitBadge(s.players[p.id])+(p.id===s.id?' · 나':'')+'<b>'+p.score+'점</b></div>';}).join('')+
        '<div class="controls">'+(s.spectator?'':s.id===0?btn('rematch',s.players.some(p=>p.rosterId)?'AI 재추첨하고 다시 하기':'같은 멤버로 다시 하기'):'방장이 재대결을 시작할 수 있습니다.')+(s.spectator?'':btn('home','다른 방으로','quiet'))+'</div></div>';
    } else {
      const logs=[...s.events].reverse().concat([...s.previous].reverse());
      content='<div class="layout"><section><div class="table"><div class="tableTop">라운드 '+s.round+' / 14 <span class="badge">선 · '+esc(s.players[s.leader].name)+'</span></div>'+piles(s)+'<div class="stage">'+stage(s)+'</div></div>'+
        (s.phase==='select'&&!s.spectator&&!s.mine?hand(s):'')+'</section><aside><div class="sidepanel"><h3>플레이어 / 벌점</h3>'+playerList(s)+'</div><div class="sidepanel"><h3>최근 배치</h3><div class="log">'+(logs.length?logs.map(e=>'<p>'+esc(e.text)+'</p>').join(''):'아직 배치한 바위가 없습니다.')+'</div></div></aside></div>';
    }
    $('#board').innerHTML=content;
    if(busy)$('#board').querySelectorAll('button,select').forEach(b=>{b.disabled=true;});
  }
  async function act(action,details={}) {
    if(busy||!state||(state.spectator && !(action==='leave' && state.queuePosition)))return;
    if(action==='home'){toEntry();say('');return;}
    const extra={...selected,...details};busy=true;clearTimeout(timer);render();say('');
    try {
      const data=await request(action,extra);
      if(data.left){write(localKey(code),'');if(read(recentKey)===code)write(recentKey,'');toEntry();return;}
      accept(data);
    } catch(e){say(e.status?e.message:'연결이 끊겼습니다. 게임 상태를 다시 확인합니다.');}
    finally {busy=false;render();schedule(200);}
  }
  $('#board').addEventListener('change',e=>{
    if(e.target.id==='lobbyCapacity')act('resize',{capacity:Number(e.target.value)});
  });
  $('#board').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||b.disabled||busy)return;
    if(b.dataset.action){act(b.dataset.action);return;}
    if(b.dataset.value!==undefined)selected.value=Number(b.dataset.value);
    if(b.dataset.color)selected.color=b.dataset.color;
    if(b.dataset.target)selected.target=b.dataset.target;
    render();
  });
  const roomChat=HeavyChat.mount($('#chatDock'),{
    label:'방 채팅',readThrough:key=>read('heavy13.chatRead.'+key),
    markRead:(key,seq)=>write('heavy13.chatRead.'+key,String(seq)),
    send:async message=>{
      const activeCode=code, data=await request('chat',message);
      if(activeCode===code && state && !state.spectator)accept(data);
    }
  });
  $('#entryForm').addEventListener('submit',e=>{
    e.preventDefault();const join=$('#create').hidden||e.submitter?.id==='join'||(!e.submitter&&$('#roomCode').value);
    enter(join?'join':'create',join?$('#roomCode').value.trim().toUpperCase():makeCode());
  });
  $('#roomCode').addEventListener('input',e=>{e.target.value=e.target.value.trim().toUpperCase();});
  $('#resume').onclick=()=>enter('read',read(recentKey));
  async function copyInvite(){
    const link=new URL(location.pathname,location.origin);link.searchParams.set('room',code);
    try{await navigator.clipboard.writeText(link.href);say('초대 링크를 복사했습니다. 친구에게 보내세요.');}
    catch{say('초대 링크 '+link.href);}
  }
  $('#copy').onclick=copyInvite;
  $('#rulesOpen').onclick=()=>$('#help').showModal();$('#closeHelp').onclick=()=>$('#help').close();
  document.addEventListener('visibilitychange',()=>schedule(0));window.addEventListener('online',()=>schedule(0));
  $('#nickname').value=read('heavy13.nickname')||'';$('#resume').hidden=!read(recentKey);
  const query=new URLSearchParams(location.search);
  if(query.get('mode')==='ai'){
    const watch=AIWatch.create(accept);
    $('#aiWatchTools').hidden=false;
    function watchControls(){
      const ended=state?.phase==='finished';
      $('#pauseWatch').hidden=ended;$('#pauseWatch').textContent=watch.paused()?'계속 보기':'일시정지';
      $('#stepWatch').hidden=ended || !watch.paused();$('#againWatch').hidden=!ended;
    }
    $('#pauseWatch').onclick=()=>{watch.toggle();watchControls();};
    $('#stepWatch').onclick=()=>{watch.step();watchControls();};
    $('#againWatch').onclick=()=>{watch.restart();watchControls();};
    watch.start(watchControls);
  }else if(validCode.test(inviteCode)){
    $('#roomCode').value=inviteCode;
    $('#join').textContent='초대받은 방에 입장';$('#create').hidden=true;$('#roomSize').hidden=true;$('#join').className='primary';
    history.replaceState(null,'','?room='+inviteCode);
    enter('join',inviteCode);
  }
})();
