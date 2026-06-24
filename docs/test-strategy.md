# Test Strategy — Booking Management

Source: `docs/test-scenarios.md` (51 scenarios)
Analyzed: `bookingService.js`, `bookingController.js`, `bookingRepository.js`, `bookingValidator.js`, `BookingCard.jsx`, `/bookings/page.tsx`, `/bookings/[id]/page.tsx`, `useBookings.ts`, existing `tests/booking-management.spec.js`

---

## 1. Layer Distribution

| Layer | Count | Primary Focus | Approx. Time |
|-------|-------|---------------|--------------|
| Unit | 3 | Pure functions with no I/O (`randomRef`, fallback ref) | ~0.1 s/test |
| API | 36 | Business rules, error contracts, validation, ownership checks | ~0.5 s/test |
| Component | 10 | UI state machines (refund eligibility, skeleton, dialogs) | ~1 s/test |
| E2E | 17 | Multi-page journeys, full-stack flows, cross-user scenarios | ~15–25 s/test |
| **Total** | **66** | (15 scenarios covered at 2 layers for defense-in-depth) | |

**Shape target:** Wide base (API), thin top (E2E). E2E covers critical journeys only; everything testable lower stays lower.

---

## 2. Unit Tests — Pure Function Logic

These functions live in `backend/src/services/bookingService.js` and have no I/O dependencies when mocked.

**File: `tests/unit/bookingRef.test.js`**

### TC-102 — Booking reference format `[A-Z]-[A-Z0-9]{6}`
**Function**: `randomRef(eventTitle)` (bookingService.js:11)
**Rationale**: Pure function — generates a string from a title. No database, no network. Testing this at E2E (as `booking-management.spec.js` currently does) burns 20+ seconds on format validation that a unit test runs in milliseconds. **Anti-pattern found — see §7.**
```
input: "Tech Summit"  → output matches /^T-[A-Z0-9]{6}$/
input: "Bollywood Night" → output matches /^B-[A-Z0-9]{6}$/
```

### TC-405 — Event title starting with a digit uses the digit as the ref prefix
**Function**: `randomRef(eventTitle)` (bookingService.js:12)
**Rationale**: Boundary case of the same pure function — no letters restriction in prefix generation. `(eventTitle?.[0] ?? 'E').toUpperCase()` returns a digit unchanged.
```
input: "1st Annual Summit" → output matches /^1-[A-Z0-9]{6}$/
```

### TC-411 — Ref collision fallback produces timestamp-based suffix
**Function**: `generateUniqueRef(eventTitle)` (bookingService.js:21–31)
**Rationale**: The fallback branch (`Date.now().toString(36).toUpperCase().slice(-8)`) produces a suffix longer than 6 chars, which breaks the normal regex. Only detectable at unit layer by mocking `bookingRepository.findByRef` to return truthy 10 times.
**Layer**: Unit (requires mock of `bookingRepository.findByRef`)

---

## 3. API Tests — Backend Business Rules & Contracts

