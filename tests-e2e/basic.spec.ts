import { test, expect } from '@playwright/test';

// 簡易E2E: 戦闘開始→アクション2回→ログ変化確認

test('start combat and perform two actions', async ({ page }) => {
  await page.goto('/my-logue/');
  // 進行画面でcombatボタン
  await page
    .getByRole('button', { name: /combat|戦闘/i })
    .first()
    .click();
  await expect(page.getByText(/戦闘開始/)).toBeVisible();
  // 行動ボタン2つ押す
  const actionButtons = page.locator('section:has-text("戦闘") button');
  await actionButtons.nth(0).click();
  await actionButtons.nth(1).click();
  // 敵の攻撃ログ or 毒ログなど何か戦闘ログが追加されたか
  await expect(page.locator('.log')).toContainText(/敵の攻撃|毒|ダメージ/);
});
