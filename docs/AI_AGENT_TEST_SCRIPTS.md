# AI Agent Test Scripts

Use one chat session per scenario unless specified.
Wait 2-3 seconds between messages to avoid rate-limit noise.

## Test Setup
1. Restart backend and frontend before test run.
2. Login as customer for scenarios 1-12 unless noted.
3. Keep browser console open to detect navigation/remount issues.
4. Use Export after each scenario for evidence capture.
5. Ensure customer profile has a valid address before booking scenarios (required by booking API).
6. Start each scenario from a fresh chat state (new session id or reset endpoint).

## New Fixes Covered In This Version
- Chat should not disappear after AI navigation (SPA navigation + session storage persistence).
- Wallet "transactions/history" prompts should route via deterministic wallet path.
- "Add money" should be deterministic and navigate to wallet (no LLM dependency).
- Stale cross-session booking lock should no longer block new booking flow.
- Booking confirmation now injects customer address into createBooking payload.
- Create and cancel confirmations should return explicit success/error messages (not generic fallback).
- Cancel booking now pre-validates ownership before asking confirmation.
- Nonsense single-token input should return clarification, not LLM temporary-unavailable noise.
- Upload flows should continue via local fallback when Cloudinary fails.
- Notification API degradation should not crash chat flow when DB is unreachable.

## Pass Rules
- PASS only if all expected bullets match behavior.
- If one bullet fails, mark scenario FAIL and include exported JSON.
- If scenario depends on data (bookings/wallet history), note data assumptions in Notes.

## 1) Wallet and Finance
1. Show my wallet balance
2. View transactions
3. Add money

Expected:
- Agent returns wallet summary text.
- Navigation action targets customer wallet route.
- Follow-up suggests add money or transactions.
- Chat remains visible after route change (no hard refresh wipe).
- "View transactions" should not fall back to generic AI unavailable in normal conditions.
- "View transactions" should show transaction-oriented response (not only balance repeat).
- "Add money" should navigate to wallet with top-up guidance (no AI unavailable fallback).

Notes:
- Ignore microphone-permission messages if you clicked voice input accidentally.

## 2) Booking Happy Path
1. Book cleaning tomorrow 5pm
2. Book cheapest worker
3. Yes

Expected:
- Worker list and recommendation appears.
- Booking summary appears before execution.
- Booking executes only after confirmation.
- Should not incorrectly respond with "You're already creating a booking" on first booking message in a clean session.
- Confirmation step should not fail with generic "Something went wrong" when profile has valid address.

Expected post-confirmation behavior:
- Assistant returns explicit booking success text.
- Response includes navigation to bookings page (/bookings).
- If address missing, assistant asks to complete customer profile address.


## 3) Best Worker Path
1. Book AC repair tomorrow 6pm
2. Book best worker
3. Yes confirm it

Expected:
- Best worker is selected.
- Trust signal references higher rating.
- Should not be blocked by stale booking lock from earlier sessions.
- Booking confirmation should succeed when customer address exists.

## 4) Compare Options


## 4) Compare Options
1. Book plumbing tomorrow 7pm
2. Compare
3. Which is better

Expected:
- Agent explains rating vs price using existing context.
- No LLM-only generic answer.
- Comparison should continue within same pending booking context.

Pass criteria:
- Compare response stays deterministic and consistent.
- No temporary-unavailable fallback in this scenario.

## 5) Change Worker / Undo
1. Book cleaning tomorrow 8pm
2. Book best worker
3. Change worker
4. Book cheapest worker
5. Yes

Expected:
- Worker selection is cleared on change request.
- Worker list is shown again.
- Final summary reflects cheapest worker.

Note:
- "Change worker" only works before confirmation is pending.
- If confirmation is already pending, first reply "no", then choose another worker.

Recommended step order for this scenario:
1. Book cleaning tomorrow 8pm
2. Change worker
3. Book cheapest worker
4. Yes

## 6) Context-Aware Follow-Up
1. Book electrician tomorrow 5pm
2. What about 6pm
3. Book best worker
4. Yes

Expected:
- Time update is applied from context.
- Flow continues without restarting.

