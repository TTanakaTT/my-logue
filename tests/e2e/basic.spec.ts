import { SpecBase } from './specBase';

const base = new SpecBase('base');

base.runTest(async ({ page }) => {
  await page.locator('#player-name').fill('テスト');

  await base.compareScreenshot(page, '0-0.png');

  await base.compareScreenshot(page, '1-0.png');

  await page.locator('button[name="open-detail"]').click();
  await base.compareScreenshot(page, '1-1.png');

  await page.locator('#close-detail').click();
  await base.compareScreenshot(page, '1-2.png');
});
