# Test Scenarios — Booking Management

Generated from: business-rules.md, user-flows.md, bookingService.js, bookingValidator.js, /bookings/page.tsx, /bookings/[id]/page.tsx

---

## Happy Path (TC-001 – TC-099)

### TC-001: Booking card appears on bookings list after creation
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Logged in as `rahulshetty1@gmail.com`; at least one event with available seats exists
**Steps**:
1. Clear all bookings via `Clear all bookings`
2. Navigate to `/events` and click `Book Now` on any available event
3. Fill Full Name, Email, Phone; click `Confirm Booking`
4. Navigate to `/bookings`
**Expected Results**: A booking card appears showing the event title, booking reference, and `confirmed` status badge
**Business Rule**: Booking creation returns status `confirmed` always; booking is immediately visible in list
**Suggested Layer**: E2E

---

### TC-002: Booking detail page shows all five sections
**Category**: Happy Path
**Priority**: P0
**Preconditions**: One confirmed booking exists for the logged-in user
**Steps**:
1. Navigate to `/bookings`
2. Click `View Details` on any booking card
3. Inspect the page
**Expected Results**:
- Breadcrumb shows `My Bookings / <bookingRef>`
- Booking ref badge and `confirmed` status badge visible in header
- Sections present: **Event Details**, **Customer Details**, **Payment Summary**, **Refund**, **Booking Information**
- `Cancel Booking` button visible
**Business Rule**: Booking detail page renders complete booking data including nested event fields
**Suggested Layer**: E2E

---

### TC-003: Cancel booking from detail page redirects and shows toast
**Category**: Happy Path
**Priority**: P0
**Preconditions**: One confirmed booking exists
**Steps**:
1. Navigate to `/bookings/:id` for an existing booking
2. Click `Cancel Booking`
3. Confirm the dialog (`Yes, cancel it`)
**Expected Results**:
- Redirected to `/bookings`
- Toast reads `Booking cancelled successfully`
- Bookings list is empty (if that was the only booking)
**Business Rule**: Cancellation deletes the booking record; seats restored (per-user seat computation)
**Suggested Layer**: E2E

---

### TC-004: Clear all bookings shows empty state
**Category**: Happy Path
**Priority**: P0
**Preconditions**: At least one booking exists
**Steps**:
1. Navigate to `/bookings`
2. Click `Clear all bookings`
3. Accept browser confirm dialog
**Expected Results**:
- Empty state: "No bookings yet" heading and "Browse Events" link visible
- `Clear all bookings` link still rendered (idempotent)
**Business Rule**: `DELETE /api/bookings` removes all user bookings in one call
**Suggested Layer**: E2E

---

### TC-005: "View My Bookings" link on confirmation card navigates to /bookings
**Category**: Happy Path
**Priority**: P1
**Preconditions**: Logged in; event with seats available exists
**Steps**:
1. Complete a booking (reach confirmation card showing the booking ref)
2. Click `View My Bookings` link on the confirmation card
**Expected Results**:
- Navigated to `/bookings`
- Booking card for the just-created booking is visible in the list
**Business Rule**: Post-booking navigation flow from confirmation card
**Suggested Layer**: E2E

---

### TC-006: Booking detail page is accessible via "View Details" link on card
**Category**: Happy Path
**Priority**: P1
**Preconditions**: One confirmed booking exists
**Steps**:
1. Navigate to `/bookings`
2. Click `View Details` on a booking card
**Expected Results**:
- URL changes to `/bookings/:id`
- Detail page header shows the booking reference matching the one from the list
**Business Rule**: Navigation from list to detail
**Suggested Layer**: E2E

---

### TC-007: "← Back to My Bookings" button navigates back to /bookings
**Category**: Happy Path
**Priority**: P2
**Preconditions**: On a booking detail page `/bookings/:id`
**Steps**:
1. Click `← Back to My Bookings`
**Expected Results**: Navigated to `/bookings`; booking list shown
**Business Rule**: Secondary navigation flow from detail page
**Suggested Layer**: E2E

---

### TC-008: Check refund eligibility — single-ticket booking shows eligible
**Category**: Happy Path
**Priority**: P0
**Preconditions**: A booking with quantity = 1 exists
**Steps**:
1. Navigate to `/bookings/:id` for the single-ticket booking
2. Click `Check eligibility for refund?`
3. Wait for spinner to finish (~4 seconds)
**Expected Results**:
- Spinner appears immediately after clicking
- After ~4 s: green result box with text `Eligible for refund. Single-ticket bookings qualify for a full refund.`
**Business Rule**: Refund eligibility — quantity === 1 → eligible (client-side, 4 s delay)
**Suggested Layer**: E2E

