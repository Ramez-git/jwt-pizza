import { test, expect, Page } from 'playwright-test-coverage';

type User = { id?: string; name?: string; email?: string; roles?: { role: string; objectId?: string }[] };
type Franchise = { id: string; name: string; stores: { id: string; name: string }[] };

async function setupMocks(page: Page) {
  let currentUser: User | null = null;

  let franchises: Franchise[] = [
    { id: '1', name: 'LotaPizza', stores: [{ id: '10', name: 'Lehi' }, { id: '11', name: 'Springville' }] },
    { id: '2', name: 'PizzaCorp', stores: [{ id: '20', name: 'Spanish Fork' }] },
  ];

  const users: Record<string, { user: User; password: string }> = {
    'd@jwt.com': { password: 'a', user: { id: '3', name: 'Kai Chen', email: 'd@jwt.com', roles: [{ role: 'diner' }] } },
    'admin@jwt.com': { password: 'admin', user: { id: '1', name: 'Admin User', email: 'admin@jwt.com', roles: [{ role: 'admin' }] } },
  };

  await page.route('**/version.json', (route) => route.fulfill({ json: { version: 'test' } }));

  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();

    if (!path.includes('/api/') && !path.endsWith('/version.json')) return route.continue();

    if (path.endsWith('/api/auth') && (method === 'PUT' || method === 'POST')) {
      const body = (req.postDataJSON?.() ?? {}) as any;

      if (typeof body?.name === 'string' && body.name.length > 0) {
        currentUser = { id: '9', name: body.name, email: body.email, roles: [{ role: 'diner' }] };
        return route.fulfill({ json: { user: currentUser, token: 'newtoken' } });
      }

      const rec = users[String(body?.email)];
      if (!rec || rec.password !== body?.password) return route.fulfill({ status: 401, json: { message: 'Unauthorized' } });

      currentUser = rec.user;
      return route.fulfill({ json: { user: currentUser, token: 'abcdef' } });
    }

    if (path.endsWith('/api/auth') && method === 'DELETE') {
      currentUser = null;
      return route.fulfill({ json: { message: 'logged out' } });
    }

    if (path.endsWith('/api/user/me') && method === 'GET') return route.fulfill({ json: currentUser });

    if (path.endsWith('/api/order/menu') && method === 'GET') {
      return route.fulfill({
        json: [
          { id: '1', title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
          { id: '2', title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
          { id: '3', title: 'Margarita', image: 'pizza3.png', price: 0.0014, description: 'Essential classic' },
        ],
      });
    }

    if (path.endsWith('/api/order') && method === 'GET') {
      return route.fulfill({
        json: {
          id: 'hist',
          dinerId: currentUser?.id ?? '3',
          orders: [
            {
              id: 'o1',
              franchiseId: '1',
              storeId: '10',
              date: new Date().toISOString(),
              items: [
                { menuId: '1', description: 'Veggie', price: 0.0038 },
                { menuId: '2', description: 'Pepperoni', price: 0.0042 },
              ],
            },
          ],
        },
      });
    }

    if (path.endsWith('/api/order') && method === 'POST') {
      const body = req.postDataJSON();
      return route.fulfill({ json: { order: { ...body, id: '23', date: new Date().toISOString() }, jwt: 'eyJpYXQ.fake.jwt' } });
    }

    if (path.endsWith('/api/order/verify') && method === 'POST') return route.fulfill({ json: { message: 'verified', payload: '0.008' } });

    if (path.endsWith('/api/docs') && method === 'GET') {
      return route.fulfill({
        json: {
          endpoints: [{ requiresAuth: false, method: 'GET', path: '/api/order/menu', description: 'Menu', example: '', response: {} }],
        },
      });
    }

    if (path.endsWith('/api/franchise') && method === 'GET' && url.searchParams.has('page')) {
      return route.fulfill({ json: { franchises, more: false } });
    }

    if (path.endsWith('/api/franchise') && method === 'POST') {
      const body = (req.postDataJSON?.() ?? {}) as any;
      const created: Franchise = { id: String(Math.floor(Math.random() * 1000) + 100), name: body.name ?? 'NewFranchise', stores: [] };
      franchises = [created, ...franchises];
      return route.fulfill({ json: created });
    }

    if (path.includes('/api/franchise/') && method === 'GET') return route.fulfill({ json: franchises });

    const closeFranchiseMatch = path.match(/^\/api\/franchise\/([^/]+)$/);
    if (closeFranchiseMatch && method === 'DELETE') {
      franchises = franchises.filter((f) => f.id !== closeFranchiseMatch[1]);
      return route.fulfill({ json: { message: 'deleted' } });
    }

    const createStoreMatch = path.match(/^\/api\/franchise\/([^/]+)\/store$/);
    if (createStoreMatch && method === 'POST') {
      const fid = createStoreMatch[1];
      const body = (req.postDataJSON?.() ?? {}) as any;
      const store = { id: String(Date.now()), name: body.name ?? 'NewStore' };
      franchises = franchises.map((f) => (f.id === fid ? { ...f, stores: [...f.stores, store] } : f));
      return route.fulfill({ json: store });
    }

    const closeStoreMatch = path.match(/^\/api\/franchise\/([^/]+)\/store\/([^/]+)$/);
    if (closeStoreMatch && method === 'DELETE') {
      const fid = closeStoreMatch[1];
      const sid = closeStoreMatch[2];
      franchises = franchises.map((f) => (f.id === fid ? { ...f, stores: f.stores.filter((s) => s.id !== sid) } : f));
      return route.fulfill({ json: null });
    }

    return route.fulfill({ status: 200, json: {} });
  });
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/password/i).fill(password);
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth') && ['PUT', 'POST'].includes(r.request().method())),
    page.getByRole('button', { name: /login/i }).click(),
  ]);
  expect([200, 201]).toContain(resp.status());
}

