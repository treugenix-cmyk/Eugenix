'use strict';
const CHARACTERS = Object.freeze({
  busya: { name: 'Буся', portrait: './busya.jpg', beats: 'kanik' },
  kanik: { name: 'Каник', portrait: './kanik.jpg', beats: 'tanyunya' },
  tanyunya: { name: 'Танюня', portrait: './tanyunya.jpg', beats: 'voya-boya' },
  'voya-boya': { name: 'Воя-Боя', portrait: './voya-boya.jpg', beats: 'busya' }
});
// 1 — победа игрока, -1 — победа компьютера, 0 — ничья.
function compareCards(player, computer) {
  if (CHARACTERS[player.character].beats === computer.character) return 1;
  if (CHARACTERS[computer.character].beats === player.character) return -1;
  return Math.sign(player.power - computer.power);
}
function createHand(random = Math.random) {
  const characters = Object.keys(CHARACTERS);
  return Array.from({ length: 5 }, () => ({ character: characters[Math.floor(random() * characters.length)], power: Math.floor(random() * 5) + 1 }));
}
const ui = Object.fromEntries(['player-score','computer-score','round','computer-hand','player-hand','player-play','computer-play','result','explanation','cards-left','new-game'].map(id => [id, document.getElementById(id)]));
let state;
let nextRoundTimer;
function makeCard(card, interactive = false) {
  const character = CHARACTERS[card.character];
  const node = document.createElement(interactive ? 'button' : 'div');
  node.className = `card ${card.character}`;
  node.setAttribute('aria-label', `${character.name}, сила ${card.power}`);
  if (interactive) node.type = 'button';
  const portrait = document.createElement('img');
  portrait.className = 'portrait';
  // Относительный путь сохраняет префикс проекта на GitHub Pages.
  portrait.src = character.portrait;
  portrait.alt = '';
  portrait.draggable = false;
  node.append(portrait);
  for (const [className, value] of [['power',card.power],['name',character.name]]) {
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
  const hasAdvantage = CHARACTERS[player.character].beats === computer.character
    || CHARACTERS[computer.character].beats === player.character;
  const reason = hasAdvantage
    ? `${CHARACTERS[outcome > 0 ? player.character : computer.character].name} имеет преимущество: сила не учитывается.`
    : player.power === computer.power
      ? 'Преимущества нет, сила равна — ничья.'
      : `Преимущества нет: сила ${Math.max(player.power,computer.power)} побеждает силу ${Math.min(player.power,computer.power)}.`;
  renderHands();
  ui.round.textContent = `Раунд ${state.rounds} из 5`;
  if (state.rounds === 5) {
    state.busy = false;
    ui.round.textContent = '5 раундов сыграно';
    ui.result.textContent = state.playerScore > state.computerScore ? 'Победа! Герои на вашей стороне' : state.playerScore < state.computerScore ? 'Победил хранитель' : 'Равновесие! Ничья';
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
  ui.result.textContent = 'Выберите своего персонажа';
  ui.explanation.textContent = 'Коснитесь карты, чтобы начать дуэль.';
  renderHands();
}
ui['new-game'].addEventListener('click',newGame);
newGame();
