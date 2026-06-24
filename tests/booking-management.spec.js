import { test, expect } from '@playwright/test';

// playwright.config.ts sets baseURL to https://eventhub.rahulshettyacademy.com
// All page.goto() calls use relative paths so the config is the single source of truth.

const USER_EMAIL    = 'rahulshetty1@gmail.com';
const USER_PASSWORD = 'Magiclife1!';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function login(page) {
  await page.goto('/login');
  await page.getByPlaceholder('you@email.com').fill(USER_EMAIL);
  await page.getByLabel('Password').fill(USER_PASSWORD);
  await page.locator('#login-btn').click();
  // "Browse Events →" link on home page confirms successful auth
  await expect(page.getByRole('link', { name: /Browse Events/i }).first()).toBeVisible();
}

/**
 * Books the first available (non-sold-out) event.
 * Returns { bookingRef, eventTitle }.
 * Precondition: user must be logged in.
 */
async function bookFirstAvailableEvent(page) {
  await page.goto('/events');

  const firstAvailableCard = page.getByTestId('event-card').filter({
    has: page.getByTestId('book-now-btn'),
  }).first();
  await expect(firstAvailableCard).toBeVisible();

  // Fix 5: role selector (Priority 2) instead of raw 'h3' tag
  const eventTitle = (await firstAvailableCard.getByRole('heading', { level: 3 }).textContent())?.trim() ?? '';

  await firstAvailableCard.getByTestId('book-now-btn').click();
  await expect(page).toHaveURL(/\/events\/\d+/);

  await page.getByLabel('Full Name').fill('Test User');
  await page.locator('#customer-email').fill('testuser@example.com');
  await page.getByPlaceholder('+91 98765 43210').fill('9876543210');
  // Fix 2: role selector (Priority 2) instead of CSS class '.confirm-booking-btn' (Priority 5)
  await page.getByRole('button', { name: 'Confirm Booking' }).click();

  // data-testid="booking-ref" added to source (events/[id]/page.tsx:40).
  // Switch to getByTestId('booking-ref') once that source change is deployed to production.
  const refEl = page.locator('.booking-ref');
  await expect(refEl).toBeVisible();
  const bookingRef = (await refEl.textContent())?.trim() ?? '';

  console.log(`Booked "${eventTitle}" — ref: ${bookingRef}`);
  return { bookingRef, eventTitle };
}

/**
 * Removes all bookings for the logged-in user.
 * Fix 4: always calls the API — idempotent, avoids timing issues from the
 * previous isVisible() check running during React Query's loading skeleton.
 * Precondition: user must be logged in and on any page.
 */
async function clearAllBookings(page) {
  await page.goto('/bookings');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /clear all bookings/i }).click();
  await expect(page.getByText('No bookings yet')).toBeVisible();
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

test.describe('Booking Management — Critical Happy Paths', () => {

  test('TC-001: booking card appears on /bookings list after creating a booking', async ({ page }) => {
    // -- Step 1: Login and clear state --
    await login(page);
    await clearAllBookings(page);

    // -- Step 2: Book the first available event --
    const { bookingRef, eventTitle } = await bookFirstAvailableEvent(page);

    // -- Step 3: Navigate to /bookings --
    await page.goto('/bookings');

    // -- Step 4: Assert booking card with correct data --
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await expect(card).toBeVisible();
    await expect(card).toContainText(eventTitle);
    await expect(card).toContainText('confirmed');
    await expect(card).toContainText(bookingRef);
  });

  // ── TC-002 ───────────────────────────────────────────────────────────────────

  test('TC-002: booking detail page shows all five sections', async ({ page }) => {
    // -- Step 1: Login, clear state, create one booking --
    await login(page);
    await clearAllBookings(page);
    const { bookingRef, eventTitle } = await bookFirstAvailableEvent(page);

    // -- Step 2: Navigate to /bookings and click View Details --
    await page.goto('/bookings');
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // Fix 3: corrected comment (selector targets the header badge, not the breadcrumb).
    // data-testid="booking-ref-badge" added to source (bookings/[id]/page.tsx:157).
    // Switch to getByTestId('booking-ref-badge') once that source change is deployed.
    // -- Step 3: Verify booking ref badge in page header --
    await expect(page.locator('span.font-mono.font-bold').first()).toContainText(bookingRef);

    // -- Step 4: Section 1 — Event Details --
    await expect(page.getByRole('heading', { name: 'Event Details' })).toBeVisible();
    await expect(page.getByText(eventTitle).first()).toBeVisible();

    // -- Step 5: Section 2 — Customer Details --
    await expect(page.getByRole('heading', { name: 'Customer Details' })).toBeVisible();
    await expect(page.getByText('Test User')).toBeVisible();

    // -- Step 6: Section 3 — Payment Summary --
    await expect(page.getByRole('heading', { name: 'Payment Summary' })).toBeVisible();
    await expect(page.getByText('Total Paid')).toBeVisible();

    // -- Step 7: Section 4 — Refund (client-side eligibility check) --
    await expect(page.getByRole('heading', { name: 'Refund' })).toBeVisible();
    // Fix 1a: getByTestId (Priority 1) instead of locator('#check-refund-btn') (Priority 4)
    await expect(page.getByTestId('check-refund-btn')).toBeVisible();

    // -- Step 8: Section 5 — Booking Information --
    await expect(page.getByRole('heading', { name: 'Booking Information' })).toBeVisible();
    await expect(page.getByText('Booked on')).toBeVisible();

    // -- Step 9: Cancel Booking button is present (booking is 'confirmed') --
    await expect(page.getByRole('button', { name: 'Cancel Booking' })).toBeVisible();
  });

  // ── TC-003 ───────────────────────────────────────────────────────────────────

  test('TC-003: cancelling a booking from detail page shows success toast and redirects', async ({ page }) => {
    // -- Step 1: Login, clear state, create one booking --
    await login(page);
    await clearAllBookings(page);
    const { bookingRef } = await bookFirstAvailableEvent(page);

    // -- Step 2: Navigate to booking detail via View Details --
    await page.goto('/bookings');
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // -- Step 3: Click Cancel Booking --
    await page.getByRole('button', { name: 'Cancel Booking' }).click();

    // -- Step 4: React confirm dialog appears --
    await expect(page.getByText('Cancel this booking?')).toBeVisible();
    // Fix 1b: getByTestId (Priority 1) instead of locator('#confirm-dialog-yes') (Priority 4)
    await expect(page.getByTestId('confirm-dialog-yes')).toBeVisible();

    // -- Step 5: Confirm cancellation --
    await page.getByTestId('confirm-dialog-yes').click();

    // -- Step 6: Redirected to /bookings with success toast --
    await expect(page).toHaveURL(/\/bookings$/);
    await expect(page.getByText('Booking cancelled successfully')).toBeVisible();

    // -- Step 7: Booking is gone — empty state shown --
    await expect(page.getByText('No bookings yet')).toBeVisible();
  });

});