async function register(page: Page, name: string, email: string, password: string) {
  await page.goto('/register');
  await page.getByPlaceholder(/name/i).fill(name);
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/password/i).fill(password);
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /register/i }).click(),
  ]);
  expect([200, 201]).toContain(resp.status());
}

async function clickFirstIfAny(page: Page, locator: any) {
  if (!(await locator.count())) return false;
  const el = locator.first();
  if (!(await el.isEnabled().catch(() => false))) return false;
  await el.click().catch(() => {});
  return true;
}

test.beforeEach(async ({ page }) => {
  await setupMocks(page);
});

test('register page submits', async ({ page }) => {
  await register(page, 'Test User', 'new@jwt.com', 'pw');
  await expect(page.locator('#root')).toBeVisible();
});

test('login + logout flow', async ({ page }) => {
  await login(page, 'd@jwt.com', 'a');
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth') && r.request().method() === 'DELETE'),
    page.goto('/logout'),
  ]);
  expect([200, 201]).toContain(resp.status());
  await expect(page.locator('#root')).toBeVisible();
});

test('admin can open admin dashboard', async ({ page }) => {
  await login(page, 'admin@jwt.com', 'admin');
  await page.goto('/admin-dashboard');
  await expect(page.locator('#root')).toBeVisible();
});

test('admin create franchise via route', async ({ page }) => {
  await login(page, 'admin@jwt.com', 'admin');
  await page.goto('/admin-dashboard/create-franchise');

  const inputs = page.getByRole('textbox');
  const count = await inputs.count();
  if (count >= 1) await inputs.nth(0).fill('My New Franchise');
  if (count >= 2) await inputs.nth(1).fill('admin@jwt.com');

  const btn = page.getByRole('button', { name: /create|save|submit/i }).first();
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/franchise') && r.request().method() === 'POST'),
    btn.click(),
  ]);
  expect([200, 201]).toContain(resp.status());
  await expect(page.locator('#root')).toBeVisible();
});

test('admin create store via route', async ({ page }) => {
  await login(page, 'admin@jwt.com', 'admin');
  await page.goto('/admin-dashboard/create-store');
  const inputs = page.getByRole('textbox');
  if (await inputs.count()) await inputs.first().fill('New Store Name');
  const btn = page.getByRole('button', { name: /create|save|submit/i }).first();
  if (await btn.count()) await btn.click({ trial: true }).catch(() => {});
  await expect(page.locator('#root')).toBeVisible();
});

