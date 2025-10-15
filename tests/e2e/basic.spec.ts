import { SpecBase } from './specBase';

const base = new SpecBase('base');

base.runTest(async ({ page }) => {
  await page.locator('#player-name').fill('テスト');

  await base.compareScreenshot(page, '0-0.png');

  await base.compareScreenshot(page, '1-0.png');

  await page
    .locator('div')
    .filter({ hasText: /^テスト menu_book$/ })
    .getByLabel('詳細を表示')
    .click();
  await base.compareScreenshot(page, '1-1.png');

  await page.getByRole('button', { name: '閉じる' }).click();
  await base.compareScreenshot(page, '1-2.png');
});
