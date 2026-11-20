const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../engine.js');

function withSeed(seed, fn) {
  const original = Math.random;
  Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  try { return fn(); } finally { Math.random = original; }
}

test('all personas choose green 1 when every other legal submission crosses 13', () => {
  const game = G.createMatch(['A','B','C','D','E','F','G'], 0);
  const bot = game.players[6];
  game.piles = {red:[5,3,3], green:[3,2,0,1,0,4], blue:[4,0,4,1,3]};
  bot.hand = [1,3,6];
  bot.chips = {red:0, green:1, blue:2, rainbow:0};
  for (let rosterId = 1; rosterId <= G.aiNames.length; rosterId++) {
    bot.rosterId = rosterId;
    assert.deepEqual(withSeed(426, () => G.choose(game,6,{samples:8})), {id:6,value:1,color:'green'});
  }
});

test('helpful personas protect a safe rainbow placement even when another seat may take a large pile', () => {
  const game = G.createMatch(['A','B','C'], 0);
  game.piles = {blue:[5,6], red:[0,0,1,1,1,1,1,1,1], green:[0,0,1,1,1,1,1,1,1]};
  game.queue = [{id:0,color:'rainbow',value:2},{id:1,color:'red',value:4},{id:2,color:'green',value:4}];
  for (const rosterId of [9,10]) {
    game.players[0].rosterId = rosterId;
    const action = withSeed(1, () => G.botAction(game));
    assert.equal(action.pass,false);
    assert.ok(['red','green'].includes(action.color));
  }
});

test('bluffing cannot defer a safe card when a later card could make it bust', () => {
  const game = G.createMatch(['A','B'],0);
  game.players[0].rosterId = 1;
  game.piles.red = [5,4];
  game.queue = [{id:0,color:'red',value:3},{id:1,color:'red',value:2}];
  for (let seed = 0; seed < 12; seed++) {
    assert.equal(withSeed(seed, () => G.botAction(game)).pass,false);
  }
});

test('a forced rainbow on its return takes the smallest available penalty, counting zero stones', () => {
  const game = G.createMatch(['A','B'],0);
  game.piles = {blue:[1,0,0,4,6],red:[5,6],green:[4,4,4]};
  game.queue = [{id:0,color:'rainbow',value:2,deferred:true}];
  for (let rosterId = 1; rosterId <= G.aiNames.length; rosterId++) {
    game.players[0].rosterId = rosterId;
    assert.deepEqual(G.botAction(game),{pass:false,color:'red'});
  }
});
