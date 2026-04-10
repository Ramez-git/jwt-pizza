# JWT Pizza Penetration Test Report

**Tester:** RJ Gammoh
**Peer:** Andre
**Date of Report:** April 10, 2026  
**Target:** pizza-service.rjspizza.click

---

## Self Attack

### Attack 1 — Unauthenticated Franchise Delete

| Item | Result |
| --- | --- |
| **Date** | April 10, 2026 |
| **Target** | pizza-service.rjspizza.click |
| **Classification** | Broken Access Control (OWASP A01:2021) |
| **Severity** | 3 — High |
| **Description** | The `DELETE /api/franchise/:franchiseId` endpoint was missing authentication middleware entirely. Using Burp Suite Repeater, a DELETE request was sent to `/api/franchise/1` with no `Authorization` header. The server responded with HTTP `200 OK` and `{"message": "franchise deleted"}`, confirming that any unauthenticated user on the internet can permanently delete any franchise without credentials of any kind. |
| **Corrections** | Added `authRouter.authenticateToken` middleware and an admin role check to the delete franchise route in `franchiseRouter.js`. The fixed route now requires a valid JWT token and verifies the user holds the `Admin` role before proceeding. |

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

---

## Peer Attack


---

## Combined Summary of Learnings


---