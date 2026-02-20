import { test, expect } from 'playwright-test-coverage';

test('updateUser', async ({ page }) => {
  let mockUser = {
    id: '123',
    name: 'pizza diner',
    email: 'diner@jwt.com',
    roles: [{ role: 'diner' }],
  };

  await page.route('**/api/auth', async (route) => {
    const method = route.request().method();
    if (method === 'POST' || method === 'PUT') {
      const body = route.request().postDataJSON();
      if (body.name) mockUser.name = body.name;
      if (body.email) mockUser.email = body.email;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: mockUser, token: 'mock-jwt-token' }),
      });
    }
  });
  await page.route('**/api/user/me', (route) => 
    route.fulfill({ status: 200, body: JSON.stringify(mockUser) })
  );

  await page.route('**/api/order', (route) => 
    route.fulfill({ status: 200, body: JSON.stringify({ dinerId: mockUser.id, orders: [], more: false }) })
  );

  await page.route(/\/api\/user\/\d+/, async (route) => {
    if (route.request().method() === 'PUT') {
      const updatedData = route.request().postDataJSON();
            mockUser = { ...mockUser, ...updatedData };
      
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ user: mockUser, token: 'updated-jwt-token' }),
      });
    }
  });

  await page.goto('/');

  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill(mockUser.name);
  await page.getByRole('textbox', { name: 'Email address' }).fill(mockUser.email);
  await page.getByRole('textbox', { name: 'Password' }).fill('password');
  await page.getByRole('button', { name: 'Register' }).click();

  const initials = mockUser.name.split(' ').map(n => n[0]).join('').toLowerCase();
  const profileLink = page.getByRole('link', { name: initials });
  await expect(profileLink).toBeVisible();
  await profileLink.click();

  await expect(page.getByRole('main')).toContainText(mockUser.name);

  await page.getByRole('button', { name: 'Edit' }).click();
  const newName = 'pizza dinerx';
  await page.getByRole('textbox').first().fill(newName);
  
  const updateResponse = page.waitForResponse(res => res.url().includes('/api/user/') && res.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Update' }).click();
  await updateResponse;

  await expect(page.getByRole('main')).toContainText(newName);
  
  await page.getByRole('link', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(mockUser.email);
  await page.getByRole('textbox', { name: 'Password' }).fill('password');
  await page.getByRole('button', { name: 'Login' }).click();
  
  await profileLink.click();
  await expect(page.getByRole('main')).toContainText(newName);
});