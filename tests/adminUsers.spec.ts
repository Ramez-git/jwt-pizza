import { test, expect } from 'playwright-test-coverage';

test('admin list users + filter + pagination + delete', async ({ page }) => {
  const page1 = {
    users: [
      { id: 1, name: 'Alpha Admin', email: 'alpha@jwt.com', roles: [{ role: 'admin' }] },
      { id: 2, name: 'Beta Diner', email: 'beta@jwt.com', roles: [{ role: 'diner' }] },
    ],
    more: true,
  };

  const page2 = {
    users: [
      { id: 3, name: 'Gamma Franchisee', email: 'gamma@jwt.com', roles: [{ role: 'franchisee', objectId: '1' }] },
    ],
    more: false,
  };

  let currentUsers = [...page1.users];

  await page.route('**/api/user?*', async (route) => {
    const url = new URL(route.request().url());
    const pageParam = url.searchParams.get('page') ?? '1';
    const name = (url.searchParams.get('name') ?? '*').toLowerCase();

    const data = pageParam === '2' ? page2 : { users: currentUsers, more: true };

    const filtered =
      name === '*' || name === ''
        ? data.users
        : data.users.filter((u) => u.name.toLowerCase().includes(name));

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ users: filtered, more: pageParam === '2' ? false : true }),
    });
  });

  await page.route('**/api/user/*', async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();

    const parts = route.request().url().split('/');
    const id = Number(parts[parts.length - 1]);
    currentUsers = currentUsers.filter((u) => u.id !== id);

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'deleted' }) });
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: /admin/i }).click();

  await expect(page.getByRole('main')).toContainText('Alpha Admin');
  await expect(page.getByRole('main')).toContainText('Beta Diner');

  await page.getByRole('textbox', { name: /filter/i }).fill('alpha');
  await page.getByRole('button', { name: /search/i }).click();

  await expect(page.getByRole('main')).toContainText('Alpha Admin');
  await expect(page.getByRole('main')).not.toContainText('Beta Diner');

  await page.getByRole('textbox', { name: /filter/i }).fill('*');
  await page.getByRole('button', { name: /search/i }).click();

  await page.getByRole('button', { name: /next/i }).click();
  await expect(page.getByRole('main')).toContainText('Gamma Franchisee');

  await page.getByRole('button', { name: /prev/i }).click();
  await expect(page.getByRole('main')).toContainText('Alpha Admin');

  await page.getByRole('button', { name: /delete beta diner/i }).click();
  await expect(page.getByRole('main')).not.toContainText('Beta Diner');
});