---

### TC-009: Check refund eligibility — multi-ticket booking shows ineligible
**Category**: Happy Path
**Priority**: P0
**Preconditions**: A booking with quantity > 1 exists
**Steps**:
1. Navigate to `/bookings/:id` for a multi-ticket booking (e.g., quantity = 3)
2. Click `Check eligibility for refund?`
3. Wait for spinner to finish (~4 seconds)
**Expected Results**:
- Red result box appears after ~4 s
- Text: `Not eligible for refund. Group bookings (3 tickets) are non-refundable.`
- Ticket count in the message matches the actual quantity
**Business Rule**: Refund eligibility — quantity > 1 → not eligible; message includes actual quantity
**Suggested Layer**: E2E

---

### TC-010: Cancel dialog is dismissable without cancelling the booking
**Category**: Happy Path
**Priority**: P1
**Preconditions**: On a booking detail page
**Steps**:
1. Click `Cancel Booking`
2. Dismiss the confirm dialog (click outside or `No` / close button)
**Expected Results**:
- Dialog closes
- Booking detail page still shown with booking unchanged (no redirect, no toast)
**Business Rule**: Cancellation requires explicit user confirmation
**Suggested Layer**: E2E

---

### TC-011: Booking list shows paginated results correctly
**Category**: Happy Path
**Priority**: P2
**Preconditions**: More than 10 bookings have been created at some point (or pagination is visible with existing bookings)
**Steps**:
1. Navigate to `/bookings`
2. If pagination controls are visible, click page 2
**Expected Results**:
- URL updates with `?page=2`
- Different set of booking cards rendered
- Pagination control reflects current page
**Business Rule**: Bookings list paginates at 10 per page (`limit: 10`)
**Suggested Layer**: E2E

---

### TC-012: Booking ref lookup by reference via API
**Category**: Happy Path
**Priority**: P1
**Preconditions**: Valid booking ref for logged-in user exists
**Steps**:
1. `GET /api/bookings/ref/<ref>` with valid JWT
**Expected Results**: `200 OK`; response body contains booking data matching the ref, including nested event
**Business Rule**: `GET /api/bookings/ref/:ref` returns single booking by reference
**Suggested Layer**: API

---

### TC-013: Bookings list API returns pagination metadata
**Category**: Happy Path
**Priority**: P2
**Preconditions**: User has at least one booking
**Steps**:
1. `GET /api/bookings?page=1&limit=5` with valid JWT
**Expected Results**: `200 OK`; `pagination` object contains `total`, `page`, `limit`, `totalPages`
**Business Rule**: Booking list endpoint returns paginated response with metadata
**Suggested Layer**: API

---

## Business Rules (TC-100 – TC-199)

### TC-101: Booking reference starts with first letter of event title (uppercase)
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Logged in; events with known titles available
**Steps**:
1. Book an event whose title starts with `T` (e.g., "Tech Conference Bangalore")
2. Capture the booking ref from the confirmation card
**Expected Results**: Booking ref matches the pattern `^T-[A-Z0-9]{6}$`
**Business Rule**: `bookingRef[0] === eventTitle[0].toUpperCase()`
**Suggested Layer**: E2E

---

### TC-102: Booking reference format is `[LETTER]-[6 ALPHANUMERIC]`
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Any booking has been created
**Steps**:
1. Capture the `bookingRef` from any booking (API or UI)
**Expected Results**: Ref matches regex `^[A-Z]-[A-Z0-9]{6}$`
**Business Rule**: `randomRef()` generates prefix + 6 uppercase alphanumeric chars
**Suggested Layer**: API

---

### TC-103: Total price equals event price × quantity
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Event with known price exists (e.g., Tech Conference @ $1499)
**Steps**:
1. Book 3 tickets for the event
2. Check `totalPrice` in the booking detail page (Payment Summary → Total Paid)
**Expected Results**: Total Paid = $1499 × 3 = $4,497
**Business Rule**: `totalPrice = parseFloat(event.price) * data.quantity`
**Suggested Layer**: E2E / API

---

### TC-104: Booking status is always `confirmed` at creation
**Category**: Business Rule
**Priority**: P1
**Preconditions**: Booking created successfully
**Steps**:
1. `POST /api/bookings` with valid payload
2. Inspect response `data.status`
**Expected Results**: `status === 'confirmed'`
**Business Rule**: `status` is hard-coded to `'confirmed'` in service; no other status transitions exist via API
**Suggested Layer**: API

---

