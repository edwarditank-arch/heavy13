// Shared by the practice table and multiplayer rooms.
const HeavyBoard = (() => {
 const labels = {red:'빨강', green:'초록', blue:'파랑'};

 function pedestal(color, stones, receiving = false, penalty = false) {
  const sum = stones.reduce((total, stone) => total + stone, 0);
  const blocks = stones.map(value => `<span class="stone">${value}</span>`).join('');
  return `<section class="pile ${color}${receiving ? ' receiving' : ''}${penalty ? ' penaltyHit' : ''}" data-pile="${color}" aria-label="${labels[color]} 받침대">
   <div class="pileName"><i aria-hidden="true"></i>${labels[color]} 받침대</div>
   <div class="pileScore" aria-label="합계 ${sum}, 한계 13">${sum}<small> / 13</small></div>
   <div class="monument">
    <div class="stones" aria-label="쌓인 바위">${blocks}</div>
    <div class="atlasRelief" aria-hidden="true"></div>
   </div>
   <div class="track" aria-hidden="true"><span style="width:${sum / 13 * 100}%"></span></div>
   <div class="pileFoot"><span>바위 <b>${stones.length}</b>개</span><span>붕괴 시 <b>+${stones.length}</b>점</span></div>
  </section>`;
 }

 async function motion(run, element, frames, duration) {
  if (!element?.animate) return;
  let animation;
  try {
   animation = element.animate(frames, {duration, easing:'ease-in-out', fill:'forwards'});
   run.animations.add(animation);
   await animation.finished;
  } catch { /* A removed or cancelled effect has no bearing on game state. */ }
  finally {
   if (animation) { run.animations.delete(animation); animation.cancel(); }
  }
 }

 async function flyStone(run, move, short, duration = 680) {
  const source = document.querySelector('.move[data-player="'+move.id+'"] strong');
  const stones = document.querySelector('.pile[data-pile="'+move.color+'"] .stones');
  if (!source || !stones) return;
  const slot = document.createElement('span');
  slot.className = 'stone arrivalSlot';
  slot.textContent = move.value;
  slot.setAttribute('aria-hidden','true');
  stones.appendChild(slot);
  run.floating.add(slot);
  const stone = document.createElement('div');
  try {
   const from = source.getBoundingClientRect();
   const to = (move.points ? stones.querySelector('.stone') : slot).getBoundingClientRect();
   const x = from.left + from.width/2 - 20, y = from.top + from.height/2 - 20;
   const dx = to.left + to.width/2 - 20 - x, dy = to.top + to.height/2 - 20 - y;
   stone.className = 'flyingStone '+move.color;
   stone.textContent = move.value;
   stone.setAttribute('aria-hidden','true');
   stone.style.left = (short ? x+dx : x)+'px';
   stone.style.top = (short ? y+dy : y)+'px';
   document.body.appendChild(stone);
   run.floating.add(stone);
   await motion(run,stone,short ? [{opacity:0},{opacity:1}] : [
    {transform:'translate(0,0) scale(1)'},
    {transform:'translate('+dx*.5+'px,'+(dy*.5-65)+'px) scale(1.25)',offset:.5},
    {transform:'translate('+dx+'px,'+dy+'px) scale(.65)'}
   ],short ? 100 : duration);
  } finally {
   for (const node of [stone,slot]) { node.remove(); run.floating.delete(node); }
  }
 }

 return {pedestal, motion, flyStone};
})();
