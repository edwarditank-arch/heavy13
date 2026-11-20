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
function validateCapacity(capacity) {
  requireThat(Number.isInteger(capacity) && capacity >= 2 && capacity <= 10, '총인원은 방장을 포함해 2~10명으로 정해 주세요.');
}
export function newRoom(name, identity, capacity) {
  if (capacity !== undefined) validateCapacity(capacity);
  return { capacity, seats: [{name: nickname(name), identity}], waiting: [], game: null, pending: {}, closed: false };
}
function fillOpenSeats(room) {
  const available = (room.capacity ?? 10) - room.seats.length;
  if (available > 0 && room.waiting?.length) room.seats.push(...room.waiting.splice(0, available));
}
// Polls renew a spectator lease at most once a minute. A closed tab drops out of the visible roster.
export function activeAudience(room, now = Date.now()) {
  return (room.spectators ?? []).filter(person => now - person.seenAt < 180000).map(person => person.name);
}
function nextChatSeq(room) { return (room.chat?.at(-1)?.seq ?? 0) + 1; }
function admitSpectator(room, person) {
  (room.spectators ??= []).push({...person, chatFrom:person.chatFrom ?? nextChatSeq(room), seenAt:Date.now()});
  appendChat(room, {name:person.name}, person.name+'님이 관전을 시작했습니다.', undefined, 'arrival');
}
function appendChat(room, sender, text, nonce, role) {
  const history = room.chat ??= [];
  const seq = (history.at(-1)?.seq ?? 0) + 1;
  history.push({seq, name: sender.name, author: sender.identity, bot: !!sender.rosterId, role, text, nonce, time: Date.now()});
  if (history.length > 80) history.shift();
}
function sendChat(room, seat, input, role) {
  requireThat(typeof input.nonce === 'string' && /^[a-f0-9]{32}$/.test(input.nonce), '전송 정보를 확인해 주세요.');
  const previous = (room.chat ?? []).findLast(m => m.author === seat.identity);
  if ((room.chat ?? []).some(m => m.author === seat.identity && m.nonce === input.nonce)) return false;
  const text = typeof input.text === 'string' ? input.text.trim().normalize('NFC') : '';
  requireThat(text && text.length <= 200 && !/[\p{Cc}\u202A-\u202E\u2066-\u2069]/u.test(text), '메시지는 한 줄로 1~200자까지 보낼 수 있어요.');
  requireThat(!previous || Date.now() - previous.time >= 750, '잠시 후에 보내 주세요.', 429);
  appendChat(room, seat, text, input.nonce, role);
  return true;
}
export function view(G, room, id, revision, identity) {
  const g = room.game;
  const players = room.seats.map((s, i) => ({
    name: s.name, rosterId: s.rosterId ?? null, score: g?.players[i].score ?? 0, submitted: Object.hasOwn(room.pending, i)
  }));
  const spectator = id === null;
  const watcher = spectator ? room.spectators?.find(person => person.identity === identity) : null;
  const waiter = spectator ? room.waiting?.find(person => person.identity === identity) : null;
  const viewer = spectator ? watcher ?? waiter : room.seats[id];
  const out = { revision, hostId: room.hostId ?? 0, gameRevision: room.gameRevision ?? revision, id, players, spectators:activeAudience(room), capacity: room.capacity ?? null, phase: g?.phase ?? 'lobby' };
  if(spectator)out.spectator=true;
  if(watcher)out.spectatorName=watcher.name;
  if(viewer){
    // Spectators see the conversation from their arrival and keep it when reconnecting.
    const first = spectator ? (viewer.chatFrom ?? nextChatSeq(room)) : 0;
    out.chat=(room.chat ?? []).filter(m=>m.seq>=first).map(({seq,name,author,bot,role,text,time})=>({
      seq,name,bot,role,text,time,mine:author===viewer.identity
    }));
  }
  if (!g) {
    const waiting = room.waiting ?? [];
    out.waiting = waiting.map(person => person.name);
    out.queuePosition = waiting.findIndex(person => person.identity === identity) + 1;
    return out;
  }
  Object.assign(out, {
    round: g.round, leader: g.leader, piles: g.piles,
    events: g.events, previous: g.log.find(l => l.round < g.round)?.events ?? []
  });
  if(!spectator)Object.assign(out,{hand:g.players[id].hand,chips:g.players[id].chips,mine:room.pending[id] ?? null});
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
    const seat = room.seats[G.current(g).id];
    const move = G.botAction(g);
    G.act(g, move.pass, move.color);
    if (!move.pass && g.round % 2 === 1 && g.lastChatterRound !== g.round) {
      const bots = room.seats.filter(s => s.rosterId);
      const speaker = bots[((g.round - 1) / 2) % bots.length];
      if (seat === speaker) {
        appendChat(room, seat, G.persona(seat.rosterId).line);
        g.lastChatterRound = g.round;
      }
    }
  }
}