### TC-105: FIFO pruning deletes oldest booking when 10th booking is created
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Exactly 9 bookings exist for the user; note the oldest booking's ref
**Steps**:
1. Create one more booking (the 10th)
2. Navigate to `/bookings`
**Expected Results**:
- Total booking count remains 9
- The oldest booking (noted in preconditions) is no longer present
- The newly created booking is visible
**Business Rule**: `MAX_USER_BOOKINGS = 9`; oldest booking FIFO-pruned on overflow
**Suggested Layer**: E2E / API

---

### TC-106: FIFO pruning prefers deleting from a different event than the new booking
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has 9 bookings; at least one booking is for a different event than the one being booked now
**Steps**:
1. Note which event each of the 9 bookings belongs to
2. Create a booking for Event A
3. Check which booking was pruned
**Expected Results**: The pruned booking is from an event other than Event A (if one exists), not the oldest booking for Event A
**Business Rule**: `findOldestUserBookingExcludingEvent(userId, data.eventId)` is tried first
**Suggested Layer**: API

---

### TC-107: FIFO pruning falls back to same-event deletion and permanently burns a seat
**Category**: Business Rule
**Priority**: P2
**Preconditions**: All 9 existing bookings are for the same event as the new booking
**Steps**:
1. Fill 9 bookings all for Event A
2. Book Event A again (10th)
**Expected Results**:
- The oldest Event A booking is pruned
- `availableSeats` for Event A in DB is decremented by the new quantity (permanent seat burn for static events)
- Net booking count remains 9
**Business Rule**: `sameEventFallback = true` → `eventRepository.decrementSeats()` called to preserve seat integrity
**Suggested Layer**: API

---

### TC-108: Refund message includes the exact ticket count for multi-ticket bookings
**Category**: Business Rule
**Priority**: P1
**Preconditions**: A booking with quantity = 5 exists
**Steps**:
1. Open booking detail for the 5-ticket booking
2. Click `Check eligibility for refund?` and wait ~4 s
**Expected Results**: Ineligible message reads `Group bookings (5 tickets) are non-refundable.`
**Business Rule**: Refund result text interpolates actual `quantity` from booking data
**Suggested Layer**: E2E

---

