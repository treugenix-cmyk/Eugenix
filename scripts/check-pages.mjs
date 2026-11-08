// Проверка реального dist под префиксами проектов, без подмены ответов браузера.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const root = resolve("dist");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, "http://localhost").pathname;
    const prefix = ["/my-card-game/", "/Eugenix/"].find((prefix) =>
      path.startsWith(prefix),
    );
    if (!prefix) {
      response.writeHead(404).end();
      return;
    }
    const file = resolve(root, path.slice(prefix.length) || "index.html");
    if (!file.startsWith(root + "/")) {
      response.writeHead(403).end();
      return;
    }
    const data = await readFile(file);
    response
      .writeHead(200, {
        "Content-Type": mime[extname(file)] ?? "application/octet-stream",
      })
      .end(data);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  });
  const address = server.address();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  for (const prefix of ["/my-card-game/", "/Eugenix/"]) {
    await page.goto(`http://127.0.0.1:${address.port}${prefix}`);
    await page.getByRole("button", { name: "Правила", exact: true }).waitFor();
    await page
      .locator("img")
      .evaluateAll((images) =>
        Promise.all(images.map((image) => image.decode())),
      );
    assert.match(await page.title(), /Семейный переполох/);
    const count = await page.evaluate(async () => {
      const files = [
        "01_papa_s_remnem.png",
        "02_mama_s_salatom.png",
        "03_tanya_s_gradusnikom.png",
        "04_zoya_vygonyaet.png",
        "05_masha_arkasha_podralis.png",
        "06_zoya_binokl.png",
        "07_arkasha_lego.png",
        "08_masha_uroki.png",
        "09_zoya_dengi.png",
        "10_tanya_kopilka.png",
        "11_zoya_uchit_kitayskiy.png",
        "12_tanya_tantsuet.png",
        "13_masha_risuet.png",
      ];
      for (const file of files) {
        const image = new Image();
        image.src = `./cards/family/${file}`;
        await image.decode();
        if (!image.naturalWidth) throw new Error(file);
      }
      return files.length;
    });
    assert.equal(count, 13);
    await page.getByRole("button", { name: "Играть", exact: false }).click();
    await page
      .getByRole("button", { name: "Взять карту и завершить ход" })
      .waitFor();
    assert.equal(await page.locator(".hand .playing-card").count(), 8);
    await page.reload();
    await page.getByRole("button", { name: "Продолжить партию" }).click();
    assert.equal(await page.locator(".hand .playing-card").count(), 8);
    await page.getByRole("button", { name: "В меню", exact: true }).click();
    await page.evaluate(() => localStorage.clear());
  }
  assert.deepEqual(failures, []);
  console.log(
    "Production Pages: /my-card-game/ и /Eugenix/ — запуск, 13 PNG, восстановление партии: OK",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
