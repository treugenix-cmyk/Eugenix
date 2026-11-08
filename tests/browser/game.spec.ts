import { test, expect, type Page } from "@playwright/test";
async function disableAnimations(page: Page) {
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page.getByLabel("Анимации", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
}
async function imageCheck(page: Page) {
  const images = page.locator("img");
  await images.evaluateAll((nodes) =>
    Promise.all(nodes.map((n) => (n as HTMLImageElement).decode())),
  );
  expect(
    await images.evaluateAll((nodes) =>
      nodes.every((n) => (n as HTMLImageElement).naturalWidth > 0),
    ),
  ).toBe(true);
}
test("мобильная партия с четырьмя ботами от меню до победы", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await disableAnimations(page);
  await page.getByLabel("Всего игроков").selectOption("5");
  await page
    .getByRole("combobox", { name: "Боты", exact: true })
    .selectOption("hard");
  await page.getByRole("button", { name: "Играть", exact: false }).click();
  await imageCheck(page);
  for (let actions = 0; actions < 700; actions++) {
    if (
      await page.getByRole("dialog", { name: /победитель|перемирие/ }).count()
    )
      break;
    const defend = page.getByRole("button", { name: "Мама, спаси! 🥗" });
    const insert = page.getByRole("button", { name: "Под низ", exact: true });
    const draw = page.getByRole("button", {
      name: "Взять карту и завершить ход",
    });
    if (await defend.isVisible()) await defend.click();
    else if (await insert.isVisible()) await insert.click();
    else if (await draw.isEnabled()) await draw.click();
    else await page.waitForTimeout(60);
  }
  await expect(
    page.getByRole("dialog", { name: /победитель|перемирие/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/mobile-winner.png",
    fullPage: true,
  });
});
test("локальная передача скрывает руку и восстановление защищает текущий выбор", async ({
  page,
}) => {
  await page.goto("/");
  await disableAnimations(page);
  await page.getByLabel("С кем играем?").selectOption("local");
  await page.getByRole("button", { name: "Играть", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "Передайте устройство" }),
  ).toBeVisible();
  expect(await page.locator(".hand .playing-card").count()).toBe(0);
  await page.getByRole("button", { name: "Я готов — показать карты" }).click();
  expect(await page.locator(".hand .playing-card").count()).toBe(5);
  await imageCheck(page);
  await page.screenshot({
    path: "test-results/mobile-table.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: "Продолжить партию" }).click();
  await expect(
    page.getByRole("heading", { name: "Передайте устройство" }),
  ).toBeVisible();
  expect(await page.locator(".hand .playing-card").count()).toBe(0);
  await page.getByRole("button", { name: "Я готов — показать карты" }).click();
  await page
    .getByRole("button", { name: "Взять карту и завершить ход" })
    .click();
  if (await page.getByRole("button", { name: "Мама, спаси! 🥗" }).isVisible()) {
    await page.getByRole("button", { name: "Мама, спаси! 🥗" }).click();
    await page.getByRole("button", { name: "Под низ", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Передайте устройство" }),
  ).toBeVisible();
  expect(await page.locator(".hand .playing-card").count()).toBe(0);
});
test("нет переполнения на телефоне, планшете и компьютере; правила доступны", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await imageCheck(page);
  await page.screenshot({
    path: "test-results/mobile-home.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Правила", exact: true }).click();
  await expect(
    page.getByText("Если колода пуста при попытке взять карту", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
});
// Валидная тестовая раздача: переставляем существующие экземпляры без добавления карт.
async function prepare(page: Page, hand: string[], dangerFirst = false) {
  await page.goto("/");
  await page.evaluate(
    async ({ hand, dangerFirst }) => {
      const engine = await import("/src/game-engine/index.ts");
      const { useGameStore } = await import("/src/storage/store.ts");
      const s = engine.newGame({
        mode: "local",
        players: 3,
        difficulty: "medium",
      });
      for (let slot = 0; slot < hand.length; slot++) {
        const collections = [
          s.players[0].hand,
          ...s.players.slice(1).map((p: { hand: unknown[] }) => p.hand),
          s.deck,
        ];
        let found = false;
        for (const collection of collections) {
          const index = collection.findIndex(
            (c: { type: string }, i: number) =>
              c.type === hand[slot] &&
              (collection !== s.players[0].hand || i >= slot),
          );
          if (index >= 0) {
            [s.players[0].hand[slot], collection[index]] = [
              collection[index],
              s.players[0].hand[slot],
            ];
            found = true;
            break;
          }
        }
        if (!found) throw new Error("Не найден тестовый экземпляр");
      }
      if (dangerFirst) {
        const index = s.deck.findIndex(
          (c: { type: string }) => c.type === "danger",
        );
        [s.deck[0], s.deck[index]] = [s.deck[index], s.deck[0]];
      }
      useGameStore.setState({
        game: s,
        screen: "game",
        revealed: `${s.id}:${s.turn}`,
        settings: { animations: false, sound: false },
      });
    },
    { hand, dangerFirst },
  );
}
async function reloadLocal(page: Page) {
  await page.reload();
  await page.getByRole("button", { name: "Продолжить партию" }).click();
  expect(await page.locator(".hand .playing-card").count()).toBe(0);
  await page.getByRole("button", { name: "Я готов — показать карты" }).click();
}
test("запрос, верх и низ работают через диалоги; незаконченный выбор сохраняется", async ({
  page,
}) => {
  await prepare(page, ["defuse", "request", "top", "bottom", "peek"]);
  await page.getByRole("button", { name: /Маша делает уроки с мамой/ }).click();
  await page
    .getByRole("combobox", { name: "У кого?", exact: true })
    .selectOption("p1");
  await page
    .getByRole("combobox", { name: "Какую карту?", exact: true })
    .selectOption("defuse");
  await page.getByRole("button", { name: "Попросить", exact: true }).click();
  await expect(page.locator(".event-log")).toContainText("Карта передана.");
  await page.getByRole("button", { name: /Зоя просит денег у папы/ }).click();
  const top = page.getByRole("dialog", {
    name: "Какую карту положить наверх?",
  });
  await top.getByRole("button", { name: /Зоя смотрит в бинокль/ }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("family-chaos.game.v1")!).deck[0].type,
    ),
  ).toBe("peek");
  await page.getByRole("button", { name: /Таня кладёт денежки/ }).click();
  await reloadLocal(page);
  const bottom = page.getByRole("dialog", {
    name: "Какую карту положить под низ?",
  });
  await bottom
    .getByRole("button", { name: /Мама с салатом/ })
    .first()
    .click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("family-chaos.game.v1")!).deck.at(-1)
          .type,
    ),
  ).toBe("defuse");
  await page
    .getByRole("button", { name: "Взять карту и завершить ход" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Передайте устройство" }),
  ).toBeVisible();
});
test("тайный просмотр и спасение восстанавливаются после перезагрузки", async ({
  page,
}) => {
  await prepare(page, ["defuse", "peek", "skip", "shuffle", "reverse"], true);
  await page.getByRole("button", { name: /Зоя смотрит в бинокль/ }).click();
  await reloadLocal(page);
  await expect(
    page.getByRole("dialog", { name: "Тайный взгляд в колоду" }),
  ).toBeVisible();
  await imageCheck(page);
  await page.getByRole("button", { name: "Запомнил, закрыть" }).click();
  await page
    .getByRole("button", { name: "Взять карту и завершить ход" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Папа с ремнём!" }),
  ).toBeVisible();
  await reloadLocal(page);
  await page.getByRole("button", { name: "Мама, спаси! 🥗" }).click();
  await reloadLocal(page);
  await page.getByRole("spinbutton").fill("2");
  await page.getByRole("button", { name: "Вернуть в выбранное место" }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("family-chaos.game.v1")!),
  );
  expect(saved.deck[1].type).toBe("danger");
  expect(
    saved.players[0].hand.some((c: { type: string }) => c.type === "defuse"),
  ).toBe(false);
  await expect(
    page.getByRole("heading", { name: "Передайте устройство" }),
  ).toBeVisible();
});
test("все десять SVG локальны; игровой стол адаптируется и отключает движение", async ({
  page,
}) => {
  await prepare(page, ["defuse", "attack", "skip", "shuffle", "reverse"]);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  for (const type of [
    "danger",
    "defuse",
    "skip",
    "reverse",
    "attack",
    "peek",
    "shuffle",
    "request",
    "top",
    "bottom",
  ]) {
    const response = await page.request.get(`/cards/${type}.svg`);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain("<svg");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".table-page")).toHaveClass(/no-animation/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/desktop-table.png",
    fullPage: true,
  });
});
