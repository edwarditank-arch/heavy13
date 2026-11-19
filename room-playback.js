// A room update may contain several accepted turns, including the last turn of a round.
const RoomPlayback = (() => {
  function framesBetween(before, after) {
    const frames = [];
    let piles = before.piles, players = before.players;
    function append(round, events, start, moves, leader, previous) {
      if (events.length <= start) return;
      const revealed = events.filter(event => event.type === 'place');
      // A poll can skip the number reveal as well as the end-of-round screen.
      const cards = moves?.length ? moves.map(m => ({
        ...m, value: m.value ?? revealed.find(event => event.id === m.id)?.value
      })) : revealed;
      for (let i=start; i<events.length; i++) {
        const event = events[i];
        const view = {round, moves:cards, phase:'resolve', turn:event, leader,
          id:after.id, spectator:after.spectator, piles, players, events:events.slice(0,i), previous};
        if (event.type === 'place') {
          const stack = event.points ? [] : piles[event.color];
          piles = {...piles, [event.color]:[...stack,event.value]};
          if (event.points) players = players.map((p,id) => id === event.id ? {...p,score:p.score+event.points} : p);
        }
        frames.push({event, before:view, landed:{...view,piles,players,events:events.slice(0,i+1)}});
      }
    }
    if (before.round === after.round) {
      append(after.round,after.events,before.events.length,after.moves,before.leader,after.previous);
    } else if (after.round === before.round+1) {
      append(before.round,after.previous,before.events.length,before.moves,before.leader,before.previous);
      append(after.round,after.events,0,after.moves,after.leader,after.previous);
    }
    return frames;
  }

  function create(draw, restore) {
    const queue = [];
    let running = null;
    function cancel() {
      queue.length = 0;
      const run = running;
      running = null;
      if (!run) return;
      for (const animation of run.animations) animation.cancel();
      for (const node of run.floating) node.remove();
    }
    async function play(run) {
      try {
        while (running === run && queue.length) {
          const frame = queue.shift(), event = frame.event;
          const short = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          const duration = queue.length > 2 ? 360 : 640;
          draw(frame.before,event,false);
          if (event.type === 'pass') {
            const card = document.querySelector('.move.active');
            await HeavyBoard.motion(run,card,[{opacity:1},{opacity:.5}],short ? 80 : 230);
            continue;
          }
          await HeavyBoard.flyStone(run,event,short,duration);
          if (running !== run) break;
          draw(frame.landed,event,true);
          const pile = document.querySelector('.pile.receiving');
          const landing = short ? [{opacity:.8},{opacity:1}] : [
            {transform:'scale(1)'},{transform:'scale(1.035)',offset:.4},{transform:'scale(1)'}
          ];
          await HeavyBoard.motion(run,pile,landing,short ? 80 : 180);
        }
      } finally {
        if (running === run) { cancel(); restore(); }
      }
    }
    function update(before,after,skip) {
      if (skip || after.aiTable || !before?.piles || !after.piles || before.phase === 'finished'
          || after.round < before.round || after.round > before.round+1) {
        cancel();
        return;
      }
      queue.push(...framesBetween(before,after));
      if (!running && queue.length) {
        running = {animations:new Set(),floating:new Set()};
        play(running).catch(error => console.error('Room placement animation',error));
      }
    }
    return {update,cancel,active:()=>!!running};
  }
  return {create};
})();
