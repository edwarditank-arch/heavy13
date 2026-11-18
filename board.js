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

 return {pedestal};
})();
