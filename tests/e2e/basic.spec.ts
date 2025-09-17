import { SpecBase } from './specBase';

const base = new SpecBase('base');

base.runTest(async ({ page }) => {
  await base.compareScreenshot(page, '0-0.png');

  await base.compareScreenshot(page, '1-0.png');

  await page.getByRole('button', { name: /normal/i }).click();
});