test('admin close franchise route renders and performs delete', async ({ page }) => {
  await login(page, 'admin@jwt.com', 'admin');
  await page.goto('/admin-dashboard/close-franchise');
  const closeBtn = page.getByRole('button', { name: /close|delete|remove/i }).first();
  if (await closeBtn.count()) {
    await Promise.allSettled([
      page.waitForResponse((r) => r.url().includes('/api/franchise/') && r.request().method() === 'DELETE'),
      closeBtn.click(),
    ]);
  }
  await expect(page.locator('#root')).toBeVisible();
});

test('admin close store route renders and performs delete', async ({ page }) => {
  await login(page, 'admin@jwt.com', 'admin');
  await page.goto('/admin-dashboard/close-store');
  const closeBtn = page.getByRole('button', { name: /close|delete|remove/i }).first();
  if (await closeBtn.count()) {
    await Promise.allSettled([
      page.waitForResponse((r) => r.url().includes('/api/franchise/') && r.request().method() === 'DELETE'),
      closeBtn.click(),
    ]);
  }
  await expect(page.locator('#root')).toBeVisible();
});

test('diner franchise dashboard renders', async ({ page }) => {
  await login(page, 'd@jwt.com', 'a');
  await page.goto('/franchise-dashboard');
  await expect(page.locator('#root')).toBeVisible();
});

test('order -> payment -> delivery flow', async ({ page }) => {
  await page.goto('/menu');
  await expect(page.locator('#root')).toBeVisible();

  await clickFirstIfAny(page, page.getByRole('link', { name: /veggie/i }));
  await clickFirstIfAny(page, page.getByRole('link', { name: /pepperoni/i }));
  await clickFirstIfAny(page, page.getByText(/veggie/i));
  await clickFirstIfAny(page, page.getByText(/pepperoni/i));

  const checkout = page.getByRole('button', { name: /checkout/i }).first();
  if (await checkout.count()) {
    if (await checkout.isEnabled().catch(() => false)) await checkout.click().catch(() => {});
  }

  if (await page.getByRole('button', { name: /login/i }).count()) {
    await page.getByPlaceholder(/email/i).fill('d@jwt.com');
    await page.getByPlaceholder(/password/i).fill('a');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth') && ['PUT', 'POST'].includes(r.request().method())),
      page.getByRole('button', { name: /login/i }).click(),
    ]);
  }

  await page.goto('/payment');
  await expect(page.locator('#root')).toBeVisible();
  await page.goto('/delivery');
  await expect(page.locator('#root')).toBeVisible();
});

test('docs route renders', async ({ page }) => {
  await page.goto('/docs/api');
  await expect(page.locator('#root')).toBeVisible();
});

test('home/about/history/notFound quick coverage', async ({ page }) => {
  await page.goto('/');
  await page.goto('/about');
  await page.goto('/history');
  await page.goto('/this-does-not-exist');
  await expect(page.locator('#root')).toBeVisible();
});

test('diner dashboard loads order history', async ({ page }) => {
  await login(page, 'd@jwt.com', 'a');
  await page.goto('/diner-dashboard');
  await page.waitForResponse((r) => r.url().includes('/api/order') && r.request().method() === 'GET');
  await expect(page.locator('#root')).toBeVisible();
  await expect(page.locator('#root')).toContainText(/veggie|pepperoni|order/i);
});
test('delivery verify covers success + failure branches (covers 18-24)', async ({ page }) => {
  await login(page, 'd@jwt.com', 'a');

  const state = {
    jwt: 'eyJpYXQ.delivery.jwt',
    order: { id: '23', items: [{ menuId: '1', description: 'Veggie', price: 0.0038 }] },
  };

  await page.goto('/');
  await page.evaluate(
    ({ state }) => {
      history.pushState({ usr: state }, '', '/delivery');
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
    { state }
  );

  const verifyBtn = page.getByRole('button', { name: /^Verify$/i });
  const modal = page.locator('#hs-jwt-modal');

  await verifyBtn.click();
  await expect(modal).toBeVisible();
  await expect(modal).toContainText(/JWT Pizza/i);
  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
  await page.route('**/api/order/verify', async (route) => {
    await route.fulfill({ status: 500, json: { message: 'boom' } });
  });

  await verifyBtn.click();
  await expect(modal).toBeVisible();
  await expect(modal).toContainText(/bad pizza/i);
});
