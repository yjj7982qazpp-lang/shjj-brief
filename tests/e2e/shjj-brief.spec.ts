import { expect, test } from '@playwright/test';

const BROKEN_TEXT_PATTERNS = [
  '�',
  '??/span>',
  '??/div>',
  '??/strong>',
  'ì',
  'ê',
];

async function collectConsoleErrors(page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      if (!text.includes('Failed to load resource')) errors.push(text);
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('SHJJ Brief core screen loads without broken text or console errors', async ({ page }) => {
  const errors = await collectConsoleErrors(page);

  await page.route('**/api.open-meteo.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        current: {
          temperature_2m: 18,
          relative_humidity_2m: 55,
          apparent_temperature: 18,
          weather_code: 1,
          wind_speed_10m: 7,
        },
        daily: {
          time: ['2026-05-04', '2026-05-05'],
          weather_code: [1, 2],
          temperature_2m_max: [22, 24],
          temperature_2m_min: [13, 14],
          precipitation_probability_max: [10, 20],
        },
        hourly: {
          time: ['2026-05-04T09:00', '2026-05-04T10:00', '2026-05-04T11:00'],
          temperature_2m: [16, 18, 20],
          precipitation_probability: [0, 10, 20],
          precipitation: [0, 0, 0],
        },
      }),
    });
  });

  await page.goto('/');
  await expect(page.locator('[data-app-title]')).toContainText('SHJJ Brief');
  await expect(page.locator('#weatherSection')).toBeVisible();
  await expect(page.locator('#guideSection')).toBeVisible();
  await expect(page.locator('#notificationTimeInput').first()).toBeAttached();
  const scheduleFold = page.locator('#scheduleSection details.fold-card').first();
  await expect(scheduleFold).toBeAttached();
  await expect(page.locator('#lawBasisChip')).toHaveText(/법령 브리프|변경 있음|시행일 기준/);

  const pageText = await page.locator('body').innerText();
  for (const pattern of BROKEN_TEXT_PATTERNS) {
    expect(pageText, `깨진 문자열 감지: ${pattern}`).not.toContain(pattern);
  }

  const weatherBox = await page.locator('#weatherSection').boundingBox();
  const guideBox = await page.locator('#guideSection').boundingBox();
  expect(weatherBox?.y ?? 999999).toBeLessThan(guideBox?.y ?? -1);

  if (!(await scheduleFold.evaluate((element) => element.hasAttribute('open')))) {
    await scheduleFold.locator('summary').first().click();
  }
  await expect(scheduleFold).toHaveAttribute('open', '');

  expect(errors).toEqual([]);
});

test('production host never exposes preview labels', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://shjj-brief.pages.dev/'),
      writable: true,
    });
  }).catch(() => undefined);

  const titleText = await page.locator('[data-app-title]').first().innerText();
  expect(titleText).toBe('SHJJ Brief');
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('Preview v4');
});

test('law data fetch failure keeps the app readable', async ({ page }) => {
  await page.route('**/data/law_updates.json', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');
  await expect(page.locator('#workSection')).toBeVisible();
  await expect(page.locator('#lawNotice')).toContainText(/법령|변경|데이터|불러오지/);
});