## 7) Edge Cases
### 7.1 Missing service
1. Book something

Expected:
- Agent asks for service detail.

### 7.2 Cancel without ID
1. Cancel booking

Expected:
- Agent asks for booking id or latest booking.

### 7.2b Cancel invalid booking id
1. Cancel booking 999999

Expected:
- Agent should reject before confirmation with account-scoped validation message.

### 7.3 Partial noisy input
1. Cheap one tomorrow maybe

Expected:
- Agent asks clarifying question, does not execute blindly.

### 7.4 Nonsense input
1. asdf

Expected:
- Agent asks for meaningful instruction.

## 8) Guardrails
### 8.1 Duplicate booking block
1. Book cleaning tomorrow 5pm
2. Book cleaning tomorrow 5pm

Expected:
- Duplicate booking attempt is blocked when one is already in progress.


### 8.2 Booking attempts limit
Send booking start messages more than 3 times in one minute.

Expected:
- Agent returns limit message for booking attempts.

## 9) Confirmation Integrity
1. Book cleaning tomorrow 5pm
2. Book cheapest worker
3. No

Expected:
- Booking is not executed.
- Agent confirms cancellation of pending action.

## 10.1) Wallet Follow-Up Deterministic Flow
1. Show my wallet balance
2. View transactions
3. Add money

Expected:
- Step 2 returns transaction-oriented output.
- Step 3 navigates to wallet add-money path without LLM fallback.

## 11) Session Reset Recovery
If chat gets stuck in confirmation state, call AI session reset endpoint from API client:
- POST /api/ai/session/reset
- body: {"sessionId":"<current session id>"}

Then retry scenario.

Expected:
- Reset clears pending confirmation for that session.
- New booking flow starts normally after reset.

## 12) Chat Export QA
1. Run any scenario above.
2. Click Export button in AI chat header.

Expected:
- Browser downloads a JSON file.
- File includes sessionId, exportedAt, messageCount, and message list.

## 13) Upload Resilience (Cloudinary Fallback)
1. Open worker profile or verification flow.
2. Upload profile photo.
3. Upload verification document (image/pdf).

Expected:
- Upload succeeds even if Cloudinary is unavailable or returns stale-request errors.
- Returned URL may be local (/uploads/...) as fallback.
- Profile save should continue and not be blocked by external upload provider failure.

Important:
- This scenario must be tested in the actual profile/verification UI, not by asking chat to upload files.

## 14) Notification Degraded Mode
1. Trigger notification fetch while DB is unavailable.
2. Open chat and run wallet/booking commands.

Expected:
- Notification endpoint should degrade gracefully (empty list/0 unread) without crashing agent flow.
- Chat responses for unrelated intents (wallet/bookings) should remain usable.

Important:
- Do not send meta test instructions as chat input for this scenario.
- Instead, create DB outage condition externally, then ask normal wallet/booking commands.

## 15) Profile Navigation Regression
### 15.1 Customer profile navigation
1. Open profile
2. Open worker profile
3. Open verification flow

Expected (logged in as customer):
- Step 1 navigates to /customer/profile.
- Step 2 should not fail; agent explains worker profile is worker-only and opens /customer/profile.
- Step 3 should not fail; agent explains verification is worker-only and opens /customer/profile.
- Chat must stay visible after each navigation.

### 15.2 Worker profile navigation
1. Open profile
2. Open verification flow
3. Open customer profile

Expected (logged in as worker):
- Step 1 navigates to /worker/profile.
- Step 2 navigates to /worker/verification.
- Step 3 should not fail and should keep worker-safe routing (/worker/profile).
- Chat must stay visible after each navigation.

## Test Run Result Template
Use this block while executing scenarios:

Scenario:
Steps sent:
Expected:
Actual:
Pass/Fail:
Export file:
Notes:

## Known Anti-Patterns During Testing
- Reusing one old session across all scenarios can produce cross-test contamination.
- Sending QA instructions as chat messages (for example, "trigger DB outage") is not a valid user intent test.
- Testing upload fallback by asking chat to upload is invalid; use profile/verification UI upload controls.