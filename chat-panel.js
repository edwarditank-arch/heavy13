// The same dock is used for a browser-local practice match and a network room.
window.HeavyChat = {
  mount(dock, {label, readThrough, markRead, send}) {
    dock.innerHTML = `<section class="chatPanel" id="roomChat" hidden aria-labelledby="chatTitle">
          <div class="chatHead"><div><h2 id="chatTitle">방 채팅</h2><small id="chatRoomName"></small></div>
            <button type="button" id="chatClose" aria-label="방 채팅 닫기">닫기</button></div>
          <div id="chatLog" role="log" aria-label="방 대화" aria-live="polite" aria-relevant="additions"></div>
          <p id="chatEmpty">첫 메시지를 남겨 보세요.</p>
          <form id="chatForm"><label class="chatSr" for="chatInput">채팅 메시지</label>
            <input id="chatInput" maxlength="200" autocomplete="off" placeholder="메시지 쓰기…" required>
            <button class="primary" id="chatSend" type="submit" disabled>보내기</button></form>
          <div id="chatError" role="status"></div>
        </section>
        <button class="chatToggle" id="chatToggle" type="button" aria-controls="roomChat" aria-expanded="false">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4.5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5.5 3v-3H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"/><path d="M7 9h10m-10 4h6"/></svg>
          <span id="chatToggleText">방 채팅</span> <span id="chatUnread" hidden></span>
        </button>`;
    const find = id => dock.querySelector('#'+id);
    const panel=find('roomChat'), log=find('chatLog'), input=find('chatInput');
    const toggle=find('chatToggle'), submit=find('chatSend'), error=find('chatError');
    const clock=new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit'});
    find('chatTitle').textContent=label;
    find('chatToggleText').textContent=label;
    find('chatClose').setAttribute('aria-label',label+' 닫기');
    log.setAttribute('aria-label',label+' 대화');
    let scope=null, messages=[], seen=0, last=0, pending=null, busy=false, epoch=0;
    function element(tag, cls, text){
      const el=document.createElement(tag);el.className=cls;el.textContent=text;return el;
    }
    function add(m){
      const row=element('div','chatMessage'+(m.mine?' mine':''),'');
      row.dataset.seq=m.seq;
      if(m.role==='arrival'){
        row.classList.add('chatArrival');row.textContent=m.text;log.append(row);return;
      }
      const meta=element('div','chatMeta','');
      meta.append(element('strong','',m.name));
      const trait=Game.persona(Game.aiNames.indexOf(m.name)+1)?.trait;
      if(trait)meta.append(element('span','traitBadge',trait));
      if(m.role==='spectator' || m.role==='waiting')meta.append(element('small','audienceRole',m.role==='spectator'?'관전':'대기'));
      if(m.bot)meta.append(element('small','chatAi','AI'));
      if(m.mine && m.name!=='나')meta.append(element('small','','나'));
      meta.append(element('time','',clock.format(m.time)));
      row.append(meta,element('p','chatBubble',m.text));log.append(row);
    }
    function updateUnread(){
      if(!panel.hidden && last>seen){seen=last;markRead(scope,last);}
      const unread=messages.filter(m=>m.seq>seen && !m.mine).length;
      const badge=find('chatUnread');badge.hidden=!unread;badge.textContent=String(unread);
      toggle.setAttribute('aria-label',unread?label+', 안 읽은 메시지 '+unread+'개':label);
    }
    function reset(){
      epoch++; scope=null;messages=[];seen=last=0;pending=null;busy=false;
      panel.hidden=true;toggle.setAttribute('aria-expanded','false');
      log.replaceChildren();input.value='';error.textContent='';submit.disabled=true;dock.hidden=true;
    }
    function show(key,subtitle,history){
      if(scope!==key){reset();scope=key;seen=Number(readThrough(key))||0;}
      dock.hidden=false;find('chatRoomName').textContent=subtitle;messages=history;
      const tail=messages.at(-1)?.seq ?? 0;
      if(tail!==last){
        const follow=log.scrollHeight-log.clientHeight-log.scrollTop<36;
        for(const m of messages)if(m.seq>last)add(m);
        while(log.firstChild && Number(log.firstChild.dataset.seq)<messages[0]?.seq)log.firstChild.remove();
        last=tail;if(follow || messages.at(-1)?.mine)log.scrollTop=log.scrollHeight;
      }
      find('chatEmpty').hidden=messages.length!==0;updateUnread();
    }
    function open(value){
      panel.hidden=!value;toggle.setAttribute('aria-expanded',String(value));
      if(value){
        updateUnread();log.scrollTop=log.scrollHeight;
        if(matchMedia('(pointer:fine)').matches)input.focus({preventScroll:true});
      }else toggle.focus({preventScroll:true});
    }
    toggle.onclick=()=>open(panel.hidden);
    find('chatClose').onclick=()=>open(false);
    panel.onkeydown=event=>{if(event.key==='Escape' && !event.isComposing)open(false);};
    input.oninput=()=>{submit.disabled=busy || !input.value.trim();};
    input.onkeydown=event=>{if(event.key==='Enter' && (event.isComposing || event.keyCode===229))event.preventDefault();};
    find('chatForm').onsubmit=async event=>{
      event.preventDefault();
      const text=input.value.trim(), ticket=epoch;
      if(!text || busy || scope===null)return;
      if(!pending || pending.text!==text)pending={text,nonce:crypto.randomUUID().replaceAll('-','')};
      busy=true;submit.disabled=true;error.textContent='';
      try{
        await send(pending);
        if(ticket!==epoch)return;
        pending=null;if(input.value.trim()===text)input.value='';
      }catch(err){
        if(ticket===epoch)error.textContent=err.status?err.message:'연결을 확인하고 다시 보내 주세요.';
      }finally{
        if(ticket===epoch){busy=false;submit.disabled=!input.value.trim();}
      }
    };
    reset();
    return {show,reset};
  }
};