export function apply(G, room, identity, input, revision) {
  const id = room.seats.findIndex(s => s.identity === identity);
  const g = room.game;
  const action = input.action;
  requireThat(!room.closed, '종료된 방입니다.', 404);
  const queued = room.waiting?.findIndex(s => s.identity === identity) ?? -1;
  const watchers=room.spectators ?? [];
  const watcher=watchers.find(person=>person.identity===identity);
  if (action === 'join' && id<0 && queued<0 && !watcher) {
    if (!input.name) return false;
    const name=nickname(input.name);
    const occupied=[...room.seats.filter(s=>!s.rosterId),...(room.waiting ?? []),...watchers];
    requireThat(!occupied.some(person=>person.name===name), '이 방에서 이미 사용 중인 닉네임입니다.',409);
    const person={name,identity,chatFrom:nextChatSeq(room)};
    if(g)admitSpectator(room,person);
    else {
      (room.waiting ??= []).push(person);
      fillOpenSeats(room);
    }
    return true;
  }
  const member=id>=0 ? room.seats[id] : queued>=0 ? room.waiting[queued] : watcher;
  requireThat(member,'닉네임으로 방에 입장해 주세요.',403);
  if(action==='join' || action==='read' || action==='watch'){
    if(watcher && Date.now()-watcher.seenAt>=60000){watcher.seenAt=Date.now();return true;}
    // Supply the admission boundary for waiters carried over from an earlier version.
    if(queued>=0 && member.chatFrom===undefined){member.chatFrom=nextChatSeq(room);return true;}
    return false;
  }
  if(action==='leave' && id<0){
    if(watcher)watchers.splice(watchers.indexOf(watcher),1);
    else room.waiting.splice(queued,1);
    return true;
  }
  if(action==='chat'){
    if(queued>=0 && member.chatFrom===undefined)member.chatFrom=nextChatSeq(room);
    const sent=sendChat(room,member,input,watcher?'spectator':queued>=0?'waiting':undefined);
    if(watcher && sent)watcher.seenAt=Date.now();
    return sent;
  }
  requireThat(id>=0,'플레이어만 게임을 진행할 수 있습니다.',403);
  // Chat writes advance the storage revision without invalidating game decisions.
  const currentTurn = Number.isInteger(input.revision) && input.revision >= (room.gameRevision ?? revision) && input.revision <= revision;
  if (action === 'leave') {
    requireThat(!g, '게임 중에는 자리를 유지합니다.', 409);
    room.seats.splice(id,1);
    fillOpenSeats(room);
    room.closed = !room.seats.length;
    return true;
  }
  if (action === 'resize') {
    requireThat(id === (room.hostId ?? 0), '방장만 정원을 변경할 수 있습니다.', 403);
    requireThat(!g, '게임 시작 전에만 정원을 변경할 수 있습니다.', 409);
    validateCapacity(input.capacity);
    requireThat(input.capacity >= room.seats.length, '참가 중인 플레이어 수보다 정원을 줄일 수 없습니다.', 409);
    if (input.capacity === room.capacity) return false;
    room.capacity = input.capacity;
    fillOpenSeats(room);
    return true;
  }
  if (action === 'start' || action === 'rematch') {
    requireThat(id === (room.hostId ?? 0), '방장만 시작할 수 있습니다.', 403);
    requireThat(action === 'start' ? !g : g?.phase === 'finished' && currentTurn, '이미 진행 중입니다.', 409);
    const humans = room.seats.filter(seat => !seat.rosterId);
    const size = room.capacity ?? humans.length;
    requireThat(size >= 2, '두 명 이상 모이면 시작할 수 있습니다.');
    room.game = G.createMatch(humans.map(seat => seat.name), size - humans.length);
    const host = room.seats[id];
    const seats = G.shuffle(room.game.players.map((player, index) => ({
      player, seat: humans[index] ?? {name: player.name, rosterId: player.rosterId}
    })));
    room.game.players = seats.map(entry => entry.player);
    room.seats = seats.map(entry => entry.seat);
    room.hostId = room.seats.indexOf(host);
    for(const person of room.waiting ?? [])admitSpectator(room,person);
    room.waiting = [];
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
  requireThat(currentTurn, '다른 플레이어가 먼저 진행했습니다.', 409);
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
