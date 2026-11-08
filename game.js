'use strict';
const ELEMENTS = Object.freeze({
  fire: { name: 'Огонь', symbol: '🔥', beats: 'earth' },
  water: { name: 'Вода', symbol: '💧', beats: 'fire' },
  earth: { name: 'Земля', symbol: '🌿', beats: 'water' }
});
// 1 — победа игрока, -1 — победа компьютера, 0 — ничья.
function compareCards(player, computer) {
  if (player.element === computer.element) return Math.sign(player.power - computer.power);
  return ELEMENTS[player.element].beats === computer.element ? 1 : -1;
}
function createHand(random = Math.random) {
  const elements = Object.keys(ELEMENTS);
  return Array.from({ length: 5 }, () => ({ element: elements[Math.floor(random() * 3)], power: Math.floor(random() * 5) + 1 }));
}
const ui = Object.fromEntries(['player-score','computer-score','round','computer-hand','player-hand','player-play','computer-play','result','explanation','cards-left','new-game'].map(id => [id, document.getElementById(id)]));
let state;
let nextRoundTimer;
function makeCard(card, interactive = false) {
  const element = ELEMENTS[card.element];
  const node = document.createElement(interactive ? 'button' : 'div');
  node.className = `card ${card.element}`;
  node.setAttribute('aria-label', `${element.name}, сила ${card.power}`);
  if (interactive) node.type = 'button';
  for (const [className, value] of [['power',card.power],['symbol',element.symbol],['name',element.name]]) {
    const part = document.createElement('span');
    part.className = className;
    part.textContent = value;
    part.setAttribute('aria-hidden','true');
    node.append(part);
  }
  return node;
}
function renderHands() {
  ui['player-hand'].replaceChildren();
  state.player.forEach((card,index) => {
    const button = makeCard(card,true);
    button.disabled = state.busy || state.rounds === 5;
    button.addEventListener('click',() => playCard(index));
    ui['player-hand'].append(button);
  });
  ui['computer-hand'].replaceChildren();
  for (let i = 0; i < state.computer.length; i++) {
    const back = document.createElement('span');
    back.className = 'back'; back.textContent = '✧'; back.setAttribute('aria-hidden','true');
    ui['computer-hand'].append(back);
  }
  ui['computer-hand'].setAttribute('aria-label',`У компьютера карт: ${state.computer.length}`);
  ui['cards-left'].textContent = `Осталось: ${state.player.length}`;
  ui['player-score'].textContent = state.playerScore;
  ui['computer-score'].textContent = state.computerScore;
  ui.round.textContent = state.rounds === 5 ? 'Игра завершена' : `Раунд ${state.rounds + 1} из 5`;
}
function playCard(index) {
  if (state.busy || state.rounds >= 5 || !Number.isInteger(index) || !state.player[index]) return;
  state.busy = true;
  const player = state.player.splice(index,1)[0];
  const computer = state.computer.splice(Math.floor(Math.random() * state.computer.length),1)[0];
  const outcome = compareCards(player,computer);
  if (outcome > 0) state.playerScore++;
  if (outcome < 0) state.computerScore++;
  state.rounds++;
  ui['player-play'].replaceChildren(makeCard(player));
  ui['computer-play'].replaceChildren(makeCard(computer));
  const roundResult = outcome > 0 ? 'Вы выиграли раунд' : outcome < 0 ? 'Хранитель выиграл раунд' : 'Ничья в раунде';
  const reason = player.element === computer.element
    ? player.power === computer.power ? 'Стихии и сила совпали.' : `Одинаковые стихии: ${Math.max(player.power,computer.power)} сильнее ${Math.min(player.power,computer.power)}.`
    : `${ELEMENTS[outcome > 0 ? player.element : computer.element].name} побеждает стихию «${ELEMENTS[outcome > 0 ? computer.element : player.element].name}».`;
  renderHands();
  ui.round.textContent = `Раунд ${state.rounds} из 5`;
  if (state.rounds === 5) {
    state.busy = false;
    ui.round.textContent = '5 раундов сыграно';
    ui.result.textContent = state.playerScore > state.computerScore ? 'Победа! Стихии на вашей стороне' : state.playerScore < state.computerScore ? 'Победил хранитель стихий' : 'Равновесие! Ничья';
    ui.explanation.textContent = `${state.playerScore} : ${state.computerScore}. ${roundResult}. ${reason} Сыграйте ещё раз!`;
    return;
  }
  ui.result.textContent = roundResult;
  ui.explanation.textContent = reason;
  nextRoundTimer = setTimeout(() => {
    state.busy = false;
    renderHands();
    ui.explanation.textContent = `${reason} Выберите следующую карту.`;
  },1100);
}
function newGame() {
  clearTimeout(nextRoundTimer);
  state = { player:createHand(), computer:createHand(), playerScore:0, computerScore:0, rounds:0, busy:false };
  for (const [id,label] of [['player-play','Ваша карта'],['computer-play','Карта хранителя']]) {
    const placeholder = document.createElement('span'); placeholder.textContent = label;
    ui[id].replaceChildren(placeholder);
  }
  ui.result.textContent = 'Выберите свою стихию';
  ui.explanation.textContent = 'Коснитесь карты, чтобы начать дуэль.';
  renderHands();
}
ui['new-game'].addEventListener('click',newGame);
newGame();