### TC-109: Cancellation restores per-user seat availability for dynamic events
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has booked a user-created (dynamic) event; note available seats before booking
**Steps**:
1. Book 2 tickets for the dynamic event; note `availableSeats` shown drops by 2
2. Navigate to the booking detail and cancel the booking
3. Navigate back to `/events/:id` for that event
**Expected Results**: Available seat count has increased back by 2 (per-user computation removes that booking's quantity)
**Business Rule**: Dynamic event seats computed as `totalSeats − sum(user's booked quantities)`; cancellation removes the quantity
**Suggested Layer**: E2E

---

### TC-110: Booking ref is globally unique
**Category**: Business Rule
**Priority**: P2
**Preconditions**: N/A
**Steps**:
1. Create 20+ bookings across multiple sessions / users
2. Collect all `bookingRef` values via API
**Expected Results**: No two booking refs are identical; DB `UNIQUE` constraint on `bookingRef` enforces this
**Business Rule**: `generateUniqueRef()` retries up to 10 times then falls back to timestamp-based ref
**Suggested Layer**: API

---

### TC-111: Booking includes nested event data in response
**Category**: Business Rule
**Priority**: P1
**Preconditions**: Booking exists
**Steps**:
1. `GET /api/bookings/:id`
**Expected Results**: Response includes `data.event` with `title`, `category`, `venue`, `city`, `eventDate`, `price`
**Business Rule**: Booking repository uses `include: { event: true }` on create and findById
**Suggested Layer**: API

---

## Security (TC-200 – TC-299)

### TC-201: Cross-user booking access shows "Access Denied" in UI
**Category**: Security
**Priority**: P0
**Preconditions**: User A has a booking; User B's credentials are available
**Steps**:
1. Log in as User A and note the booking ID (e.g., `/bookings/42`)
2. Log out (clear JWT from localStorage)
3. Log in as User B
4. Navigate to `/bookings/42`
**Expected Results**: "Access Denied" empty state shown; description: "You are not authorized to view this booking."
**Business Rule**: Service throws `ForbiddenError` when `booking.userId !== requestingUserId`
**Suggested Layer**: E2E

---

### TC-202: Cross-user booking access via API returns 403
**Category**: Security
**Priority**: P0
**Preconditions**: User A's booking ID and User B's JWT are known
**Steps**:
1. `GET /api/bookings/<userA_booking_id>` using User B's Bearer token
**Expected Results**: `403 Forbidden`; `{ success: false, error: "You are not authorized to view this booking" }`
**Business Rule**: `ForbiddenError` maps to 403 in error middleware
**Suggested Layer**: API

---

### TC-203: Cancel another user's booking via API returns 403
**Category**: Security
**Priority**: P0
**Preconditions**: User A's booking ID and User B's JWT are known
**Steps**:
1. `DELETE /api/bookings/<userA_booking_id>` using User B's Bearer token
**Expected Results**: `403 Forbidden`; booking not deleted; User A's booking still exists
**Business Rule**: `cancelBooking` checks `booking.userId !== userId` before deleting
**Suggested Layer**: API

---

### TC-204: Get booking by ref belonging to another user returns 403
**Category**: Security
**Priority**: P1
**Preconditions**: User A's booking ref and User B's JWT are known
**Steps**:
1. `GET /api/bookings/ref/<userA_ref>` using User B's Bearer token
**Expected Results**: `403 Forbidden`; `{ success: false, error: "You do not own this booking" }`
**Business Rule**: `getBookingByRef` enforces ownership check
**Suggested Layer**: API

---

### TC-205: Unauthenticated GET /api/bookings returns 401
**Category**: Security
**Priority**: P0
**Preconditions**: No auth token
**Steps**:
1. `GET /api/bookings` without `Authorization` header
**Expected Results**: `401 Unauthorized`
**Business Rule**: `authMiddleware` applied to all booking routes via `router.use(authMiddleware)`
**Suggested Layer**: API

---

### TC-206: Unauthenticated POST /api/bookings returns 401
**Category**: Security
**Priority**: P0
**Preconditions**: No auth token
**Steps**:
1. `POST /api/bookings` with valid payload but no Authorization header
**Expected Results**: `401 Unauthorized`; booking not created
**Business Rule**: Auth middleware blocks all booking route handlers
**Suggested Layer**: API

---

### TC-207: Unauthenticated DELETE /api/bookings returns 401
**Category**: Security
**Priority**: P0
**Preconditions**: No auth token
**Steps**:
1. `DELETE /api/bookings` without Authorization header
**Expected Results**: `401 Unauthorized`; no data deleted
**Business Rule**: Auth middleware blocks clear-all operation for unauthenticated callers
**Suggested Layer**: API

---

### TC-208: Expired JWT returns 401
**Category**: Security
**Priority**: P1
**Preconditions**: An expired JWT (simulated by manipulating token or waiting 7 days)
**Steps**:
1. `GET /api/bookings` with an expired or tampered JWT
**Expected Results**: `401 Unauthorized`
**Business Rule**: JWT expiry is 7 days; `authMiddleware` validates token signature and expiry
**Suggested Layer**: API

---

### TC-209: `DELETE /api/bookings` (clear all) only removes the authenticated user's bookings
**Category**: Security
**Priority**: P1
**Preconditions**: User A and User B each have at least one booking
**Steps**:
1. Call `DELETE /api/bookings` with User A's JWT
2. Check User B's bookings via `GET /api/bookings` with User B's JWT
**Expected Results**: User B's bookings are unaffected; only User A's bookings deleted
**Business Rule**: `bookingRepository.deleteAllForUser(userId)` scoped to requesting user's ID
**Suggested Layer**: API

---

## Negative / Error (TC-300 – TC-399)

### TC-301: Booking with missing `eventId` returns 400
**Category**: Negative
**Priority**: P1
**Preconditions**: Authenticated user
**Steps**:
1. `POST /api/bookings` with body `{ customerName, customerEmail, customerPhone, quantity }` — no `eventId`
**Expected Results**: `400`; `error: 'Validation failed'`; details include `field: 'eventId'`
**Business Rule**: `eventId` is required and must be a positive integer
**Suggested Layer**: API

---

### TC-302: Booking with `customerName` shorter than 2 characters returns 400
**Category**: Negative
**Priority**: P1
**Preconditions**: Authenticated user
**Steps**:
1. `POST /api/bookings` with `customerName: "A"` (1 char)
**Expected Results**: `400`; details include `field: 'customerName'`, message `'at least 2 characters'`
**Business Rule**: `customerName` min length = 2
**Suggested Layer**: API

---

### TC-303: Booking with invalid email format returns 400
**Category**: Negative
**Priority**: P1
**Preconditions**: Authenticated user
**Steps**:
1. `POST /api/bookings` with `customerEmail: "not-an-email"`
**Expected Results**: `400`; details include `field: 'customerEmail'`, message about valid email address
**Business Rule**: `customerEmail` must pass `isEmail()` validator
**Suggested Layer**: API

---

### TC-304: Booking with phone shorter than 10 digits returns 400
**Category**: Negative
**Priority**: P1
**Preconditions**: Authenticated user
**Steps**:
1. `POST /api/bookings` with `customerPhone: "123456789"` (9 digits)
**Expected Results**: `400`; details include `field: 'customerPhone'`, message `'at least 10 digits'`
**Business Rule**: `customerPhone` min length = 10
**Suggested Layer**: API

---

### TC-305: Booking with `quantity = 0` returns 400
**Category**: Negative
**Priority**: P1
**Preconditions**: Authenticated user
**Steps**:
1. `POST /api/bookings` with `quantity: 0`
**Expected Results**: `400`; details include `field: 'quantity'`, message about integer between 1 and 10
**Business Rule**: `quantity` min = 1
**Suggested Layer**: API

---

### TC-306: Booking with `quantity = 11` returns 400
**Category**: Negative
**Priority**: P1
**Preconditions**: Authenticated user
**Steps**:
1. `POST /api/bookings` with `quantity: 11`
**Expected Results**: `400`; details include `field: 'quantity'`, message about integer between 1 and 10
**Business Rule**: `quantity` max = 10
**Suggested Layer**: API

---

### TC-307: Booking with non-integer `quantity` returns 400
**Category**: Negative
**Priority**: P2
**Preconditions**: Authenticated user
**Steps**:
1. `POST /api/bookings` with `quantity: 2.5`
**Expected Results**: `400`; validation rejects fractional quantity
**Business Rule**: `quantity` must be an integer (`isInt`)
**Suggested Layer**: API

---

### TC-308: Booking for non-existent event returns 404
**Category**: Negative
**Priority**: P1
**Preconditions**: Authenticated user
**Steps**:
1. `POST /api/bookings` with `eventId: 99999` (non-existent)
**Expected Results**: `404`; `{ success: false, error: "Event with id 99999 not found" }`
**Business Rule**: Service throws `NotFoundError` if event not found for userId
**Suggested Layer**: API

---

### TC-309: Get booking with non-existent ID returns 404
**Category**: Negative
**Priority**: P1
**Preconditions**: Authenticated user
**Steps**:
1. `GET /api/bookings/99999`
**Expected Results**: `404`; `{ success: false, error: "Booking with id 99999 not found" }`
**Business Rule**: `getBookingById` throws `NotFoundError` when booking not found
**Suggested Layer**: API

---

### TC-310: Get booking by non-existent ref returns 404
**Category**: Negative
**Priority**: P1
**Preconditions**: Authenticated user
**Steps**:
1. `GET /api/bookings/ref/Z-XXXXXX` (non-existent ref)
**Expected Results**: `404`; `{ success: false, error: 'Booking with reference "Z-XXXXXX" not found' }`
**Business Rule**: `getBookingByRef` throws `NotFoundError` when ref not found
**Suggested Layer**: API

---

### TC-311: Booking when event has insufficient seats returns error
**Category**: Negative
**Priority**: P0
**Preconditions**: Event exists with exactly 1 available seat (per-user computation)
**Steps**:
1. `POST /api/bookings` with `quantity: 2` for that event
**Expected Results**: `400`; error message: `Only 1 seat(s) available, but 2 requested`
**Business Rule**: `InsufficientSeatsError` thrown when `personalAvailable < data.quantity`
**Suggested Layer**: API

---

### TC-312: Phone with alphabetic characters returns 400
**Category**: Negative
**Priority**: P2
**Preconditions**: Authenticated user
**Steps**:
1. `POST /api/bookings` with `customerPhone: "abc1234567"`
**Expected Results**: `400`; details indicate phone must contain only digits and `+`, `-`, spaces, or parentheses
**Business Rule**: `customerPhone` must match `/^[0-9+\-\s()]+$/`
**Suggested Layer**: API

---

### TC-313: Cancel non-existent booking returns 404
**Category**: Negative
**Priority**: P1
**Preconditions**: Authenticated user
**Steps**:
1. `DELETE /api/bookings/99999`
**Expected Results**: `404`; `{ success: false, error: "Booking with id 99999 not found" }`
**Business Rule**: `cancelBooking` uses `findById(id, userId)` which returns null for missing records
**Suggested Layer**: API

---

### TC-314: Missing required fields in booking form — UI validation
**Category**: Negative
**Priority**: P1
**Preconditions**: On `/events/:id` booking form page
**Steps**:
1. Click `Confirm Booking` without filling any fields
**Expected Results**: Form does not submit; field validation messages visible for Name, Email, Phone
**Business Rule**: Frontend validation before API call; required fields enforced client-side too
**Suggested Layer**: E2E

---

## Edge Cases (TC-400 – TC-499)

### TC-401: Booking with quantity = 10 (maximum) succeeds
**Category**: Edge Case
**Priority**: P1
**Preconditions**: Event with ≥10 available seats exists
**Steps**:
1. Navigate to event detail page
2. Increment ticket count to 10 using `+` button
3. Fill customer form and submit
**Expected Results**: Booking created successfully; `totalPrice = eventPrice × 10`; ref generated correctly
**Business Rule**: `quantity` max = 10; `+` button should cap at 10
**Suggested Layer**: E2E

---

### TC-402: Booking with quantity = 1 (minimum) succeeds and is refund-eligible
**Category**: Edge Case
**Priority**: P1
**Preconditions**: Event with seats available exists
**Steps**:
1. Book 1 ticket (default quantity)
2. Check refund eligibility on detail page
**Expected Results**: Booking succeeds; refund check returns eligible after spinner
**Business Rule**: Minimum quantity = 1; `quantity === 1` → eligible for refund
**Suggested Layer**: E2E

---

### TC-403: `customerName` with exactly 2 characters is accepted
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Authenticated user
**Steps**:
1. `POST /api/bookings` with `customerName: "Jo"`
**Expected Results**: `201 Created`; booking created
**Business Rule**: `customerName` min length = 2 (inclusive boundary)
**Suggested Layer**: API

---

### TC-404: `customerName` with exactly 1 character is rejected
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Authenticated user
**Steps**:
1. `POST /api/bookings` with `customerName: "J"`
**Expected Results**: `400`; validation error for `customerName`
**Business Rule**: Min length boundary — 1 char is below minimum of 2
**Suggested Layer**: API

---

### TC-405: Event title starting with a digit — booking ref uses the digit as prefix
**Category**: Edge Case
**Priority**: P2
**Preconditions**: An event exists with a title starting with a digit (e.g., "1st Annual Summit")
**Steps**:
1. Book the event; capture booking ref
**Expected Results**: Booking ref starts with `1-` (digit prefix preserved)
**Business Rule**: `prefix = (eventTitle?.[0] ?? 'E').toUpperCase()` — no restriction to letters only
**Suggested Layer**: API

---

### TC-406: Booking when personal available seats = 0 is blocked
**Category**: Edge Case
**Priority**: P0
**Preconditions**: User has already booked all available seats for an event (per-user computation = 0)
**Steps**:
1. Book all remaining personal seats for an event
2. Attempt to book 1 more ticket for the same event
**Expected Results**: API returns error `Only 0 seat(s) available, but 1 requested`; UI shows appropriate error
**Business Rule**: `personalAvailable = max(0, event.availableSeats - userBooked)`; blocks when `personalAvailable < quantity`
**Suggested Layer**: E2E / API

---

### TC-407: Clear all bookings when list is already empty — no error
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has 0 bookings
**Steps**:
1. `DELETE /api/bookings` via API
**Expected Results**: `200 OK`; `{ deleted: 0 }` — operation is idempotent, no error thrown
**Business Rule**: `deleteAllForUser` returns count; 0 is valid
**Suggested Layer**: API

---

### TC-408: Phone with valid special characters (+, -, spaces, parentheses) is accepted
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Authenticated user
**Steps**:
1. `POST /api/bookings` with `customerPhone: "+91 (987) 654-3210"` (≥10 chars of digits + valid special chars)
**Expected Results**: `201 Created`; phone stored and returned in booking
**Business Rule**: `customerPhone` regex `/^[0-9+\-\s()]+$/` allows these characters
**Suggested Layer**: API

---

### TC-409: FIFO pruning — oldest booking deleted, not the most recently created
**Category**: Edge Case
**Priority**: P1
**Preconditions**: 9 bookings exist; note creation timestamps (oldest booking ref identified)
**Steps**:
1. Create a 10th booking
2. Check the bookings list
**Expected Results**: The booking with the earliest `createdAt` is gone; the 9th most recent remain
**Business Rule**: `findOldestUserBookingExcludingEvent` orders by `createdAt ASC`
**Suggested Layer**: API

---

### TC-410: Multiple bookings for the same event count toward per-user available seats
**Category**: Edge Case
**Priority**: P1
**Preconditions**: Dynamic event exists with 10 total seats
**Steps**:
1. Book 3 tickets for the event; note displayed available seats drop to 7
2. Book 4 more tickets for the same event; check available seats again
**Expected Results**: Available seats = 10 − 3 − 4 = 3 (per-user computation accumulates across bookings)
**Business Rule**: `getBookedQuantitiesForEvents` sums all user quantities for an event
**Suggested Layer**: E2E / API

---

### TC-411: Booking ref fallback format used after 10 collision retries
**Category**: Edge Case
**Priority**: P3
**Preconditions**: Requires mocking — 10 consecutive ref collisions
**Steps**:
1. Mock `bookingRepository.findByRef` to always return an existing record for 10 attempts
2. Create a booking
**Expected Results**: Booking created with ref format `<PREFIX>-<timestamp base-36 last 8 chars>` (longer than 6 chars)
**Business Rule**: `generateUniqueRef` falls back to `Date.now().toString(36).toUpperCase().slice(-8)` after 10 misses
**Suggested Layer**: Unit

---

## UI State (TC-500 – TC-599)

### TC-501: Bookings list shows skeleton placeholders while loading
**Category**: UI State
**Priority**: P2
**Preconditions**: Network throttled or API response delayed
**Steps**:
1. Throttle network to slow 3G
2. Navigate to `/bookings`
**Expected Results**: 5 `BookingCardSkeleton` placeholders appear while data loads; replaced by real cards on completion
**Business Rule**: `isLoading` state renders skeletons before data arrives
**Suggested Layer**: E2E (with network throttling)

---

### TC-502: Empty state shown with "Browse Events" link when no bookings exist
**Category**: UI State
**Priority**: P1
**Preconditions**: User has no bookings
**Steps**:
1. Clear all bookings (if any)
2. Navigate to `/bookings`
**Expected Results**:
- Heading: `No bookings yet`
- Description visible
- `Browse Events` button/link present and navigates to `/events`
**Business Rule**: `bookings.length === 0` branch renders `EmptyState` component
**Suggested Layer**: E2E

---

### TC-503: Error state shown with Retry button when API fails to load bookings
**Category**: UI State
**Priority**: P2
**Preconditions**: Backend API is unreachable (simulated)
**Steps**:
1. Block `/api/bookings` network request
2. Navigate to `/bookings`
**Expected Results**: `EmptyState` with title `Couldn't load bookings` and `Retry` button; clicking Retry re-fetches
**Business Rule**: `isError` branch in `BookingsContent` renders error empty state with retry action
**Suggested Layer**: E2E (with network mocking)

---

### TC-504: "Clear all bookings" button shows "Clearing…" and is disabled during operation
**Category**: UI State
**Priority**: P2
**Preconditions**: At least one booking exists; network throttled
**Steps**:
1. Throttle network
2. Click `Clear all bookings` and accept confirm dialog
3. Observe button state during API call
**Expected Results**: Button text changes to `Clearing…` and becomes `disabled` until API responds
**Business Rule**: `clearing` state drives `disabled` prop and button label
**Suggested Layer**: E2E (with network throttling)

---

### TC-505: Native browser confirm dialog appears before clearing all bookings
**Category**: UI State
**Priority**: P1
**Preconditions**: At least one booking exists
**Steps**:
1. Navigate to `/bookings`
2. Click `Clear all bookings`
**Expected Results**: Browser `confirm()` dialog appears with message `Clear all your bookings? This cannot be undone.`; dismissing it leaves bookings intact
**Business Rule**: `handleClearAll` calls `confirm(...)` before the API call; false return aborts
**Suggested Layer**: E2E

---

### TC-506: Toast "Booking cancelled successfully" appears after cancellation
**Category**: UI State
**Priority**: P0
**Preconditions**: On a booking detail page
**Steps**:
1. Click `Cancel Booking` → confirm dialog → `Yes, cancel it`
**Expected Results**: Green success toast `Booking cancelled successfully` appears briefly; user redirected to `/bookings`
**Business Rule**: `useCancelBooking` `onSuccess` calls `toast('Booking cancelled successfully', 'success')`
**Suggested Layer**: E2E

---

### TC-507: Breadcrumb on booking detail page shows booking ref
**Category**: UI State
**Priority**: P2
**Preconditions**: On `/bookings/:id`
**Steps**:
1. Observe breadcrumb navigation bar
**Expected Results**: `My Bookings / <bookingRef>` — ref visible in monospace font; `My Bookings` is a clickable link to `/bookings`
**Business Rule**: Breadcrumb renders `booking.bookingRef` inside `<span className="font-mono">`
**Suggested Layer**: E2E

---

### TC-508: Refund spinner is visible for approximately 4 seconds
**Category**: UI State
**Priority**: P1
**Preconditions**: On booking detail page; refund check not yet performed
**Steps**:
1. Click `Check eligibility for refund?`
2. Immediately observe for spinner element
3. Observe after 4 seconds
**Expected Results**:
- `#refund-spinner` is visible immediately after click
- After ~4 s spinner disappears and `#refund-result` becomes visible
**Business Rule**: `setTimeout(..., 4000)` controls delay; spinner tied to `status === 'checking'`
**Suggested Layer**: E2E

---

### TC-509: Refund button disappears after result is shown (one-time check)
**Category**: UI State
**Priority**: P2
**Preconditions**: On booking detail page; refund check not yet started
**Steps**:
1. Click `Check eligibility for refund?`
2. Wait for result to appear
**Expected Results**: The `Check eligibility for refund?` link is no longer visible (only shown in `status === 'idle'` state); result is shown instead
**Business Rule**: Refund component has 4 mutually exclusive `status` states: idle / checking / eligible / ineligible
**Suggested Layer**: E2E

---

### TC-510: Confirm dialog body includes booking ref and seat count
**Category**: UI State
**Priority**: P1
**Preconditions**: On booking detail page for a booking of 3 tickets with a known ref
**Steps**:
1. Click `Cancel Booking`
2. Inspect dialog body text
**Expected Results**: Dialog description reads `Cancelling <bookingRef> will release 3 seat(s) back to the event. This cannot be undone.`
**Business Rule**: `ConfirmDialog` `description` prop interpolates `booking.bookingRef` and `booking.quantity`
**Suggested Layer**: E2E

---

### TC-511: Booking detail "Booking not found" state for non-existent ID in browser
**Category**: UI State
**Priority**: P1
**Preconditions**: Logged in
**Steps**:
1. Navigate to `/bookings/99999` (non-existent)
**Expected Results**: `EmptyState` with title `Booking not found`; description: `This booking doesn't exist or may have been cancelled.`; `View My Bookings` button present
**Business Rule**: Non-404/403 error or null booking renders generic not-found state
**Suggested Layer**: E2E

---

### TC-512: Booking detail "Access Denied" state for cross-user access in browser
**Category**: UI State
**Priority**: P0
**Preconditions**: User B is viewing User A's booking URL
**Steps**:
1. Navigate to `/bookings/<userA_id>` while logged in as User B
**Expected Results**: `EmptyState` with title `Access Denied`; description: `You are not authorized to view this booking.`
**Business Rule**: Frontend detects `error.status === 403` and renders "Access Denied" empty state
**Suggested Layer**: E2E

---

### TC-513: Booking card displays event name, status badge, and booking ref
**Category**: UI State
**Priority**: P1
**Preconditions**: At least one booking exists on `/bookings`
**Steps**:
1. Navigate to `/bookings`
2. Inspect a booking card
**Expected Results**: Card shows event title, `confirmed` status badge (green), booking reference, and `View Details` link
**Business Rule**: `BookingCard` component renders core booking fields from the list API response
**Suggested Layer**: E2E

---

### TC-514: Pagination controls appear on /bookings when total exceeds page limit
**Category**: UI State
**Priority**: P2
**Preconditions**: User has more than 10 bookings (or pagination is present in API response with totalPages > 1)
**Steps**:
1. Navigate to `/bookings`
**Expected Results**: `Pagination` component is rendered; current page is highlighted; next/prev controls work
**Business Rule**: `pagination && <Pagination>` rendered only when pagination data exists from API
**Suggested Layer**: E2E

---

### TC-515: Loading spinner shown on booking detail page before data arrives
**Category**: UI State
**Priority**: P3
**Preconditions**: Network throttled
**Steps**:
1. Throttle network
2. Navigate to `/bookings/:id`
**Expected Results**: Full-viewport centered `Spinner` component shown while `isLoading` is true; replaced by detail content on load
**Business Rule**: `if (isLoading) return <Spinner size="lg" />`
**Suggested Layer**: E2E (with network throttling)

---

### TC-516: Cancel booking during pending state shows loading on confirm button
**Category**: UI State
**Priority**: P2
**Preconditions**: On booking detail page; network throttled
**Steps**:
1. Click `Cancel Booking`; confirm dialog opens
2. Click `Yes, cancel it`; observe button before API responds
**Expected Results**: Confirm button shows loading state (`isLoading={isPending}` prop); user cannot double-click
**Business Rule**: `useCancelBooking` returns `isPending`; passed to `ConfirmDialog` `isLoading` prop
**Suggested Layer**: E2E (with network throttling)
