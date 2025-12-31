import {
  test,
  expect,
  type PlaywrightTestArgs,
  type PlaywrightTestOptions,
  type PlaywrightWorkerArgs,
  type PlaywrightWorkerOptions,
  type TestInfo,
  type Page,
} from "@playwright/test";

export class SpecBase {
  title!: string;
  page!: Page;
  constructor(title?: string) {
    if (title) {
      this.title = title;
    }
  }
  runTest(
    testFunction: (
      args: PlaywrightTestArgs &
        PlaywrightTestOptions &
        PlaywrightWorkerArgs &
        PlaywrightWorkerOptions,
      testInfo: TestInfo,
    ) => void,
  ): void {
    test.beforeEach(async ({ page }: { page: Page }) => {
      await page.goto("http://localhost:4173/");
    });

    test(this.title, testFunction);
  }
  async compareScreenshot(page: Page, screenshotName: string): Promise<void> {
    await expect(page).toHaveScreenshot(
      this.title ? this.title + "-" + screenshotName : screenshotName,
    );
  }
}
