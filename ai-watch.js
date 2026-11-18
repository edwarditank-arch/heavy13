// A local AI exhibition has its own game and clock. Each tick reveals one public step.
window.AIWatch={
  create(publish){
    const key='heavy13.ai-exhibition.v1', G=Game;
    let game,paused=false,timer,revision=0,afterRender=()=>{};
    try {
      const saved=JSON.parse(sessionStorage.getItem(key));
      if(saved?.game?.version===1 && saved.game.players?.length===7 && saved.game.players.every(p=>G.persona(p.rosterId))){
        game=saved.game;paused=!!saved.paused;
      }
    }catch{}
    function fresh(){game=G.createMatch([],7);paused=false;}
    if(!game)fresh();
    function emit(){
      try{sessionStorage.setItem(key,JSON.stringify({game,paused}));}catch{}
      const g=game;
      const s={spectator:true,aiTable:true,id:null,revision:++revision,round:g.round,phase:g.phase,
        players:g.players.map(p=>({name:p.name,rosterId:p.rosterId,score:p.score})),piles:g.piles,leader:g.leader,
        events:g.events,previous:g.log.find(l=>l.round<g.round)?.events ?? []};
      if(g.phase!=='select'){
        s.moves=g.phase==='chips'?g.moves.map(({id,color})=>({id,color})):G.order(g.moves,g.roundLeader,g.players.length);
      }
      if(g.phase==='resolve')s.turn=G.current(g);
      if(g.phase==='finished')s.ranking=G.ranking(g).map(({id,score,last})=>({id,score,last}));
      publish(s);afterRender();
    }
    function schedule(){
      clearTimeout(timer);
      if(!document.hidden && !paused && !document.querySelector('dialog[open]') && game.phase!=='finished')
        timer=setTimeout(()=>{if(!document.hidden && !document.querySelector('dialog[open]'))step();},game.phase==='resolve'?1400:2100);
    }
    function step(){
      const g=game;
      if(g.phase==='select'){
        g.roundLeader=g.leader;
        G.submit(g,g.players.map((_,id)=>G.choose(g,id,{samples:8})));
      }else if(g.phase==='chips' || g.phase==='cards')G.reveal(g);
      else if(g.phase==='resolve'){
        const move=G.botAction(g);G.act(g,move.pass,move.color);
      }else if(g.phase==='roundEnd')G.next(g);
      emit();schedule();
    }
    return {
      start(callback){
        afterRender=callback;emit();schedule();
        document.addEventListener('visibilitychange',schedule);
        document.querySelector('#help')?.addEventListener('close',schedule);
      },
      paused:()=>paused,
      step,
      toggle(){paused=!paused;emit();schedule();},
      restart(){fresh();emit();schedule();}
    };
  }
};
