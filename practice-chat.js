window.PracticeChat = {
  history(game) {
    if(!game.practiceChat)game.practiceChat={id:crypto.randomUUID(),messages:[],read:0,replies:0};
    return game.practiceChat;
  },
  add(game, player, text) {
    const chat=this.history(game), messages=chat.messages;
    messages.push({seq:(messages.at(-1)?.seq ?? 0)+1, name:player?.name ?? '나',
      mine:!player, bot:!!player, text, time:Date.now()});
    if(messages.length>80)messages.splice(0,messages.length-80);
  },
  reply(game, text) {
    const chat=this.history(game), opponents=game.players.filter(p=>p.rosterId);
    if(!opponents.length)return;
    const mentioned=opponents.find(p=>text.includes(p.name));
    const player=mentioned ?? opponents[chat.replies % opponents.length];
    const profile=Game.persona(player.rosterId);
    chat.replies++;
    let line=profile.line;
    if(/점수|벌점|몇 점|몇점|몇 등|몇등|순위/.test(text)){
      const best=Math.min(...game.players.map(p=>p.score));
      line='나는 지금 벌점 '+player.score+'점. 현재 최저 벌점은 '+best+'점이야.';
    }else if(/합계|받침대|위험|몇 쌓/.test(text)){
      const totals=Game.colors.map(c=>Game.sum(game.piles[c]));
      line='지금 빨강 '+totals[0]+', 초록 '+totals[1]+', 파랑 '+totals[2]+'. '+profile.line;
    }else if(/패스|넘길/.test(text)){
      line='패스하면 나중에 역순으로 다시 놓아야지. '+profile.line;
    }else if(/라운드|몇 판/.test(text)){
      line='지금 '+game.round+'라운드야. '+profile.line;
    }else if(/안녕|반가|하이|ㅎㅇ/.test(text)){
      line='반가워! '+profile.line;
    }else if(/수고|고생|ㅅㄱ/.test(text)){
      line=game.phase==='finished'?'수고했어! 내 최종 벌점은 '+player.score+'점이야.':'끝까지 가 보자. '+profile.line;
    }else if(/패 보여|카드 뭐|뭐 냈|뭐 냈어|뭐 낼/.test(text)){
      line='공개할 때 보자. '+profile.line;
    }
    this.add(game,null,text);
    this.add(game,player,line);
  },
  afterMove(game, move) {
    if(!move || move.type!=='place' || game.round%2!==1)return;
    const speaker=game.players[move.id], opponents=game.players.filter(p=>p.rosterId);
    if(!speaker?.rosterId || speaker!==opponents[((game.round-1)/2)%opponents.length])return;
    const chat=this.history(game);
    if(chat.lastRound===game.round)return;
    chat.lastRound=game.round;
    const remark=Game.persona(speaker.rosterId).line;
    this.add(game,speaker,move.points?'벌점 '+move.points+'점이라니. '+remark:remark);
  }
};
