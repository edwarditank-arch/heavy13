const colors = ['red', 'green', 'blue'];
export class RoomError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function requireThat(condition, message, status) {
  if (!condition) throw new RoomError(message, status);
}
export function nickname(value) {
  const name = typeof value === 'string' ? value.trim().normalize('NFC') : '';
  requireThat(name.length > 0 && [...name].length <= 16 && !/[\p{C}<>]/u.test(name), '닉네임은 1~16자로 입력해 주세요.');
  return name;
}
export function newRoom(name, identity, capacity) {
  if (capacity !== undefined) {
    requireThat(Number.isInteger(capacity) && capacity >= 2 && capacity <= 10, '총인원은 방장을 포함해 2~10명으로 정해 주세요.');
  }
  return { capacity, seats: [{name: nickname(name), identity}], game: null, pending: {}, closed: false };
}
export function view(G, room, id, revision) {
  const g = room.game;
  const players = room.seats.map((s, i) => ({
    name: s.name, rosterId: s.rosterId ?? null, score: g?.players[i].score ?? 0, submitted: Object.hasOwn(room.pending, i)
  }));
  const out = { revision, id, players, capacity: room.capacity ?? null, phase: g?.phase ?? 'lobby' };
  if (!g) return out;
  const me = g.players[id];
  Object.assign(out, {
    round: g.round, leader: g.leader, piles: g.piles, hand: me.hand, chips: me.chips,
    mine: room.pending[id] ?? null, events: g.events, previous: g.log.find(l => l.round < g.round)?.events ?? []
  });
  if (g.phase !== 'select') {
    const moves = g.phase === 'chips' ? g.moves : G.order(g.moves, g.roundLeader, players.length);
    out.moves = moves.map(m => g.phase === 'chips' ? {id: m.id, color: m.color} : m);
  }
  if (g.phase === 'resolve') out.turn = G.current(g);
  if (g.phase === 'finished') out.ranking = G.ranking(g).map(p => ({id:p.id, score:p.score, last:p.last}));
  return out;
}
function submitBots(G, room) {
  for (const [id, seat] of room.seats.entries()) {
    if (seat.rosterId) room.pending[id] = G.choose(room.game, id, {samples:8});
  }
}

function playBotTurns(G, room) {
  const g = room.game;
  while (g.phase === 'resolve' && room.seats[G.current(g).id].rosterId) {
    const move = G.botAction(g);
    G.act(g, move.pass, move.color);
  }
}

export function apply(G, room, identity, input, revision) {
  const id = room.seats.findIndex(s => s.identity === identity);
  const g = room.game;
  const action = input.action;
  requireThat(!room.closed, '종료된 방입니다.', 404);
  if (action === 'join') {
    if (id >= 0) return false;
    requireThat(!g, '이미 게임이 시작된 방입니다.', 409);
    requireThat(room.seats.length < (room.capacity ?? 10), '방이 가득 찼습니다.', 409);
    const name = nickname(input.name);
    requireThat(!room.seats.some(s => s.name === name), '이 방에서 이미 사용 중인 닉네임입니다.', 409);
    room.seats.push({name, identity});
    return true;
  }
  requireThat(id >= 0, '이 브라우저로 방에 다시 입장해 주세요.', 403);
  if (action === 'read') return false;
  if (action === 'leave') {
    requireThat(!g, '게임 중에는 자리를 유지합니다.', 409);
    room.seats.splice(id,1);
    room.closed = !room.seats.length;
    return true;
  }
  if (action === 'start' || action === 'rematch') {
    requireThat(id === 0, '방장만 시작할 수 있습니다.', 403);
    requireThat(action === 'start' ? !g : g?.phase === 'finished' && input.revision === revision, '이미 진행 중입니다.', 409);
    const humans = room.seats.filter(seat => !seat.rosterId);
    const size = room.capacity ?? humans.length;
    requireThat(size >= 2, '두 명 이상 모이면 시작할 수 있습니다.');
    room.game = G.createMatch(humans.map(seat => seat.name), size - humans.length);
    const bots = room.game.players.slice(humans.length).map(({name, rosterId}) => ({name, rosterId}));
    room.seats = humans.concat(bots);
    room.pending = {};
    submitBots(G, room);
    return true;
  }
  requireThat(g && input.round === g.round && input.phase === g.phase, '게임이 진행됐습니다. 현재 화면을 확인해 주세요.', 409);
  if (action === 'submit') {
    requireThat(g.phase === 'select', '제출 시간이 지났습니다.', 409);
    const p = g.players[id];
    requireThat(Number.isInteger(input.value) && p.hand.includes(input.value) &&
      [...colors,'rainbow'].includes(input.color) && p.chips[input.color] > 0, '보유한 카드와 칩을 선택해 주세요.');
    const old = room.pending[id];
    if (old) {
      requireThat(old.value === input.value && old.color === input.color, '이미 선택을 확정했습니다.', 409);
      return false;
    }
    room.pending[id] = {id, value: input.value, color: input.color};
    if (Object.keys(room.pending).length === room.seats.length) {
      g.roundLeader = g.leader;
      G.submit(g, room.seats.map((_,i) => room.pending[i]));
      room.pending = {};
    }
    return true;
  }
  requireThat(input.revision === revision, '다른 플레이어가 먼저 진행했습니다.', 409);
  if (action === 'advance') {
    requireThat(['chips','cards','roundEnd'].includes(g.phase), '현재 진행할 수 없습니다.', 409);
    if (g.phase === 'roundEnd') {
      G.next(g);
      submitBots(G, room);
    } else G.reveal(g);
  } else if (action === 'place' || action === 'pass') {
    requireThat(g.phase === 'resolve' && G.current(g).id === id, '내 차례에 배치할 수 있습니다.', 403);
    const turn = G.current(g);
    requireThat(action !== 'pass' || !turn.deferred, '이번에는 반드시 배치해야 합니다.');
    requireThat(action !== 'place' || turn.color !== 'rainbow' || colors.includes(input.target), '받침대를 골라 주세요.');
    G.act(g,action === 'pass',input.target);
  } else throw new RoomError('알 수 없는 요청입니다.');
  playBotTurns(G, room);
  return true;
}