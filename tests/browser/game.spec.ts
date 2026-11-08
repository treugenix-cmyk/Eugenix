import { test, expect, type Page } from "@playwright/test";
const T = {
  danger: "PAPA_BELT",
  defuse: "MAMA_SALAD",
  skip: "TANYA_THERMOMETER",
  nope: "ZOYA_KICKS_OUT",
  attack: "MASHA_ARKASHA_FIGHT",
  peek: "ZOYA_BINOCULARS",
  shuffle: "ARKASHA_LEGO",
  favor: "ZOYA_MONEY",
  homework: "MASHA_HOMEWORK",
  piggy: "TANYA_PIGGY_BANK",
  chinese: "ZOYA_CHINESE",
  dance: "TANYA_DANCES",
  draw: "MASHA_DRAWS",
};
async function disableAnimations(page: Page) {
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page.getByLabel("Анимации", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
}
async function images(page: Page) {
  await page
    .locator("img")
    .evaluateAll((nodes) =>
      Promise.all(nodes.map((n) => (n as HTMLImageElement).decode())),
    );
  expect(
    await page
      .locator("img")
      .evaluateAll((nodes) =>
        nodes.every((n) => (n as HTMLImageElement).naturalWidth > 0),
      ),
  ).toBe(true);
}
async function ready(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Передайте устройство" }),
  ).toBeVisible();
  expect(await page.locator(".hand .playing-card").count()).toBe(0);
  expect(await page.locator("dialog[open]").count()).toBe(0);
  await page.getByRole("button", { name: "Я готов — показать карты" }).click();
}
async function passAll(page: Page) {
  for (let n = 0; n < 12; n++) {
    if (
      await page
        .getByRole("heading", { name: "Передайте устройство" })
        .isVisible()
    )
      await ready(page);
    const pass = page.getByRole("button", { name: "Не отменять — дальше" });
    if (await pass.isVisible()) await pass.click();
    else return;
  }
  throw Error("Окно NOPE не закрывается");
}
async function reloadLocal(page: Page) {
  await page.reload();
  await page.getByRole("button", { name: "Продолжить партию" }).click();
  await ready(page);
}
async function prepare(
  page: Page,
  hands: string[][],
  dangerFirst = false,
  mode: "local" | "bots" = "local",
) {
  await page.goto("/");
  await page.evaluate(
    async ({ hands, dangerFirst, mode }) => {
      const engine = await import("/src/game-engine/index.ts");
      const storage = await import("/src/storage/index.ts");
      const s = engine.newGame({
        mode,
        players: hands.length,
        difficulty: "medium",
      });
      // Оставляем исходные физические экземпляры и общий состав из 56 карт.
      for (let player = 0; player < hands.length; player++) {
        s.deck.push(...s.players[player].hand.splice(0));
        for (const type of hands[player]) {
          const collections = [
            s.deck,
            ...s.players
              .filter((_: unknown, i: number) => i !== player)
              .map((p: { hand: unknown[] }) => p.hand),
          ];
          const source = collections.find((cards: { type: string }[]) =>
            cards.some((c) => c.type === type),
          );
          if (!source) throw Error(type);
          s.players[player].hand.push(
            source.splice(
              source.findIndex((c: { type: string }) => c.type === type),
              1,
            )[0],
          );
        }
      }
      if (dangerFirst) {
        const i = s.deck.findIndex(
          (c: { type: string }) => c.type === "PAPA_BELT",
        );
        s.deck.unshift(s.deck.splice(i, 1)[0]);
      }
      if (!storage.isGameState(s)) throw Error("Некорректная тестовая раздача");
      storage.saveGame(localStorage, s);
      localStorage.setItem(
        "family-chaos.settings.v1",
        JSON.stringify({ animations: false, sound: false }),
      );
    },
    { hands, dangerFirst, mode },
  );
  await page.reload();
  await page.getByRole("button", { name: "Продолжить партию" }).click();
  if (mode === "local") await ready(page);
}
test("полная мобильная партия с четырьмя ботами и ответами вне своего хода", async ({
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
  expect(await page.locator(".hand .playing-card").count()).toBe(8);
  await images(page);
  for (let n = 0; n < 1300; n++) {
    if (
      await page.getByRole("dialog", { name: /победитель|перемирие/ }).count()
    )
      break;
    if (await page.getByRole("button", { name: "Мама, спаси! 🥗" }).isVisible())
      await page.getByRole("button", { name: "Мама, спаси! 🥗" }).click();
    else if (
      await page
        .getByRole("button", { name: "Под низ", exact: true })
        .isVisible()
    )
      await page.getByRole("button", { name: "Под низ", exact: true }).click();
    else if (
      await page
        .getByRole("button", { name: "Не отменять — дальше" })
        .isVisible()
    )
      await page.getByRole("button", { name: "Не отменять — дальше" }).click();
    else if (
      await page
        .getByRole("dialog", { name: "Выберите карту, которую отдадите" })
        .isVisible()
    )
      await page
        .getByRole("dialog", { name: "Выберите карту, которую отдадите" })
        .locator(".playing-card")
        .first()
        .click();
    else if (
      await page
        .getByRole("button", { name: "Взять карту и завершить ход" })
        .isEnabled()
    )
      await page
        .getByRole("button", { name: "Взять карту и завершить ход" })
        .click();
    else await page.waitForTimeout(50);
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
test("локальная игра: NOPE, контр-NOPE, тайные ответы после перезагрузки", async ({
  page,
}) => {
  await prepare(page, [
    [T.attack, T.nope, T.defuse],
    [T.nope, T.defuse],
    [T.defuse, T.dance],
  ]);
  await page
    .getByRole("button", { name: /^Маша и Аркаша подрались\./ })
    .click();
  await ready(page);
  await expect(
    page.getByRole("dialog", { name: "Окно отмены · NOPE" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Сыграть NOPE", exact: true }).click();
  await ready(page);
  await page.getByRole("button", { name: "Не отменять — дальше" }).click();
  await ready(page);
  await reloadLocal(page);
  await expect(
    page.getByText("Сейчас действие отменено.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Сыграть NOPE", exact: true }).click();
  await passAll(page);
  const s = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("family-chaos.game.v2")!),
  );
  expect(s.active).toBe(1);
  expect(s.remaining).toBe(2);
  expect(
    s.discard.filter((c: { type: string }) => c.type === "ZOYA_KICKS_OUT"),
  ).toHaveLength(2);
});
test("FAVOR отдаёт выбранную соперником карту с закрытым переходом устройства", async ({
  page,
}) => {
  await prepare(page, [
    [T.favor, T.defuse],
    [T.skip, T.defuse, T.dance],
    [T.defuse],
  ]);
  await page
    .getByRole("button", { name: /^Зоя просит денег у папы\./ })
    .click();
  await page
    .getByRole("combobox", { name: "Соперник", exact: true })
    .selectOption("p1");
  await page.getByRole("button", { name: "Подтвердить цель" }).click();
  await passAll(page);
  await expect(
    page.getByRole("dialog", { name: "Выберите карту, которую отдадите" }),
  ).toBeVisible();
  await reloadLocal(page);
  await page
    .getByRole("dialog", { name: "Выберите карту, которую отдадите" })
    .getByRole("button", { name: /^Таня танцует\./ })
    .click();
  await ready(page);
  const s = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("family-chaos.game.v2")!),
  );
  expect(
    s.players[0].hand.some((c: { type: string }) => c.type === "TANYA_DANCES"),
  ).toBe(true);
  expect(
    s.players[1].hand.some((c: { type: string }) => c.type === "MAMA_SALAD"),
  ).toBe(true);
});
for (const count of [2, 3])
  test(`${count} одинаковые: выбор экземпляров и цель через интерфейс`, async ({
    page,
  }) => {
    await prepare(page, [
      Array(count).fill(T.chinese),
      [T.defuse, T.skip],
      [T.defuse],
    ]);
    await page
      .getByRole("button", { name: "Комбинация · 2 или 3 карты" })
      .click();
    const cards = page.locator(".hand .playing-card");
    for (let i = 0; i < count; i++) await cards.nth(i).click();
    await page.getByRole("button", { name: "Разыграть комбинацию" }).click();
    await page
      .getByRole("combobox", { name: "Соперник", exact: true })
      .selectOption("p1");
    if (count === 3)
      await page
        .getByRole("combobox", { name: "Какую карту?", exact: true })
        .selectOption(T.defuse);
    await page.getByRole("button", { name: "Подтвердить цель" }).click();
    await passAll(page);
    const s = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("family-chaos.game.v2")!),
    );
    expect(s.players[0].hand).toHaveLength(1);
    if (count === 3) expect(s.players[0].hand[0].type).toBe(T.defuse);
    expect(s.remaining).toBe(1);
    expect(s.active).toBe(0);
  });
test("просмотр, взрыв, защита и позиция сохраняются после перезагрузки", async ({
  page,
}) => {
  await prepare(page, [[T.peek, T.defuse], [T.defuse], [T.defuse]], true);
  await page.getByRole("button", { name: /^Зоя смотрит в бинокль\./ }).click();
  await passAll(page);
  await reloadLocal(page);
  await expect(
    page.getByRole("dialog", { name: "Тайный взгляд в колоду" }),
  ).toBeVisible();
  await images(page);
  await page.getByRole("button", { name: "Запомнил, закрыть" }).click();
  await page
    .getByRole("button", { name: "Взять карту и завершить ход" })
    .click();
  await reloadLocal(page);
  await page.getByRole("button", { name: "Мама, спаси! 🥗" }).click();
  await reloadLocal(page);
  await page.getByRole("spinbutton").fill("2");
  await page.getByRole("button", { name: "Вернуть в выбранное место" }).click();
  await ready(page);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("family-chaos.game.v2")!).deck[1].type,
    ),
  ).toBe(T.danger);
});
test("все 13 изображений без обрезки, увеличение, адаптация и прежний дизайн", async ({
  page,
}) => {
  await prepare(page, [
    [T.defuse, T.chinese, T.dance, T.draw],
    [T.defuse],
    [T.defuse],
  ]);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await images(page);
  expect(
    await page
      .locator(".hand .playing-card img")
      .evaluateAll((nodes) =>
        nodes.every((n) => getComputedStyle(n).objectFit === "contain"),
      ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Увеличить: Таня танцует", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Таня танцует" }),
  ).toBeVisible();
  await images(page);
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.getByRole("button", { name: "Правила", exact: true }).click();
  await expect(page.getByText("Пары и тройки", { exact: true })).toBeVisible();
  await page
    .locator("details summary")
    .evaluateAll((nodes) => nodes.forEach((n) => (n as HTMLElement).click()));
  await images(page);
  expect(await page.locator(".rules-card-image").count()).toBe(13);
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".table-page")).toHaveClass(/no-animation/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/mobile-13-cards.png",
    fullPage: true,
  });
});
test("восемь карт и экран передачи сохраняются при обычной локальной игре", async ({
  page,
}) => {
  await page.goto("/");
  await disableAnimations(page);
  await page.getByLabel("С кем играем?").selectOption("local");
  await page.getByRole("button", { name: "Играть", exact: false }).click();
  await ready(page);
  expect(await page.locator(".hand .playing-card").count()).toBe(8);
  await reloadLocal(page);
  expect(await page.locator(".hand .playing-card").count()).toBe(8);
});

test("новая партия сбрасывает незавершённый выбор комбинации", async ({
  page,
}) => {
  await prepare(page, [[T.homework, T.homework], [T.defuse], [T.defuse]]);
  await page
    .getByRole("button", { name: "Комбинация · 2 или 3 карты" })
    .click();
  await page.locator(".hand .playing-card").nth(0).click();
  await page.locator(".hand .playing-card").nth(1).click();
  await page.getByRole("button", { name: "Новая партия", exact: true }).click();
  await page
    .getByRole("button", { name: "Начать новую партию", exact: true })
    .click();
  await ready(page);
  await expect(
    page.getByRole("button", { name: "Комбинация · 2 или 3 карты" }),
  ).toBeVisible();
  expect(await page.locator('.hand [aria-pressed="true"]').count()).toBe(0);
  expect(await page.locator(".hand .playing-card").count()).toBe(8);
});
