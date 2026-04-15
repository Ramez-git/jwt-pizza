# JWT Pizza Penetration Test Report

**Testers:** RJ Gammoh, Andre Aguirre
**Date of Report:** April 10, 2026  
**Targets:** pizza.rjspizza.click, pizza.pizzacs329andre.click

---
## Myself attacks
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



# Peer attacks

## self attacks



## Attack on peer
### Peer attack 1 — Unauthenticated Franchise Delete 

| Item | Result |
| --- | --- |
| **Date** | April 10, 2026 |
| **Target** | pizza-service.pizzacs329andre.click |
| **Classification** | Broken Access Control (OWASP A01:2021) |
| **Severity** | 3 — High |
| **Description** | The `DELETE /api/franchise/:franchiseId` endpoint was missing authentication middleware entirely. Using Burp Suite Repeater, a DELETE request was sent to `/api/franchise/8` with no `Authorization` header. The server responded with HTTP `200 OK` and `{"message": "franchise deleted"}`, confirming that any unauthenticated user on the internet can permanently delete any franchise without credentials of any kind. |
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

## Peer Attacks on my website

---

| Item | Result |
| :--- | :--- |
| Date | April 10, 2026 |
| Target | pizza.rjspizza.click |
| Classification | Exploitation of Pizza Order Posting with a `diner user` token |
| Severity | 3 |
| Description| Code used
```POST /api/order HTTP/2
Host: pizza-service.rjspizza.click
Content-Length: 78
Sec-Ch-Ua-Platform: "macOS"
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwibmFtZSI6IkhhY2tlciIsImVtYWlsIjoiaEBqd3QuY29tIiwicm9sZXMiOlt7InJvbGUiOiJkaW5lciJ9XSwiaWF0IjoxNzc1ODYxODY1fQ.jSs-qFUS8gWiGtAWPZVlPWBtPLNFBG5PgwspOO0u4T8
Accept-Language: en-US,en;q=0.9
Sec-Ch-Ua: "Not-A.Brand";v="24", "Chromium";v="146"
Content-Type: application/json
Sec-Ch-Ua-Mobile: ?0
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: */*
Origin: https://pizza.rjspizza.click
Sec-Fetch-Site: same-site
Sec-Fetch-Mode: cors
Sec-Fetch-Dest: empty
Referer: https://pizza.rjspizza.click/
Accept-Encoding: gzip, deflate, br
Priority: u=1, i

{
  "items": "not-an-array",
  "storeId": "abc",
  "franchiseId": null
}
```
| Item | Result |
| :--- | :--- |
| Images | <img src="peerattack.jpeg" width="250"><br>
| Corrections | The solution below |
```
const orderReq = req.body;
    if (!orderReq.items || !Array.isArray(orderReq.items) || orderReq.items.length === 0) {
      throw new StatusCodeError('invalid order', 400);
    }
    if (!orderReq.items || !Array.isArray(orderReq.items) || orderReq.items.length > 10) {
      throw new StatusCodeError('We are sorry! Only 10 pizzas per order!', 400);
    }

    const franchises = await DB.getFranchises();
    
    const validFranchise = franchises.find(f => f.id === orderReq.franchiseId);
    if (!validFranchise) {
      throw new StatusCodeError('Invalid Franchise ID', 400);
    }

    const validStore = validFranchise.stores.find(s => s.id === orderReq.storeId);
    if (!validStore) {
      throw new StatusCodeError('Invalid Store ID for this Franchise', 400);
    }
    
    const order = await DB.addDinerOrder(req.user, orderReq);

    const factoryRequestBody = {
      diner: { id: req.user.id, name: req.user.name, email: req.user.email },
      order,
    };
```

> this code fixes the bug by requesting the franchise list, to make sure that when the order is made a valid franchiseID is used, and valid order in the menu is used.

## Combined Summary of Learnings

Each data access point is a potential data leak that should be guarder by multiple layers of authorization, which is different to authentication. Each user authenticated must have clear roles in a system, and be authorized depending on their role. 
No actions should be permitted the user is intended to make changes, which can be achieved by sanitizing inputs, outputs, and creating checks to avoid unintended actors to access sensitive information. Those who fail, will not be only placing their reputation in danger, but potentially damaging other people property. There is a big responsibility and tools like Burp help us check for these vulnerabilities.

---