Run against a live local backend (`http://localhost:3001`). Use HTTP clients directly (e.g., `axios`, `supertest`, or Playwright's `request` fixture). These do NOT touch the browser.

**File: `tests/api/bookings.api.test.js`**

### API Contract Tests
| ID | Scenario | Endpoint | Key Assertion |
|----|----------|----------|---------------|
| TC-012 | Lookup booking by ref | `GET /api/bookings/ref/:ref` | `200`, `data.bookingRef === ref`, `data.event` present |
| TC-013 | Paginated list metadata | `GET /api/bookings?page=1&limit=5` | `pagination.{total, page, limit, totalPages}` all present |
| TC-111 | Nested event data in response | `POST /api/bookings` then `GET /api/bookings/:id` | `data.event.title`, `.category`, `.venue`, `.city`, `.eventDate`, `.price` |

### Business Rule Tests
| ID | Scenario | Endpoint | Key Assertion |
|----|----------|----------|---------------|
| TC-101 | Ref prefix = event title first letter | `POST /api/bookings` | `data.bookingRef[0] === event.title[0].toUpperCase()` |
| TC-103 | Total price = price × qty | `POST /api/bookings` (qty=3, event @$1499) | `data.totalPrice === 4497` |
| TC-104 | Status always `confirmed` | `POST /api/bookings` | `data.status === 'confirmed'` |
| TC-110 | Booking refs are unique across calls | Create 10 bookings | All refs distinct; no duplicates |
| TC-105 | FIFO pruning: 10th booking deletes oldest | `POST /api/bookings` when count=9 | Oldest booking gone; count remains 9 |
| TC-106 | FIFO prefers deleting different-event booking | `POST /api/bookings` for Event A when 9 bookings include other events | Deleted booking's `eventId !== eventA.id` |
| TC-107 | FIFO same-event fallback burns a seat | `POST /api/bookings` for Event A when all 9 bookings are also for Event A | Oldest Event A booking deleted; `event.availableSeats` decremented |
| TC-409 | FIFO deletes by `createdAt ASC` (oldest first) | `POST /api/bookings` with 9 bookings; note oldest ref | That ref is absent after 10th booking |

**Decision rationale (TC-105, TC-106, TC-107):** FIFO pruning logic in `bookingService.createBooking` (lines 70–79) queries DB state to decide which booking to delete. This is business logic that requires a real DB transaction — Unit tests would need deep mocking and lose fidelity. API tests with a test database are the correct layer.

### Ownership / Security Tests
| ID | Scenario | Endpoint | Expected |
|----|----------|----------|----------|
| TC-202 | Cross-user GET booking | `GET /api/bookings/:userA_id` with User B JWT | `403`, `"You are not authorized..."` |
| TC-203 | Cross-user DELETE booking | `DELETE /api/bookings/:userA_id` with User B JWT | `403`, booking not deleted |
| TC-204 | Cross-user GET by ref | `GET /api/bookings/ref/:userA_ref` with User B JWT | `403`, `"You do not own this booking"` |
| TC-209 | Clear-all scoped to user | `DELETE /api/bookings` with User A JWT | User B's bookings unaffected |

### Auth Tests
| ID | Scenario | Endpoint | Expected |
|----|----------|----------|----------|
| TC-205 | No token → 401 | `GET /api/bookings` (no header) | `401`, `"Unauthorized"` |
| TC-206 | No token on create | `POST /api/bookings` (no header) | `401` |
| TC-207 | No token on clear | `DELETE /api/bookings` (no header) | `401` |
| TC-208 | Expired/invalid JWT | Any booking route | `401`, `"Invalid or expired token"` |

**Decision rationale (TC-208):** The `authMiddleware.js` catch block returns `"Invalid or expired token"` — this is pure middleware logic testable via API without any UI. Verify the exact error message string here, not at E2E.

### Validation Tests (push from E2E)
| ID | Field | Invalid Input | Expected |
|----|-------|---------------|----------|
| TC-301 | `eventId` | missing | `400`, `field: 'eventId'` |
| TC-302 | `customerName` | `"A"` (1 char) | `400`, `'at least 2 characters'` |
| TC-303 | `customerEmail` | `"not-an-email"` | `400`, `'valid email address'` |
| TC-304 | `customerPhone` | `"123456789"` (9 digits) | `400`, `'at least 10 digits'` |
| TC-305 | `quantity` | `0` | `400`, `'between 1 and 10'` |
| TC-306 | `quantity` | `11` | `400`, `'between 1 and 10'` |
| TC-307 | `quantity` | `2.5` (float) | `400`, validation error |
| TC-312 | `customerPhone` | `"abc1234567"` | `400`, regex mismatch message |
| TC-403 | `customerName` | `"Jo"` (2 chars) | `201`, booking created (boundary pass) |
| TC-404 | `customerName` | `"J"` (1 char) | `400` (boundary fail) |
| TC-408 | `customerPhone` | `"+91 (987) 654-3210"` | `201`, accepted |

**Decision rationale (TC-301–TC-312):** The `validateCreateBooking` middleware in `bookingValidator.js` runs before any service logic. Validating these at E2E requires a full browser session and booking form render, taking 15–20 s per case. At the API layer, each of these runs in < 500 ms with zero UI overhead. **Never test input validation at E2E.**

### Not-Found / Error Path Tests
| ID | Scenario | Endpoint | Expected |
|----|----------|----------|----------|
| TC-308 | Non-existent event | `POST /api/bookings` (eventId=99999) | `404`, `"Event with id 99999 not found"` |
| TC-309 | Non-existent booking | `GET /api/bookings/99999` | `404`, `"Booking with id 99999 not found"` |
| TC-310 | Non-existent ref | `GET /api/bookings/ref/Z-XXXXXX` | `404`, `'Booking with reference "Z-XXXXXX" not found'` |
| TC-311 | Insufficient seats | `POST /api/bookings` (qty > personalAvailable) | `400`, `"Only N seat(s) available, but M requested"` |
| TC-313 | Cancel non-existent | `DELETE /api/bookings/99999` | `404` |
| TC-407 | Clear when empty | `DELETE /api/bookings` | `200`, `{ deleted: 0 }` |

---

## 4. Component Tests — UI State Machines

These test React components in isolation using a component testing tool (Playwright Component Testing, React Testing Library, or Vitest + jsdom). Components receive props directly; no backend is needed.

**File: `tests/component/BookingCard.test.jsx`**, **`RefundEligibility.test.jsx`**

### RefundEligibility Component (`/bookings/[id]/page.tsx` lines 21–70)
| ID | Scenario | Props | Expected |
|----|----------|-------|----------|
| TC-009 | Ineligible result for multi-ticket | `quantity=3` → click check → wait 4s | `#refund-result` visible, text contains `"Group bookings (3 tickets) are non-refundable"` |
| TC-108 | Qty interpolated in ineligible message | `quantity=5` | Message reads `"(5 tickets)"` not a hardcoded number |
| TC-508 | Spinner visible for ~4 s then disappears | `quantity=1` → click | `#refund-spinner` visible immediately; gone after 4 s; `#refund-result` appears |
| TC-509 | Check button hidden after result shown | `quantity=1` → click → wait | `#check-refund-btn` not visible once status leaves `'idle'` |

**Decision rationale (TC-009, TC-108, TC-509):** `RefundEligibility` is a self-contained React component that takes only a `quantity` prop. Its entire logic is `setTimeout(() => setStatus(quantity === 1 ? 'eligible' : 'ineligible'), 4000)`. No API call is made. Testing this at E2E adds 20 s of booking flow overhead just to verify a component's internal state machine. Component tests run this in isolation with fake timers if needed.

### BookingCard Component (`frontend/components/bookings/BookingCard.jsx`)
| ID | Scenario | Props/Setup | Expected |
|----|----------|-------------|----------|
| TC-513 | Card renders booking ref, event title, status, qty, price | Booking object with all fields | All fields visible; badge shows `confirmed`; `View Details` and `Cancel Booking` buttons present |
| TC-510 | Confirm dialog body interpolates ref and seat count | Click `Cancel Booking` | Dialog description: `"This will cancel <ref> and release <qty> seat(s)"` |
| TC-516 | Cancel button shows loading during pending | Trigger cancel → before API resolves | `ConfirmDialog` receives `isLoading=true`; button disabled |
| TC-501 | `BookingCardSkeleton` renders pulse animation | Render `<BookingCardSkeleton />` | Animated placeholder divs present; no content |

### Bookings Page State (`frontend/app/bookings/page.tsx`)
| ID | Scenario | Mock Setup | Expected |
|----|----------|------------|----------|
| TC-503 | Error state renders retry button | Mock `useBookings` → `isError: true` | `"Couldn't load bookings"` heading; `Retry` button calls `refetch` |
| TC-504 | Clear button shows "Clearing…" during API call | Mock `bookingsApi.clearAll` to delay | Button text `"Clearing…"`, `disabled` attribute set |
| TC-314 | Booking form required fields show validation | Submit form with empty fields | Name, email, phone inputs show browser/HTML5 required validation; no network call |

**Decision rationale (TC-503, TC-504):** These test React component state driven by `useState`/`isLoading`/`isError` hooks — no database or multi-page flow required. Route-intercepting at E2E just to see a loading spinner is waste; component testing with a mocked hook is faster and more reliable.

### Detail Page State (`frontend/app/bookings/[id]/page.tsx`)
| ID | Scenario | Mock Setup | Expected |
|----|----------|------------|----------|
| TC-515 | Loading spinner shown while fetching | Mock `useBooking` → `isLoading: true` | Full-viewport `<Spinner size="lg" />` rendered |

---

## 5. E2E Tests — Multi-Page Journeys & Full-Stack Flows

Run via Playwright against `https://eventhub.rahulshettyacademy.com`. These verify the complete request-response chain. Every E2E test must be self-contained (login → setup → act → assert).

**File: `tests/booking-management.spec.js`** (extend existing)

### Critical Happy Paths (P0 — must always pass)
| ID | Scenario | Coverage Not Achievable Lower |
|----|----------|-------------------------------|
| TC-001 | Booking card appears on list after creation | Full booking form → API → React Query cache → list render |
| TC-002 | Detail page renders all five sections | Route param resolution, nested event data, all section components |
| TC-003 | Cancel from detail → toast + redirect to /bookings | `useCancelBooking` mutation → React Router push → toast system |
| TC-004 | Clear all → empty state with Browse Events link | Browser `confirm()` dialog → API → React Query invalidation → re-render |
| TC-008 | Refund eligible flow with real booking | Depends on real `quantity=1` booking data; verifies full data path from DB to component prop |

### Navigation Flows (P1)
| ID | Scenario | Why E2E |
|----|----------|---------|
| TC-005 | "View My Bookings" link on confirmation card | Post-booking confirmation card is rendered server-side + state; link target must be /bookings |
| TC-006 | "View Details" link navigates to /bookings/:id | Verifies dynamic route resolution with correct booking ID |
| TC-007 | "← Back to My Bookings" returns to list | Next.js router navigation |

### Business Rules Requiring Full Stack (P1)
| ID | Scenario | Why Not API-Only |
|----|----------|-----------------|
| TC-109 | Cancellation restores per-user seat count | `availableSeats` is computed by backend per-user (not a DB field update for dynamic events); observable by navigating back to event detail — E2E connects the cancellation to the seat re-render |
| TC-406 | Zero personal seats blocks booking UI | Frontend reads `availableSeats` from event API response and should hide/disable `Book Now` or show an error; UI behavior not verified by API test alone |
| TC-410 | Multiple bookings for same event reduce per-user seats | Verifies the full loop: book → seat drops → book again → drops further |

### Security Flow (P0)
| ID | Scenario | Why E2E |
|----|----------|---------|
| TC-201 | Cross-user booking shows "Access Denied" UI | 403 → frontend `is403` check → `EmptyState` render — requires two real browser sessions |

### Edge Case Flows (P1)
| ID | Scenario | Why E2E |
|----|----------|---------|
| TC-401 | Quantity = 10 via UI `+` button | UI quantity selector has a cap; needs browser interaction to verify the `+` button stops at 10 |
| TC-402 | Quantity = 1 + refund eligible end-to-end | Completes the loop from booking creation to refund check with real data |

### UI State / Interaction (P1–P2)
| ID | Scenario | Locator Notes |
|----|----------|---------------|
| TC-502 | Empty state after clearing all bookings | Part of TC-004 — include assertion there; no separate test needed |
| TC-505 | Browser `confirm()` dialog on clear | `page.once('dialog', d => d.accept())` — only testable with real browser |
| TC-506 | Toast "Booking cancelled successfully" | Toast system is global; verifiable in E2E after cancel mutation |
| TC-507 | Breadcrumb shows booking ref on detail | Needs real booking ref from created booking; `span.font-mono.font-bold` |
| TC-508 | Refund spinner visible for ~4 s | Per Playwright best practices §9 exception: `expect(#refund-spinner).toBeVisible()` then `not.toBeVisible({ timeout: 6000 })` |
| TC-010 | Cancel dialog dismissable (booking unchanged) | ConfirmDialog state interaction in context |
| TC-011 | Pagination on bookings list | Requires mocked API response with `totalPages > 1` via `page.route()` |
| TC-511 | "Booking not found" state at /bookings/99999 | Navigate directly; `useBooking` hook fetches and 404 renders the EmptyState |
| TC-512 | "Access Denied" state for cross-user booking | Identical to TC-201 at E2E; merge these into one cross-user test |

---

## 6. Defense-in-Depth: Critical Rules Tested at Multiple Layers

These are the highest-risk business rules. A bug here means a booking is created for the wrong user, prices are wrong, or pruning deletes the wrong record. Test at **two layers minimum**.

| Business Rule | Unit | API | E2E |
|---------------|------|-----|-----|
| Booking ref starts with event title's first letter | TC-102 ✓ | TC-101 ✓ | TC-102 (existing) |
| Total price = price × quantity | — | TC-103 ✓ | TC-002 (Payment Summary section) |
| Ownership enforced on GET/DELETE | — | TC-202, TC-203 ✓ | TC-201 ✓ |
| FIFO pruning (9-booking limit) | — | TC-105 ✓ | (TC-105 covered; E2E optional P3) |
| Cancellation result verified end-to-end | — | TC-313 (cancel non-existent) ✓ | TC-003 ✓ |
| Per-user seat availability | — | TC-311 (seats check in service) ✓ | TC-406, TC-410 ✓ |

---

## 7. Anti-Patterns Found in Existing Tests

**File: `tests/booking-management.spec.js`**

### 🔴 AP-1: Pure logic tested at E2E only (TC-102)
TC-102 validates that a booking ref matches `^[A-Z]-[A-Z0-9]{6}$`. This runs `randomRef()` — a pure string function in `bookingService.js:11`. The E2E test creates a booking, navigates, reads the UI, and asserts the format. This costs ~20 s and is a full stack test for a pure function.

**Fix**: Add a Unit test for `randomRef()` directly. Keep the E2E assertion as a secondary confidence check but don't rely on it as the primary.

### 🟡 AP-2: Hardcoded `BASE_URL` duplicates `playwright.config.ts`
```javascript
// Every test file:
const BASE_URL = 'https://eventhub.rahulshettyacademy.com';
await page.goto(`${BASE_URL}/bookings`);
```
`playwright.config.ts` already sets `baseURL`. Tests should use `page.goto('/bookings')` so that pointing tests at a local dev server requires changing one config value, not every file.

**Fix**: Remove `BASE_URL` constant; use relative paths in `page.goto()`.

### 🟡 AP-3: CSS class selectors used where IDs/testids exist
```javascript
page.locator('span.font-mono.font-bold')   // TC-002 breadcrumb
page.locator('.booking-ref')               // TC-102
page.locator('.confirm-booking-btn')       // TC-003, TC-006
```
`BookingCard.jsx` already has `data-testid="booking-card"` and `id="booking-id"`. The booking ref span in the list has `class="booking-ref"` (fragile). The confirm button in the event detail form should have a `data-testid`.

**Fix**: Use `page.getByTestId('booking-card')` (already available). For `.booking-ref`, prefer `page.locator('#booking-id')` or ask for a `data-testid="booking-ref"` attribute.

### 🟡 AP-4: No `test.describe()` grouping
All 6 tests in `booking-management.spec.js` are top-level. As the suite grows, grouping by feature area (Happy Path, Business Rules, Navigation) improves readability and allows targeted runs with `--grep`.

**Fix**: Wrap related tests in `test.describe('Booking — Happy Paths', ...)` etc.

### 🟢 AP-5 (Good pattern to keep): Self-contained state setup
Each test calls `clearBookings()` before acting. This is correct — parallel-safe (though `fullyParallel: false`) and order-independent. Keep this pattern for all new tests.

---

## 8. Test File Assignments

| File | Layer | Scenarios | Notes |
|------|-------|-----------|-------|
| `tests/unit/bookingRef.test.js` | Unit | TC-102, TC-405, TC-411 | New file; use Node test runner or Jest |
| `tests/api/bookings.api.test.js` | API | TC-012/013, TC-101/103/104/105/106/107/109/110/111, TC-202–209, TC-301–313, TC-403/404/407/408/409 | New file; use Playwright `request` fixture or supertest |
| `tests/component/BookingCard.test.jsx` | Component | TC-501, TC-510, TC-513, TC-516 | New file; React Testing Library or Playwright Component |
| `tests/component/RefundEligibility.test.jsx` | Component | TC-009, TC-108, TC-508, TC-509 | New file |
| `tests/component/BookingsPage.test.jsx` | Component | TC-314, TC-503, TC-504, TC-515 | New file |
| `tests/booking-management.spec.js` | E2E | TC-001–TC-010, TC-011, TC-109, TC-201, TC-401, TC-402, TC-406, TC-410, TC-505–TC-512 | Extend existing file |

---

## 9. Priority Execution Order

Run these in order in CI to fail fast:

1. **Unit** (< 1 s total) — `bookingRef.test.js`
2. **API** (< 20 s total) — validation, auth, business rules, error paths
3. **Component** (< 15 s total) — UI state machines
4. **E2E P0** (TC-001, TC-002, TC-003, TC-004, TC-201, TC-008) — critical journeys
5. **E2E P1** (remaining) — navigation, edge cases, UI interactions
