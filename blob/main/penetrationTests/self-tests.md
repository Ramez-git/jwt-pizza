# JWT Pizza Penetration Test Report

**Tester:** RJ Gammoh
**Peer:** Andre
**Date of Report:** April 10, 2026  
**Target:** pizza-service.rjspizza.click

---

## Self Attack

### Attack 1 — Unauthenticated Franchise Delete --- attack on Peer

| Item | Result |
| --- | --- |
| **Date** | April 10, 2026 |
| **Target** | pizza-service.pizzacs329andre.click |
| **Classification** | Broken Access Control (OWASP A01:2021) |
| **Severity** | 3 — High |
| **Description** | The `DELETE /api/franchise/:franchiseId` endpoint was missing authentication middleware entirely. Using Burp Suite Repeater, a DELETE request was sent to `/api/franchise/1` with no `Authorization` header. The server responded with HTTP `200 OK` and `{"message": "franchise deleted"}`, confirming that any unauthenticated user on the internet can permanently delete any franchise without credentials of any kind. |
| **Corrections** | Added `authRouter.authenticateToken` middleware and an admin role check to the delete franchise route in `franchiseRouter.js`. The fixed route now requires a valid JWT token and verifies the user holds the `Admin` role before proceeding. |


### images
![Attack 1](attack1.png)


#### Vulnerable code (before fix)

```js
// franchiseRouter.js
franchiseRouter.delete(
  '/:franchiseId',
  asyncHandler(async (req, res) => {
    const franchiseId = Number(req.params.franchiseId);
    await DB.deleteFranchise(franchiseId);
    res.json({ message: 'franchise deleted' });
  })
);
```

#### Fixed code (after fix)

```js
// franchiseRouter.js
franchiseRouter.delete(
  '/:franchiseId',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    if (!req.user.isRole(Role.Admin)) {
      throw new StatusCodeError('unable to delete franchise', 403);
    }
    const franchiseId = Number(req.params.franchiseId);
    await DB.deleteFranchise(franchiseId);
    res.json({ message: 'franchise deleted' });
  })
);
```


### Attack 2 — SQL Injection via updateUser

| Item | Result |
| --- | --- |
| **Date** | April 10, 2026 |
| **Target** | pizza-service.rjspizza.click |
| **Classification** | Injection (OWASP A03:2021) |
| **Severity** | 3 — High |
| **Description** | The `updateUser` function in `database.js` builds its SQL UPDATE query via string concatenation rather than parameterized queries. Sending `{"email": "x', password='hacked' WHERE id=1 -- ", "name": "x"}` to `PUT /api/user/2` with a valid token caused the injected SQL to execute against the database. The injection successfully modified the admin account password — confirmed by the fact that subsequent login attempts to `a@jwt.com` with both the original password `admin` and the injected password `hacked` both returned `unknown user`, meaning the admin account was permanently locked out. The attack escalated from a regular diner account to corrupting the most privileged account in the system. |
| **Images** | ![Attack 2 - SQL injection payload and response](images/attack2.png) |
| **Corrections** | Rewrote `updateUser` in `database.js` to use parameterized queries with `?` placeholders, consistent with all other functions in the file. Disabled stack trace exposure in production error responses. |


### images
![Attack 2-1](attack2-1.png)
![Attack 2-2](attack2-2.png)


#### Vulnerable code (before fix)

```js
// database.js — updateUser()
if (email) {
  params.push(`email='${email}'`);  // direct string interpolation — injectable
}
if (name) {
  params.push(`name='${name}'`);    // same issue
}
const query = `UPDATE user SET ${params.join(', ')} WHERE id=${userId}`;
await this.query(connection, query);
```

#### Fixed code (after fix)

```js
// database.js — updateUser()
const params = [];
const values = [];
if (password) {
  const hashedPassword = await bcrypt.hash(password, 10);
  params.push('password=?');
  values.push(hashedPassword);
}
if (email) {
  params.push('email=?');
  values.push(email);
}
if (name) {
  params.push('name=?');
  values.push(name);
}
if (params.length > 0) {
  values.push(userId);
  await this.query(connection, `UPDATE user SET ${params.join(', ')} WHERE id=?`, values);
}
```

### Attack 3 — Client-Side Price Manipulation

