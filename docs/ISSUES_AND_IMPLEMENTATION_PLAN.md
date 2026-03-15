# UrbanPro V2 — Complete Issues, Bugs & Implementation Plan

> **Audit Date:** March 4, 2026  
> **Scope:** Full-stack analysis — Server (Node/Express/Prisma), Client (React/Vite/TanStack Query), Database (PostgreSQL)  
> **Total Findings:** 100+

---

## Table of Contents

- [Part 1: Multi-Day Session Architecture (from error.md)](#part-1-multi-day-session-architecture)
- [Part 2: Server-Side Issues](#part-2-server-side-issues)
  - [2A. Bugs](#2a-bugs)
  - [2B. Security Issues](#2b-security-issues)
  - [2C. Race Conditions](#2c-race-conditions)
  - [2D. Missing Error Handling](#2d-missing-error-handling)
  - [2E. API Inconsistencies](#2e-api-inconsistencies)
  - [2F. Dead Code / Redundancies](#2f-dead-code--redundancies)
  - [2G. Architectural Issues](#2g-architectural-issues)
  - [2H. Data Model Issues](#2h-data-model-issues)
- [Part 3: Client-Side Issues](#part-3-client-side-issues)
  - [3A. Frontend Bugs](#3a-frontend-bugs)
  - [3B. Security Issues](#3b-frontend-security-issues)
  - [3C. UI Inconsistencies](#3c-ui-inconsistencies)
  - [3D. Missing States / Functionality Gaps](#3d-missing-states--functionality-gaps)
  - [3E. Accessibility Issues](#3e-accessibility-issues)
  - [3F. Performance Issues](#3f-performance-issues)
  - [3G. Frontend Redundancies](#3g-frontend-redundancies)
  - [3H. Hardcoded Values](#3h-hardcoded-values)
  - [3I. Frontend-Backend Mismatches](#3i-frontend-backend-mismatches)
- [Part 4: Booking System Architectural Gaps](#part-4-booking-system-architectural-gaps)
- [Part 5: Implementation & Workflow Plan](#part-5-implementation--workflow-plan)

---

## Progress Checklist

### Phase 1: Critical Security Fixes
- [x] 1.1 Secure Socket.IO — reject unauthenticated connections, validate room joins
- [x] 1.2 Replace `Math.random()` OTP with `crypto.randomInt()`
- [x] 1.3 Add rate limiting on OTP endpoints + lockout after failures
- [x] 1.4 Reject SVG uploads / add sanitization
- [x] 1.5 Add authentication to `/location/nearby` endpoint
- [x] 1.6 Move database URL to `env("DATABASE_URL")`
- [x] 1.7 Serve uploads through authenticated route or signed URLs
- [x] 1.8 Remove `VITE_UI_PREVIEW_MODE` bypass from production builds
- [x] 1.9 Restrict CORS localhost to development only
- [x] 1.10 Validate `profilePhotoUrl` — only accept from upload endpoint

### Phase 2: Bug Fixes & Error Handling
- [x] 2.1 Replace `res.status(X); throw new Error` with `throw new AppError(X, '...')`
- [x] 2.2 Wrap `createBooking` in `prisma.$transaction()`
- [x] 2.3 Add `parseInt` NaN validation to all controllers
- [x] 2.4 Fix `isWorkerAvailable` to use transaction handle `tx`
- [x] 2.5 Wrap `createReview` rating recalculation in transaction
- [x] 2.6 Wrap `reviewApplication` in transaction
- [x] 2.7 Standardize ALL services to use `AppError` (not plain `Error`)
- [x] 2.8 Standardize error response format
- [x] 2.9 Fix `listMyPayments` for workers
- [x] 2.10 Add try/catch to `chat.service.js` `getIo()`
- [x] 2.11 Add `SIGINT`/`SIGTERM` graceful shutdown
- [x] 2.12 Fix `BookingStatusBadge` `accent` variant
- [x] 2.13 Fix password validation mismatch (Login min(6) vs Server min(8))
- [x] 2.14 Fix `useKeyboardShortcuts` infinite re-render
- [x] 2.15 URL-encode email verification token

### Phase 3: API & Architecture Cleanup
- [x] 3.1 Convert location/notification controllers to `asyncHandler`
- [x] 3.2 Add validation schemas to admin endpoints
- [x] 3.3 Add validation to emergency contact CRUD
- [x] 3.4 Add chat message length/content validation
- [x] 3.5 Add pagination to ALL list endpoints
- [x] 3.6 Deduplicate registration logic
- [x] 3.7 Extract worker profile lookup helper
- [x] 3.8 Add `scheduledAt` and `paymentStatus` indexes
- [x] 3.9 Fix cascade rules for `EmergencyContact`, `BookingPhoto`, `Payment`
- [x] 3.10 Add unique constraint on `Availability(workerId, dayOfWeek, startTime, endTime)`
- [x] 3.11 Create proper `SOSAlert.triggeredBy` foreign key relation
- [x] 3.12 Add `estimatedDuration` field to Booking model

### Phase 4: Frontend Consistency & Quality
- [x] 4.1 Replace all raw HTML inputs with common components
- [x] 4.2 Replace `window.confirm()` with `ConfirmDialog`
- [x] 4.3 Replace `DollarSign` with `IndianRupee` icon
- [x] 4.4 Create `api/notifications.js` and `api/chat.js`
- [x] 4.5 Fix `publicPaths` in axios interceptor
- [x] 4.6 Centralize all inline API calls to `api/` layer
- [x] 4.7 Standardize query keys to use `queryKeys` utility
- [x] 4.8 Fix dark-mode unconditional card in WorkerDashboard
- [x] 4.9 Fix grid-cols-3 with 2 cards
- [x] 4.10 Fix USD pricing/contact placeholders
- [x] 4.11 Remove dead exports and unused code
- [x] 4.12 Use `useLocation()` instead of global `location`
- [x] 4.13 Add `useMemo` to AuthContext value
- [x] 4.14 Add file size validation to `ImageUpload`

### Phase 5: Frontend DRY (Deduplication)
- [x] 5.1 Create `<OtpVerificationModal>` shared component
- [x] 5.2 Create `useBookingActions` hook
- [x] 5.3 Create `<CancellationModal>` shared component
- [x] 5.4 Replace manual socket boilerplate with `useSocketEvent`
- [x] 5.5 Replace `isDark ? '...' : '...'` with Tailwind `dark:` modifier
- [x] 5.6 Extract loading spinner from ProtectedRoute to shared component
- [x] 5.7 Break down large components (870+ lines) into sub-components

### Phase 6: Accessibility & Performance
- [x] 6.1 Add ARIA roles to tab controls, filter chips
- [x] 6.2 Add labels to OTP inputs
- [x] 6.3 Add text/icon alternatives to color-only indicators
- [x] 6.4 Add focus trap and restore-focus to `Modal`
- [x] 6.5 Add skip-to-content link in `MainLayout`
- [x] 6.6 Make `StarRating` keyboard accessible
- [x] 6.7 Add route-level code splitting with `React.lazy` + `Suspense`
- [x] 6.8 Add `React.memo` to list-item components
- [x] 6.9 Replace CSS `dangerouslySetInnerHTML` with proper stylesheet
- [x] 6.10 Disable polling when tab is inactive
- [x] 6.11 Only connect socket for authenticated users

### Phase 7: Session-Based Booking Architecture
- [x] 7.1 Create `BookingSession` model in Prisma schema
- [x] 7.2 Add migration and seed data
- [x] 7.3 Implement session CRUD in `booking.service.js`
- [x] 7.4 Update `isWorkerAvailable` to session-aware logic
- [x] 7.5 Add "Pause / Next Visit" worker action (API + UI)
- [x] 7.6 Add daily re-verification OTP per session
- [x] 7.7 Add overrun detection and customer notification
- [x] 7.8 Add booking timeout / auto-expiry for PENDING
- [x] 7.9 Add cancellation policy / penalty logic
- [x] 7.10 Add rescheduling mechanism
- [x] 7.11 Add booking status audit trail (`BookingStatusHistory` model)
- [x] 7.12 Customer UI: "Next visit scheduled" display
- [x] 7.13 Worker UI: Session management panel

---

## Sprint 3 Completion Summary

- All core MVP features are fully implemented and error-free.
- Trust & Safety features (OTP verification, SOS, partial KYC, partial photo proof) are integrated and working.
- Real-time notifications, browser push, notification inbox, and preferences are complete.
- Refund and cancellation policy logic is implemented and tested.
- Frontend and backend are fully integrated, with no errors found in build/lint checks.
- Redis setup is running and confirmed; Docker is optional for local-only parity.

**Ready to begin Sprint 4: Database & Infrastructure Hardening, Worker Location Tracking, and Payment Integration.**

---

## Part 1: Multi-Day Session Architecture

> Source: `error.md` — This describes the core architectural change needed to support multi-day jobs.

### Problem Statement
When a job is `IN_PROGRESS` for 3 days, the current system treats the worker as busy for 72 hours straight. This unfairly locks their entire calendar.

### Proposed Solution: Session-Based Booking

#### 1.1 Active Session Toggle
- **Active:** Worker is on-site → Availability = Blocked
- **On-Hold / Between Visits:** Worker has started work but is waiting (paint drying, parts arriving, next morning) → Availability = Open for other jobs

#### 1.2 Follow-up Visit Scheduling
- Worker clicks "Pause / Next Visit" → picks a date/time for next session
- Booking stays `IN_PROGRESS`
- System creates a "Soft Block" on worker's calendar for the new time slot
- Worker is free to accept other PENDING requests for gaps in between
- Customer sees: "Job Started - Next visit scheduled for Tomorrow at 10 AM"

#### 1.3 Smart Availability Filtering
- **Old Logic:** `if (status === 'IN_PROGRESS') return false;` — Too restrictive
- **New Logic:** `if (status === 'IN_PROGRESS' && session.isActive) return false;`
- Worker is only "unavailable" during specific committed hours

#### 1.4 Overrun Handling (Unexpected Delays)
- If a 2-hour job takes 6 hours: worker doesn't click "End Session"
- System auto-suggests to later customers: "Your professional is slightly delayed. New ETA: +45 mins"
- Builds trust through transparency

#### 1.5 Daily Re-Verification for Multi-Day Jobs
- **Recommended:** Fresh "Start OTP" every morning the worker returns
- When proximity check passes, worker asks for a "Session Start OTP"
- Ensures customer knows exactly when worker entered their home each day

#### 1.6 Required Schema Changes
```prisma
model BookingSession {
  id          Int       @id @default(autoincrement())
  bookingId   Int
  booking     Booking   @relation(fields: [bookingId], references: [id])
  sessionDate DateTime
  startTime   DateTime?
  endTime     DateTime?
  isActive    Boolean   @default(false)
  startOtp    String?
  otpVerified Boolean   @default(false)
  notes       String?
  createdAt   DateTime  @default(now())
  
  @@index([bookingId])
  @@index([sessionDate])
}
```

---

## Part 2: Server-Side Issues

### 2A. Bugs

#### 2A-1. `res.status(X); throw new Error(...)` Produces HTTP 500
**Severity:** HIGH  
**Files:** `booking.controller.js`, `safety.controller.js`

The error handler (`errorHandler.js`) determines status from `err.statusCode || err.status || 500`. A plain `Error` object has neither property, so ALL of these return **500** instead of the intended status:

| File | Intended Status |
|---|---|
| `booking.controller.js` — profile check | 403 |
| `booking.controller.js` — getOpenBookings | 403 |
| `booking.controller.js` — acceptBooking | 403 |
| `booking.controller.js` — verifyBookingStart | 400 |
| `booking.controller.js` — verifyBookingCompletion | 400 |
| `safety.controller.js` — triggerSOS | 400 |
| `safety.controller.js` — updateSosAlertStatus | 400 |

**Fix:** Replace `res.status(X); throw new Error('...')` with `throw new AppError(X, '...')`.

#### 2A-2. `createBooking` Is NOT in a Transaction
**Severity:** HIGH  
**File:** `booking.service.js` (line ~143)

The comment says "Create booking with transaction to ensure atomicity" but the actual code is a plain `prisma.booking.create()`. The `isWorkerAvailable` check runs in a separate query, so between the check and the create, the slot can be double-booked.

**Fix:** Wrap the availability check + creation in `prisma.$transaction()`.

#### 2A-3. `parseInt(req.params.id)` Without NaN Validation
**Severity:** MEDIUM  
**File:** `booking.controller.js` (6+ locations)

If the URL param is non-numeric (e.g., `/api/bookings/abc`), `parseInt` returns `NaN`, causing unhelpful Prisma errors. Compare with `service.controller.js` which correctly validates with `Number.isNaN(id)`.

**Fix:** Add `if (Number.isNaN(id)) throw new AppError(400, 'Invalid booking ID');` after every `parseInt`.

#### 2A-4. Distance Calculation Ignores Longitude Scaling
**Severity:** LOW  
**File:** `booking.service.js` (lines 146-149)

Uses `111 km/degree` for BOTH latitude and longitude. For longitude, the correct factor is `111 * cos(latitude)`. At 20°N (Mumbai), east-west distance is overestimated by ~6%. `location.service.js` correctly accounts for this — inconsistent.

**Fix:** Use Haversine formula or at minimum `111 * Math.cos(lat * Math.PI / 180)` for longitude.

#### 2A-5. `listMyPayments` Only Works for Customers
**Severity:** MEDIUM  
**File:** `payment.service.js`

The route allows `CUSTOMER` and `WORKER` roles, but the service filters by `customerId: userId`. Workers always get empty results.

**Fix:** Branch on role — workers should query by `booking.workerProfile.userId`.

#### 2A-6. `chat.service.js` — `getIo()` Called Without Try/Catch
**Severity:** MEDIUM  
**File:** `chat.service.js` (line ~72)

Unlike other modules, `getIo()` is unguarded. If Socket.IO isn't initialized, this crashes the entire message send operation, losing the message even though it was already persisted.

**Fix:** Wrap in try/catch like other modules.

---

### 2B. Security Issues

#### 2B-1. CRITICAL: Unauthenticated Socket Clients Can Join ANY Room
**Severity:** CRITICAL  
**File:** `socket.js`

```js
if (!token) return next(); // Allows unauthenticated connections
socket.on('joinRoom', (room) => {
  if (typeof room === 'string') socket.join(room); // No authorization check
});
```

Any unauthenticated websocket client can connect, then emit `joinRoom('admin')` and receive ALL admin events: SOS alerts with GPS, user data, booking data.

**Fix:** Reject unauthenticated connections. Validate room membership based on user role/ID.

#### 2B-2. CRITICAL: OTPs Generated with `Math.random()`
**Severity:** CRITICAL  
**File:** `booking.service.js` (line 22)

`Math.random()` is not cryptographically secure. OTPs are used for job start/completion verification.

**Fix:** Use `crypto.randomInt(1000, 10000)`.

#### 2B-3. HIGH: No Rate Limiting on OTP Verification
**Severity:** HIGH  
**File:** `booking.routes.js`

OTP endpoints (`POST /:id/start`, `POST /:id/complete`) have no rate limiting. With 9,000 possible 4-digit OTPs and no lockout, an attacker can brute-force in seconds.

**Fix:** Add progressive rate limiting (e.g., 5 attempts per 15 min) + temporary lockout after 3 failures.

#### 2B-4. HIGH: SVG Upload Allows Stored XSS
**Severity:** HIGH  
**File:** `upload.routes.js`

The file filter accepts any `image/*` MIME type, including `image/svg+xml`. SVGs can contain `<script>` tags. Files are served statically, allowing JavaScript execution.

**Fix:** Explicitly reject `image/svg+xml` or sanitize SVGs.

#### 2B-5. HIGH: Nearby Workers Endpoint Is Public & Unprotected
**Severity:** HIGH  
**File:** `location.routes.js`

`GET /nearby` requires no auth and has no rate limiting. Anyone can query real-time worker locations.

**Fix:** Require authentication + rate limiting.

#### 2B-6. Database Credentials Hardcoded in Schema
**Severity:** HIGH  
**File:** `schema.prisma` (line 10)

```prisma
url = "postgresql://postgres:toor@localhost:5432/urbanpro_v2?schema=public"
```

**Fix:** Change to `url = env("DATABASE_URL")`.

#### 2B-7. Password Reset Link Returned from Service Layer
**Severity:** MEDIUM  
**File:** `auth.service.js` (line ~156)

The reset link (containing the secret token) is returned from the service. If any code serializes this response (logging, error reports), the token leaks.

**Fix:** Send the email directly from the service; don't return the link.

#### 2B-8. No Password Complexity Requirements
**Severity:** MEDIUM  
**File:** `auth.schemas.js`

Only requires `min(8)` — no uppercase, lowercase, digits, or special character requirements.

**Fix:** Add complexity validation.

#### 2B-9. `profilePhotoUrl` Accepted from Request Body — URL Injection
**Severity:** MEDIUM  
**Files:** `worker.controller.js`, `customer.controller.js`

Both accept `profilePhotoUrl` as a plain string, allowing attackers to set arbitrary URLs (tracking pixels, phishing pages, offensive content), bypassing upload validation.

**Fix:** Only accept photo URLs from the upload endpoint; reject raw URLs.

#### 2B-10. CORS Allows Localhost in Production
**Severity:** MEDIUM  
**File:** `cors.js`

```js
const allowedOrigins = [CORS_ORIGIN, 'http://localhost:5173', 'http://localhost:5174'];
```

Localhost origins are always included regardless of environment.

**Fix:** Only include localhost origins in development.

#### 2B-11. No Validation on Chat Message Content
**Severity:** MEDIUM  
**File:** `chat.controller.js`

No sanitization or length validation on message `content`. Allows DB bloat, DoS, and potential XSS.

**Fix:** Add length limits, input sanitization.

#### 2B-12. Uploads Publicly Accessible Without Auth
**Severity:** HIGH  
**File:** `index.js`

```js
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));
```

All uploaded files (including verification documents / ID proofs) are publicly accessible.

**Fix:** Serve uploads through an authenticated route, or use signed URLs.

#### 2B-13. Emergency Contact CRUD Has No Validation
**Severity:** MEDIUM  
**File:** `safety.routes.js`

`POST /contacts` has no validation schema — arbitrary data can be sent.

**Fix:** Add express-validator schema.

---

### 2C. Race Conditions

#### 2C-1. `createBooking` — Availability Check & Creation Not Atomic
**Severity:** HIGH  
**File:** `booking.service.js`

`isWorkerAvailable()` runs outside any transaction, then `prisma.booking.create()` runs separately. Two customers can double-book the same slot.

#### 2C-2. `cancelBooking` — Status Check & Update Not Atomic
**Severity:** LOW  
**File:** `booking.service.js`

`findUnique` → check status → `update` — not wrapped in a transaction.

#### 2C-3. `acceptBooking` Uses Transaction but `isWorkerAvailable` Reads from Global Client
**Severity:** MEDIUM  
**File:** `booking.service.js`

`isWorkerAvailable` is called inside the transaction but uses the global `prisma` client instead of the transaction handle `tx`. Another booking could be created between the check and the update.

#### 2C-4. `createReview` — Rating Recalculation Not Atomic
**Severity:** MEDIUM  
**File:** `review.service.js`

Review creation, aggregate calculation, and user profile update are separate operations. Concurrent reviews produce incorrect ratings.

#### 2C-5. `reviewApplication` — Application Update & Profile Sync Not in Transaction
**Severity:** MEDIUM  
**File:** `verification.service.js`

If the profile update fails, the application is marked APPROVED but the profile stays `isVerified: false`.

#### 2C-6. Availability Overlap Check & Create Not Atomic
**Severity:** LOW  
**File:** `availability.service.js`

Two concurrent requests for overlapping slots could both pass the overlap check.

---

### 2D. Missing Error Handling

#### 2D-1. Manual Try/Catch Swallows Errors in Location & Notification Controllers
**Severity:** MEDIUM  

These use manual `try/catch` with `res.status(500).json({ error: error.message })` instead of `asyncHandler`. This:
- Bypasses centralized error handler
- Exposes internal error details (Prisma table/column names)
- Returns 500 for ALL errors including client errors

#### 2D-2. Fire-and-Forget Notification in Chat Service
**Severity:** LOW  
**File:** `chat.service.js`

`notificationService.createNotification(...)` called without `await`. Unhandled promise rejection if it fails.

#### 2D-3. Post-Response Code Can Throw Unhandled
**Severity:** LOW  
**File:** `booking.controller.js`

After `res.status(201).json(...)` is sent, socket emit and notification creation can throw outside try/catch.

#### 2D-4. No Graceful Prisma Shutdown
**Severity:** LOW  
**File:** `prisma.js`

`prisma.$disconnect()` is never called on `SIGINT`/`SIGTERM`, which can exhaust the connection pool.

#### 2D-5. New SMTP Transport Created on Every Email
**Severity:** LOW  
**File:** `mailer.js`

`buildTransport()` is called per email send. This is wasteful and can trigger SMTP rate limiting.

---

### 2E. API Inconsistencies

#### 2E-1. Mixed Error Response Formats
| Pattern | Used by |
|---|---|
| `{ error: 'message' }` | errorHandler, auth middleware, location, notification controllers |
| `{ message: 'text', errors: [...] }` | validation middleware |
| `{ message: 'text' }` | booking controller success responses |
| `{ error: 'message', stack: '...' }` | errorHandler in development |

Frontend must handle 3+ different error shapes.

#### 2E-2. Inconsistent `asyncHandler` vs Manual Try/Catch
Most modules use `asyncHandler` but `location.controller.js` and `notification.controller.js` use manual try/catch.

#### 2E-3. Service Layer Throws Plain `Error` vs `AppError`
Only `auth.service.js` uses `AppError` with status codes. All other services throw plain `Error`, defaulting to status 500 for everything ("Booking not found" = 500 instead of 404).

#### 2E-4. Inconsistent Success Response Shapes
- Booking: `{ message, booking }`
- Service: `{ message, service }`
- Auth: `{ user }` (no message)
- Location: `{ success: true, location }`
- Notification: `{ success: true }`

#### 2E-5. Inconsistent Authorization Middleware Usage
Some routes use `requireRole` middleware; others defer auth to service layer. Makes security model hard to audit.

---

### 2F. Dead Code / Redundancies

| # | Issue | File |
|---|---|---|
| 2F-1 | JWT token generated but unused on registration | `auth.service.js` |
| 2F-2 | Duplicated registration logic (`registerUser` ≈ `registerWorker`) | `auth.service.js`, `auth.controller.js` |
| 2F-3 | Duplicate route: `/register` and `/register-customer` do the same thing | `auth.routes.js` |
| 2F-4 | Legacy review endpoints (`/customer`, `/worker`) with confusing semantics | `review.routes.js` |
| 2F-5 | `COOKIE_OPTIONS` defined but never used in register handlers | `auth.controller.js` |
| 2F-6 | Worker profile lookup pattern duplicated ~8 times | `booking.service.js` |

---

### 2G. Architectural Issues

| # | Issue |
|---|---|
| 2G-1 | Socket.IO module-level import causes tight coupling across 5+ modules |
| 2G-2 | No service layer for uploads — route file contains multer config, filters, DB ops |
| 2G-3 | No input validation on admin endpoints |
| 2G-4 | No pagination on ANY list endpoint — returns ALL records |
| 2G-5 | Monolithic `booking.service.js` at 843 lines |
| 2G-6 | No request ID / correlation tracking for debugging |
| 2G-7 | Prisma client has no connection pool configuration or query timeouts |

---

### 2H. Data Model Issues

| # | Issue | Severity |
|---|---|---|
| 2H-1 | Database URL hardcoded instead of `env("DATABASE_URL")` | HIGH |
| 2H-2 | OTP fields stored as plain text (not hashed), no expiry enforced | MEDIUM |
| 2H-3 | Missing index on `Booking.scheduledAt` (used in range queries) | MEDIUM |
| 2H-4 | Missing index on `Booking.paymentStatus` | LOW |
| 2H-5 | `EmergencyContact` missing `onDelete: Cascade` | LOW |
| 2H-6 | `SOSAlert.triggeredBy` is plain Int, not a relation (no referential integrity) | MEDIUM |
| 2H-7 | `Notification.type` is plain String instead of enum | LOW |
| 2H-8 | `BookingPhoto` and `Payment` missing cascade on delete | MEDIUM |
| 2H-9 | `Availability` has no unique constraint — overlap prevention relies on app code with race condition | MEDIUM |
| 2H-10 | `Booking.address` is optional String with no normalization | LOW |

---

## Part 3: Client-Side Issues

### 3A. Frontend Bugs

#### 3A-1. `verifyEmail` Token Not URL-Encoded
**File:** `api/auth.js`  
Token interpolated directly into URL without `encodeURIComponent()`. Characters like `+`, `&`, `=` will corrupt the request.

#### 3A-2. `useKeyboardShortcuts` Causes Infinite Re-Renders
**File:** `hooks/useKeyboardShortcut.js`  
The `useEffect` dependency is `[shortcuts]` — an array recreated every render. Effect tears down and re-registers continuously unless callers memoize. No callers use `useMemo`.

#### 3A-3. `useKeyboardShortcut` vs `useKeyboardShortcuts` — Inconsistent Modifier Matching
**File:** `hooks/useKeyboardShortcut.js`  
Singular version folds `metaKey` into ctrl check; plural version doesn't. Same shortcuts behave differently.

#### 3A-4. `SOSContext` Socket Listener May Leak
**File:** `context/SOSContext.jsx`  
The `detach` cleanup runs on `window.__UPRO_SOCKET` at cleanup time, but `attach` was called on a possibly different socket instance at setup time.

#### 3A-5. Side Effect Inside `setIsOnline` State Updater
**File:** `hooks/useWorkerLocation.js`  
`reportLocation(currentLocation, true)` is called inside `setIsOnline()` — a mutation inside a state updater, which is a React anti-pattern.

#### 3A-6. Auth Login Double-Fetch Race Condition
**File:** `context/AuthContext.jsx`  
After `apiLogin()`, a second `getCurrentUser()` fires immediately. If the cookie hasn't been stored yet, the session check fails.

#### 3A-7. `BookingStatusBadge` Uses Undefined Variant
**File:** `components/common/StatusBadges.jsx`  
Maps `IN_PROGRESS` to `variant="accent"`, but `Badge.jsx` doesn't define `accent`. Falls through to no style.

#### 3A-8. `RegisterPage` Uses Global `location` Instead of React Router
**File:** `pages/auth/RegisterPage.jsx`  
Reads `location.search` (global `window.location`) instead of `useLocation()`.

#### 3A-9. `CustomerBookingsPage` Grid Mismatch
**File:** `pages/customer/CustomerBookingsPage.jsx`  
Uses `grid-cols-3` but only renders 2 stat cards — empty cell on the right.

#### 3A-10. Non-Standard Tailwind Classes
**Files:** `CustomerBookingDetailPage.jsx`, `WorkerBookingDetailPage.jsx`  
`text-2xs` and `text-micro` are not default Tailwind classes. May silently produce no output.

#### 3A-11. MessagesPage Hardcoded Online Indicator
**File:** `pages/profile/MessagesPage.jsx`  
Green "online" dot renders for every contact regardless of actual status.

#### 3A-12. LoginPage Post-Login Race Condition
**File:** `pages/auth/LoginPage.jsx`  
Uses `setTimeout(() => navigate(...), 100)` — arbitrary delay that races with React state updates.

---

### 3B. Frontend Security Issues

#### 3B-1. User Object in `localStorage` in Plain Text
**Files:** `AuthContext.jsx`, `axios.js`, profile pages  
Full user object (PII: name, email, role) persists in localStorage. Accessible to any XSS.

#### 3B-2. `VITE_UI_PREVIEW_MODE` Bypasses Auth Completely
**File:** `routes/ProtectedRoute.jsx`  
`WorkerRoute` and `CustomerRoute` return children directly when this env var is `true`. If accidentally enabled in production, ALL protected routes are public.

#### 3B-3. Socket URLs Guessed/Probed at Runtime
**File:** `hooks/useSocket.js`  
Hardcoded `http://` (not `https://`) fallback URLs. Could connect to unintended services.

#### 3B-4. `ForgotPasswordPage` Leaks Reset Link in Dev Mode
**File:** `pages/auth/ForgotPasswordPage.jsx`  
Displays actual reset URL when `import.meta.env.DEV` is true.

#### 3B-5. `PublicRoute` Bypass via `?force=true`
**File:** `routes/ProtectedRoute.jsx`  
Authenticated users can access login/register via `?force=true` query param.

---

### 3C. UI Inconsistencies

#### 3C-1. Raw HTML Elements vs. Common Component Library
The project has well-built `Input`, `Modal`, etc. in `components/common` but many pages bypass them:

| Page | Raw Elements |
|---|---|
| `AdminServicesPage.jsx` | `<input>`, `<textarea>` |
| `AdminVerificationPage.jsx` | `<input>` |
| `AdminWorkersPage.jsx` | `<input>` |
| `WorkerAvailabilityPage.jsx` | `<select>`, `<input type="time">` |
| `WorkerServicesPage.jsx` | `<input>` (search) |
| `WorkerVerificationPage.jsx` | `<textarea>` |
| `WorkerReviewsPage.jsx` | `<textarea>` |
| `WorkerDashboardPage.jsx` | `<input>` (OTP) |
| `WorkerBookingsPage.jsx` | `<input>` (OTP) |
| `ServiceDetailPage.jsx` | `<input>`, `<textarea>` |

#### 3C-2. Password Validation Mismatch
- `LoginPage.jsx`: Zod schema requires `min(6)`
- `ResetPasswordPage.jsx`: Zod schema requires `min(8)`
- Server `auth.schemas.js`: requires `min(8)`

#### 3C-3. `window.confirm()` vs `ConfirmDialog`
`ConfirmDialog` component exists but these pages use native `window.confirm()`:
- `CustomerDashboardPage.jsx`
- `WorkerDashboardPage.jsx`
- `WorkerBookingsPage.jsx`

#### 3C-4. `DollarSign` Icon Used for Indian Rupee
Lucide's `DollarSign` (`$`) icon used where currency is `₹`:
- `WorkerEarningsPage.jsx`
- `WorkerProfilePage.jsx`
- `WorkerDashboardPage.jsx`

#### 3C-5. `VerifyEmailPage` Skips `MainLayout`
Renders without the standard layout wrapper, unlike every other page.

#### 3C-6. Inline API Calls vs. Centralized `api/` Layer
Some pages define fetch functions inline instead of using the API layer:
- `MessagesPage.jsx`: defines `getUserConversations` locally
- `SystemStatusPage.jsx`: defines `fetchHealth` locally
- `ChatWindow.jsx`, `NotificationDropdown.jsx` make direct axios calls

#### 3C-7. Inconsistent Query Key Strategy
Some use `queryKeys` utility, others use plain strings: `['worker-profile']`, `['open-bookings']`, `['worker-payments']`, etc. Makes bulk invalidation unreliable.

#### 3C-8. Inconsistent Page Headers
Some pages use `PageHeader` component; others use ad-hoc `<h1>` + `<p>`.

#### 3C-9. Direct `localStorage` Manipulation Bypasses AuthContext
`CustomerProfilePage.jsx` and `WorkerProfilePage.jsx` directly call `localStorage.setItem('user', ...)` instead of going through `AuthContext`.

#### 3C-10. Axios Import Alias Inconsistency
- `location.js` and `safety.js`: `import axios from './axios'`
- All other API files: `import axiosInstance from './axios'`

#### 3C-11. `location.js` and `safety.js` Missing from Barrel Export
`api/index.js` re-exports all API modules EXCEPT `./location` and `./safety`.

#### 3C-12. Currency & Locale Mismatch
- `PricingPage.jsx`: USD pricing (`$9/mo`, `$29/mo`) in an INR-based app
- `ContactPage.jsx`: US phone format `+1 (234) 567-890`

#### 3C-13. Dark Card Ignores Light Mode
`WorkerDashboardPage.jsx`: Status Dashboard card uses `bg-gradient-to-br from-dark-900 to-dark-800` unconditionally.

---

### 3D. Missing States / Functionality Gaps

| # | Issue | File |
|---|---|---|
| 3D-1 | `ImageUpload` shows "up to 5MB" but performs no `file.size` check | `ImageUpload.jsx` |
| 3D-2 | Filter buttons have no `onClick` handler | `CustomerBookingsPage.jsx`, `WorkerBookingsPage.jsx` |
| 3D-3 | "Export Statement" button is a no-op | `WorkerEarningsPage.jsx` |
| 3D-4 | No pagination on any list view | All list pages |
| 3D-5 | Blog posts have no detail links | `BlogPage.jsx` |
| 3D-6 | "Apply via email" has no `mailto:` link | `CareersPage.jsx` |
| 3D-7 | Missing `onError` on mutations — failures silently swallowed | `WorkerDashboardPage.jsx`, `WorkerServicesPage.jsx` |
| 3D-8 | No frontend API for notifications or chat server modules | Missing `api/notifications.js`, `api/chat.js` |
| 3D-9 | `NotificationContext` maintains dummy `notifications: []` — always empty | `NotificationContext.jsx` |
| 3D-10 | No file type/size validation on upload API functions | `api/uploads.js` |
| 3D-11 | `getAllServices` filter skips `minPrice=0` (falsy in JS) | `api/services.js` |

---

### 3E. Accessibility Issues

| # | Issue | Files |
|---|---|---|
| 3E-1 | Missing ARIA roles on custom tab controls (`role="tab"`, `aria-selected`, `role="tablist"`) | `WorkerDashboardPage`, `WorkerReviewsPage`, `WorkerBookingsPage` |
| 3E-2 | OTP inputs have no `<label>` or `aria-label` | `WorkerDashboardPage`, `WorkerBookingsPage`, `WorkerBookingDetailPage` |
| 3E-3 | Color-only status indicators (green/gray) with no text/icon for screen readers | `WorkerDashboardPage`, `WorkerBookingDetailPage` |
| 3E-4 | Generic alt text (`alt="user"`) or empty alt on identity-conveying images | `LandingPage`, `WorkerBookingDetailPage` |
| 3E-5 | `Modal.jsx` doesn't trap focus or restore focus on close | `Modal.jsx` |
| 3E-6 | No skip-to-content link | `MainLayout`, `Navbar` |
| 3E-7 | `StarRating` not keyboard accessible (no `onKeyDown`, no `role="radio"`) | `StarRating.jsx` |

---

### 3F. Performance Issues

| # | Issue | Files |
|---|---|---|
| 3F-1 | CSS injected via `dangerouslySetInnerHTML` — triggers style recalc every render | `LiveTrackingMap.jsx`, `MiniMap.jsx` |
| 3F-2 | External CDN marker icons — map breaks if CDN is slow/blocked | `LiveTrackingMap.jsx` |
| 3F-3 | No `React.memo` on list-item components (`BookingCard`, `StatCard`, etc.) | Multiple pages |
| 3F-4 | No route-level code splitting (`React.lazy` + `Suspense`) | `AppRoutes.jsx` |
| 3F-5 | `Modal` reads `window.innerWidth` synchronously — not reactive to resize | `Modal.jsx` |
| 3F-6 | Polling continues when tab is inactive (30s–60s intervals) | `CustomerBookingsPage`, `WorkerBookingsPage`, `NotificationDropdown`, `SystemStatusPage` |
| 3F-7 | Large single-file components (600–870 lines) | `WorkerBookingDetailPage` (870), `CustomerBookingDetailPage` (690), `ServiceDetailPage` (686) |
| 3F-8 | No `useMemo` on AuthContext value — new object reference every render, cascading re-renders | `AuthContext.jsx` |
| 3F-9 | `useSocket` always runs — creates connection even for anonymous visitors | `AuthContext.jsx` |
| 3F-10 | Loading spinner markup duplicated 6 times | `ProtectedRoute.jsx` |

---

### 3G. Frontend Redundancies

#### 3G-1. Triplicated OTP Verification Modal
Nearly identical OTP code + photo-upload modal UI in:
- `WorkerDashboardPage.jsx`
- `WorkerBookingsPage.jsx`
- `WorkerBookingDetailPage.jsx`

**Fix:** Create shared `<OtpVerificationModal>`.

#### 3G-2. Duplicated Booking Action Handler
`handleBookingAction` switching on `CONFIRM`/`CANCEL`/`START_OTP`/`COMPLETE_OTP`/`REVIEW` is copy-pasted between `WorkerDashboardPage` and `WorkerBookingsPage`.

**Fix:** Extract to a shared `useBookingActions` hook.

#### 3G-3. Manual Socket Boilerplate vs. `useSocketEvent`
`useSocketEvent` hook exists but several pages manually replicate attach/detach:
- `WorkerBookingDetailPage.jsx`
- `CustomerBookingDetailPage.jsx`
- All Admin pages

#### 3G-4. Duplicated Cancellation Modal
Cancel-with-reason modal is copy-pasted between `CustomerBookingDetailPage` and `WorkerBookingDetailPage`.

#### 3G-5. Repeated Dark-Mode Ternaries
`isDark ? 'text-gray-100' : 'text-gray-900'` appears hundreds of times. Using Tailwind's `dark:` modifier would eliminate this.

#### 3G-6. Dead Exports / Unused Code
| Export | File | Status |
|---|---|---|
| `AdminPublicRoute` | `ProtectedRoute.jsx` | Never imported |
| `getCustomerReviews`, `getWorkerReviews` | `api/reviews.js` | Never imported |
| `getNearbyWorkers` | `api/location.js` | Never imported |
| `useKeyboardShortcut` (singular) | `useKeyboardShortcut.js` | Never imported |
| `setLoading`, `setUser` | `AuthContext.jsx` | Likely unused |
| JSDoc-only type files (export `{}`) | `types/*.js` | No runtime value |

---

### 3H. Hardcoded Values

| File | Hardcoded Value | Issue |
|---|---|---|
| `LoginPage.jsx` | `'50K+ Happy Customers'`, `'8K+ Verified'`, `'4.9★'` | Marketing stats |
| `RegisterPage.jsx` | Same `'50K+'`, `'8K+'`, `'120+'`, `'4.9★'` | Duplicated stats |
| `LandingPage.jsx` | `'500+'`, `'10k+'`, `'5k+'`, `'4.8'` | **Different values** than login/register! |
| `LandingPage.jsx` | `'Sarah Jenkins'`, `'Professional Cleaner'` | Fake "Worker of the Month" |
| `WorkerProfileModern.jsx` | `'120+'`, `'6 Years'` | Fake experience |
| `CustomerDashboardPage.jsx` | `2450` in wallet balance calc | Fake seed balance |
| `CustomerDashboardPage.jsx` | `'₹250'` | Referral reward |
| `WorkerEarningsPage.jsx` | `'HDFC Bank •••• 4242'`, `'Monday, Apr 10'` | Mock bank details |
| `WorkerDashboardPage.jsx` | `'₹750+'` | Fallback price |
| `ServicesPage.jsx` | `(4.0 + (service.id % 10) / 10)` | **Fabricated rating** |
| `ContactPage.jsx` | `'support@urbanpro.com'`, `'+1 (234) 567-890'` | Placeholder contact info |
| `PricingPage.jsx` | `'$9/mo'`, `'$29/mo'` | USD in an INR app |

---

### 3I. Frontend-Backend Mismatches

#### 3I-1. No Frontend API for Notifications or Chat
Server mounts `/api/notifications` and `/api/chat`, but there are no corresponding `api/notifications.js` or proper `api/chat.js` files. NotificationDropdown has a comment: "Mock API for now".

#### 3I-2. `publicPaths` in Axios Interceptor Is Incomplete
Only includes `['/', '/login', '/register', '/register-worker', '/services']`. Missing `/about`, `/contact`, `/faq`, `/privacy`, `/terms`, etc. User on a public page with expired session gets incorrectly redirected to login.

#### 3I-3. Auth Endpoint JSDoc Says "Token" but Auth Is Cookie-Based
API file JSDoc claims "Response with user data and token" but the system uses httpOnly cookies. Misleading documentation.

#### 3I-4. `/register-worker` in `publicPaths` Is Dead Code
Frontend redirects `/register-worker` to `/register?role=worker`, so the path check never matches.

---

## Part 4: Booking System Architectural Gaps

These are higher-level design problems in the booking flow that will break in production:

| # | Problem | Severity | Relation to Session Architecture |
|---|---|---|---|
| 4-1 | **Hardcoded 2-hour time window** — lock change (20 min) blocks same as renovation (8 hrs). No `estimatedDuration` field | HIGH | Directly related |
| 4-2 | **PENDING bookings silently block slots** — unanswered requests lock times for everyone | HIGH | Directly related |
| 4-3 | **No booking timeout / auto-expiry** — PENDING stays PENDING forever | HIGH | Same category |
| 4-4 | **OTP expiry never enforced** — `otpGeneratedAt` stored but never checked | MEDIUM | Directly (daily OTP) |
| 4-5 | **No cancellation policy / penalty** — zero consequences for late cancel or no-show | HIGH | Same category |
| 4-6 | **No rescheduling mechanism** — must cancel and rebook, losing worker assignment | MEDIUM | Same category |
| 4-7 | **No concurrent booking limit per day** — worker can have 15 bookings with no safeguard | MEDIUM | Directly (overrun) |
| 4-8 | **No payment milestones / deposit system** — all-or-nothing payment | MEDIUM | Multi-day jobs |
| 4-9 | **No booking audit trail** — only current status stored, no status history | MEDIUM | Disputes/overrun |
| 4-10 | **No worker offline-during-job alert** — customer/admin not notified if worker goes offline during IN_PROGRESS | MEDIUM | Session tracking |
| 4-11 | **No response time / SLA tracking** — no data for matching algorithm optimization | LOW | Matching quality |

---

## Part 5: Implementation & Workflow Plan

### Phase 1: Critical Security Fixes (Week 1)
> These can be exploited today and must be fixed first.

| Task | Issues Addressed | Priority |
|---|---|---|
| 1.1 Secure Socket.IO — reject unauthenticated connections, validate room membership | 2B-1 | P0 |
| 1.2 Replace `Math.random()` OTP with `crypto.randomInt()` | 2B-2 | P0 |
| 1.3 Add rate limiting on OTP endpoints + lockout after failures | 2B-3 | P0 |
| 1.4 Reject SVG uploads / add sanitization | 2B-4 | P0 |
| 1.5 Add authentication to `/location/nearby` endpoint | 2B-5 | P0 |
| 1.6 Move database URL to `env("DATABASE_URL")` | 2B-6, 2H-1 | P0 |
| 1.7 Serve uploads through authenticated route or signed URLs | 2B-12 | P0 |
| 1.8 Remove `VITE_UI_PREVIEW_MODE` bypass from production builds | 3B-2 | P0 |
| 1.9 Restrict CORS localhost to development only | 2B-10 | P1 |
| 1.10 Validate `profilePhotoUrl` — only accept from upload endpoint | 2B-9 | P1 |

### Phase 2: Bug Fixes & Error Handling (Week 2)
> Fix broken behavior and prevent data corruption.

| Task | Issues Addressed | Priority |
|---|---|---|
| 2.1 Replace `res.status(X); throw new Error` with `throw new AppError(X, '...')` | 2A-1 | P0 |
| 2.2 Wrap `createBooking` in `prisma.$transaction()` | 2A-2, 2C-1 | P0 |
| 2.3 Add `parseInt` NaN validation to all controllers | 2A-3 | P1 |
| 2.4 Fix `isWorkerAvailable` to use transaction handle `tx` | 2C-3 | P1 |
| 2.5 Wrap `createReview` rating recalculation in transaction | 2C-4 | P1 |
| 2.6 Wrap `reviewApplication` in transaction | 2C-5 | P1 |
| 2.7 Standardize ALL services to use `AppError` (not plain `Error`) | 2E-3 | P1 |
| 2.8 Standardize error response format to `{ error, statusCode }` | 2E-1 | P1 |
| 2.9 Fix `listMyPayments` for workers | 2A-5 | P1 |
| 2.10 Add try/catch to `chat.service.js` `getIo()` | 2A-6 | P2 |
| 2.11 Add `SIGINT`/`SIGTERM` graceful shutdown | 2D-4 | P2 |
| 2.12 Fix `BookingStatusBadge` `accent` variant | 3A-7 | P1 |
| 2.13 Fix password validation mismatch (Login min(6) vs Server min(8)) | 3C-2 | P1 |
| 2.14 Fix `useKeyboardShortcuts` infinite re-render | 3A-2 | P1 |
| 2.15 URL-encode email verification token | 3A-1 | P1 |

### Phase 3: API & Architecture Cleanup (Week 3)
> Standardize patterns and reduce tech debt.

| Task | Issues Addressed | Priority |
|---|---|---|
| 3.1 Convert location/notification controllers to use `asyncHandler` | 2D-1, 2E-2 | P1 |
| 3.2 Add validation schemas to admin endpoints | 2G-3 | P1 |
| 3.3 Add validation to emergency contact CRUD | 2B-13 | P1 |
| 3.4 Add chat message length/content validation | 2B-11 | P1 |
| 3.5 Add pagination to ALL list endpoints | 2G-4, 3D-4 | P1 |
| 3.6 Deduplicate registration logic | 2F-2, 2F-3 | P2 |
| 3.7 Extract worker profile lookup helper | 2F-6 | P2 |
| 3.8 Add `scheduledAt` and `paymentStatus` indexes to schema | 2H-3, 2H-4 | P1 |
| 3.9 Fix cascade rules for `EmergencyContact`, `BookingPhoto`, `Payment` | 2H-5, 2H-8 | P2 |
| 3.10 Add unique constraint on `Availability(workerId, dayOfWeek, startTime, endTime)` | 2H-9 | P2 |
| 3.11 Create proper `SOSAlert.triggeredBy` foreign key relation | 2H-6 | P2 |
| 3.12 Add `estimatedDuration` field to Booking model | 4-1 | P1 |

### Phase 4: Frontend Consistency & Quality (Week 4)
> Make the UI reliable and consistent.

| Task | Issues Addressed | Priority |
|---|---|---|
| 4.1 Replace all raw HTML inputs with common components | 3C-1 | P1 |
| 4.2 Replace `window.confirm()` with `ConfirmDialog` | 3C-3 | P2 |
| 4.3 Replace `DollarSign` with `IndianRupee` icon | 3C-4 | P2 |
| 4.4 Create `api/notifications.js` and `api/chat.js` | 3I-1 | P1 |
| 4.5 Fix `publicPaths` in axios interceptor | 3I-2 | P1 |
| 4.6 Centralize all inline API calls to `api/` layer | 3C-6 | P2 |
| 4.7 Standardize query keys to use `queryKeys` utility everywhere | 3C-7 | P2 |
| 4.8 Fix dark-mode unconditional card in WorkerDashboard | 3C-13 | P2 |
| 4.9 Fix grid-cols-3 with 2 cards | 3A-9 | P3 |
| 4.10 Fix USD pricing/contact placeholders | 3C-12 | P2 |
| 4.11 Remove dead exports and unused code | 3G-6 | P3 |
| 4.12 Use `useLocation()` instead of global `location` in RegisterPage | 3A-8 | P2 |
| 4.13 Add `useMemo` to AuthContext value | 3F-8 | P1 |
| 4.14 Add file size validation to `ImageUpload` | 3D-1, 3D-10 | P1 |

### Phase 5: Frontend DRY (Deduplication) (Week 5)
> Extract shared components and hooks to reduce 1000+ lines of duplication.

| Task | Issues Addressed | Priority |
|---|---|---|
| 5.1 Create `<OtpVerificationModal>` shared component | 3G-1 | P1 |
| 5.2 Create `useBookingActions` hook | 3G-2 | P1 |
| 5.3 Create `<CancellationModal>` shared component | 3G-4 | P2 |
| 5.4 Replace manual socket boilerplate with `useSocketEvent` | 3G-3 | P2 |
| 5.5 Replace `isDark ? '...' : '...'` with Tailwind `dark:` modifier | 3G-5 | P2 |
| 5.6 Extract loading spinner from ProtectedRoute to shared component | 3F-10 | P3 |
| 5.7 Break down large components (870+ lines) into sub-components | 3F-7 | P2 |

### Phase 6: Accessibility & Performance (Week 6)
> Production readiness.

| Task | Issues Addressed | Priority |
|---|---|---|
| 6.1 Add ARIA roles to tab controls, filter chips | 3E-1 | P1 |
| 6.2 Add labels to OTP inputs | 3E-2 | P1 |
| 6.3 Add text/icon alternatives to color-only indicators | 3E-3 | P2 |
| 6.4 Add focus trap and restore-focus to `Modal` | 3E-5 | P1 |
| 6.5 Add skip-to-content link in `MainLayout` | 3E-6 | P2 |
| 6.6 Make `StarRating` keyboard accessible | 3E-7 | P2 |
| 6.7 Add route-level code splitting with `React.lazy` + `Suspense` | 3F-4 | P1 |
| 6.8 Add `React.memo` to list-item components | 3F-3 | P2 |
| 6.9 Replace CSS `dangerouslySetInnerHTML` with proper stylesheet | 3F-1 | P2 |
| 6.10 Disable polling when tab is inactive | 3F-6 | P2 |
| 6.11 Only connect socket for authenticated users | 3F-9 | P2 |

### Phase 7: Session-Based Booking Architecture (Weeks 7-8)
> The core feature from error.md — requires schema changes and both frontend + backend work.

| Task | Issues Addressed | Priority |
|---|---|---|
| 7.1 Create `BookingSession` model in Prisma schema | Part 1 | P1 |
| 7.2 Add migration and seed data | Part 1 | P1 |
| 7.3 Implement session CRUD in `booking.service.js` | Part 1 (§1.2) | P1 |
| 7.4 Update `isWorkerAvailable` to session-aware logic | Part 1 (§1.3) | P1 |
| 7.5 Add "Pause / Next Visit" worker action (API + UI) | Part 1 (§1.2) | P1 |
| 7.6 Add daily re-verification OTP per session | Part 1 (§1.5) | P1 |
| 7.7 Add overrun detection and customer notification | Part 1 (§1.4) | P2 |
| 7.8 Add booking timeout / auto-expiry for PENDING | 4-3 | P1 |
| 7.9 Add cancellation policy / penalty logic | 4-5 | P2 |
| 7.10 Add rescheduling mechanism | 4-6 | P2 |
| 7.11 Add booking status audit trail (`BookingStatusHistory` model) | 4-9 | P2 |
| 7.12 Customer UI: "Next visit scheduled" display | Part 1 (§1.2) | P1 |
| 7.13 Worker UI: Session management panel | Part 1 | P1 |

---

### Summary

| Phase | Focus | Estimated Effort | Issues Covered |
|---|---|---|---|
| Phase 1 | Security Fixes | 1 week | 10 tasks |
| Phase 2 | Bug Fixes | 1 week | 15 tasks |
| Phase 3 | API Cleanup | 1 week | 12 tasks |
| Phase 4 | Frontend Consistency | 1 week | 14 tasks |
| Phase 5 | Frontend DRY | 1 week | 7 tasks |
| Phase 6 | Accessibility & Perf | 1 week | 11 tasks |
| Phase 7 | Session Architecture | 2 weeks | 13 tasks |
| **Total** | | **8 weeks** | **82 tasks** |