| Item | Result |
| --- | --- |
| **Date** | April 10, 2026 |
| **Target** | pizza-service.rjspizza.click |
| **Classification** | Business Logic Vulnerability (OWASP A04:2021) |
| **Severity** | 3 — High |
| **Description** | The `POST /api/order` endpoint accepts item prices directly from the request body without validating them against the server-side menu. A diner account placed an order for a Veggie pizza with `"price": 0.00000001` instead of the real price of `0.0038`. The order was accepted, stored in the database, and the Pizza Factory returned a cryptographically signed JWT for the fraudulent order — meaning the factory itself endorsed the manipulated price. |
| **Corrections** | Modified `orderRouter.js` to look up each item's price from the database by `menuId` before inserting the order, discarding the client-supplied price entirely. The server-side menu price is now always used regardless of what the client sends. |

### images
![Attack 3](attack3.png)

#### Vulnerable code (before fix)

```js
// orderRouter.js — createOrder
// item.price comes directly from req.body and is stored as-is
await this.query(connection,
  `INSERT INTO orderItem (orderId, menuId, description, price) VALUES (?, ?, ?, ?)`,
  [orderId, menuId, item.description, item.price]
);
```

#### Fixed code (after fix)

```js
// orderRouter.js — createOrder
// Look up the real price from the menu table, ignore client-supplied price
const menuItem = await DB.getMenuItem(item.menuId);
await this.query(connection,
  `INSERT INTO orderItem (orderId, menuId, description, price) VALUES (?, ?, ?, ?)`,
  [orderId, menuId, item.description, menuItem.price]
);
```

---


### Attack 4 — Brute Force Login

| Item | Result |
| --- | --- |
| **Date** | April 10, 2026 |
| **Target** | pizza-service.rjspizza.click |
| **Classification** | Broken Authentication (OWASP A07:2021) |
| **Severity** | 3 — High |
| **Description** | The `PUT /api/auth` login endpoint has no rate limiting, account lockout, or brute force protection of any kind. Using Burp Suite Intruder, 10 password payloads were fired against `diner@test.com`. Two requests returned `200 OK` with a valid token (the correct password `diner123`) while the rest returned `404`. All 10 requests completed instantly with no throttling, lockout, or error. An attacker with a larger wordlist could systematically crack any account password. |
| **Corrections** | Added `express-rate-limit` middleware to the login route limiting each IP to 10 attempts per minute. Repeated failures now return `429 Too Many Requests`. |

### images
![Attack 4](attack4.png)

#### Vulnerable code (before fix)

```js
// authRouter.js — no rate limiting on login
authRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await DB.getUser(email, password);
    const auth = await setAuth(user);
    res.json({ user: user, token: auth });
  })
);
```

#### Fixed code (after fix)

```js
// authRouter.js — rate limited login
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts, please try again later' },
});

authRouter.put(
  '/',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await DB.getUser(email, password);
    const auth = await setAuth(user);
    res.json({ user: user, token: auth });
  })
);
```


### Attack 5 — IDOR on Franchise Lookup

| Item | Result |
| --- | --- |
| **Date** | April 10, 2026 |
| **Target** | pizza-service.rjspizza.click |
| **Classification** | Security Misconfiguration (OWASP A05:2021) |
| **Severity** | 1 — Low |
| **Description** | The `GET /api/franchise/:userId` endpoint returns `200 []` instead of `403` when a diner requests another user's franchise data. No sensitive data is leaked to unauthorized users — the empty array is functionally correct — but the improper status code masks the access control decision and could confuse clients or security monitoring tools into thinking the request was valid. |
| **Corrections** | Changed the unauthorized branch in `franchiseRouter.js` to throw a `403 StatusCodeError` instead of silently returning `[]`, consistent with how other protected routes handle unauthorized access. |

### images
![Attack 5](attack5.png)

#### Vulnerable code (before fix)

```js
// franchiseRouter.js — getUserFranchises
franchiseRouter.get('/:userId', authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    let result = [];
    const userId = Number(req.params.userId);
    if (req.user.id === userId || req.user.isRole(Role.Admin)) {
      result = await DB.getUserFranchises(userId);
    }
    res.json(result); // silently returns [] instead of 403
  })
);
```

#### Fixed code (after fix)

```js
// franchiseRouter.js — getUserFranchises
franchiseRouter.get('/:userId', authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    if (req.user.id !== userId && !req.user.isRole(Role.Admin)) {
      throw new StatusCodeError('unauthorized', 403);
    }
    const result = await DB.getUserFranchises(userId);
    res.json(result);
  })
);
```
pizza.pizzacs329andre.click
---