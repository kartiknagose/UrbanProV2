# Booking Status Flow - Customer vs Worker Permissions

## Overview
This document explains what actions customers and workers can perform at each booking status stage.

---

## Status Progression

```
PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
   ↓
CANCELLED (can happen at any stage before COMPLETED)
```

---

## 1. PENDING (Waiting for Worker Response)

**Initial State:** Customer creates booking, waiting for worker to accept.

### Customer Permissions (John)

✅ **Can Do:**
- View booking details: `GET /api/bookings/2`
- Cancel booking: `PATCH /api/bookings/2/cancel`
  ```json
  {
    "cancellationReason": "Changed my mind"
  }
  ```

❌ **Cannot Do:**
- Update status to CONFIRMED (only worker can accept)
- Start or complete work

**Example Response:**
```json
{
  "id": 2,
  "status": "PENDING",
  "customer": { "name": "John Doe" },
  "worker": { "name": "Rajesh Kumar" },
  "scheduledAt": "2026-02-10T10:00:00Z"
}
```

### Worker Permissions (Rajesh)

✅ **Can Do:**
- View pending request: `GET /api/bookings` (filtered to their bookings)
- Accept booking: `PATCH /api/bookings/2/status`
  ```json
  {
    "status": "CONFIRMED"
  }
  ```
- Decline/Cancel: `PATCH /api/bookings/2/cancel`
  ```json
  {
    "cancellationReason": "Not available that day"
  }
  ```

❌ **Cannot Do:**
- Skip to IN_PROGRESS without confirming first
- Mark as COMPLETED directly

---

## 2. CONFIRMED (Worker Accepted)

**State:** Worker agreed to do the job, appointment confirmed.

### Customer Permissions (John)

✅ **Can Do:**
- View confirmed booking
- Cancel booking (still allowed):
  ```json
  {
    "cancellationReason": "Emergency came up"
  }
  ```

❌ **Cannot Do:**
- Change to IN_PROGRESS (only worker can start)
- Mark as COMPLETED
- Change scheduled time (would need new booking)

**Why Customer Can Still Cancel:**
- Plans change
- Found another provider
- Emergency situations
- Worker hasn't started yet

### Worker Permissions (Rajesh)

✅ **Can Do:**
- View confirmed bookings
- Start work: `PATCH /api/bookings/2/status`
  ```json
  {
    "status": "IN_PROGRESS"
  }
  ```
- Cancel (if needed):
  ```json
  {
    "cancellationReason": "Customer not responding to confirmation calls"
  }
  ```

❌ **Cannot Do:**
- Skip to COMPLETED without IN_PROGRESS
- Go back to PENDING

---

## 3. IN_PROGRESS (Work Started)

**State:** Worker is actively working on the job.

### Customer Permissions (John)

✅ **Can Do:**
- View booking status (see worker is on-site)
- Cancel (in extreme cases):
  ```json
  {
    "cancellationReason": "Quality issues - worker breaking things"
  }
  ```

❌ **Cannot Do:**
- Mark as COMPLETED (only worker completes)
- Change status to CONFIRMED (can't go backwards)

**Note:** Cancelling IN_PROGRESS booking is serious - typically for:
- Safety concerns
- Worker misconduct
- Damage to property
- Customer disputes

### Worker Permissions (Rajesh)

✅ **Can Do:**
- View active job details
- Complete work: `PATCH /api/bookings/2/status`
  ```json
  {
    "status": "COMPLETED"
  }
  ```
- Cancel (if necessary):
  ```json
  {
    "cancellationReason": "Customer cancelled mid-work, paid partial"
  }
  ```

❌ **Cannot Do:**
- Go back to CONFIRMED
- Skip completion (must finish or cancel)

---

## 4. COMPLETED (Work Finished)

**State:** Job successfully finished, final state.

### Customer Permissions (John)

✅ **Can Do:**
- View completed booking
- (Future) Leave review/rating

❌ **Cannot Do:**
- Cancel (work already done)
- Change any status
- Modify booking details

**Note:** If customer has issues with completed work:
- Contact support
- Dispute resolution process (future feature)
- Not handled by booking status system

### Worker Permissions (Rajesh)

✅ **Can Do:**
- View completed jobs
- (Future) Request payment confirmation

❌ **Cannot Do:**
- Cancel (already completed)
- Change status
- Undo completion

---

## 5. CANCELLED (Booking Terminated)

**State:** Booking cancelled by customer, worker, or admin.

### Anyone's Permissions

✅ **Can Do:**
- View cancelled booking
- See cancellation reason
- Read booking history

❌ **Cannot Do:**
- Reactivate booking (must create new booking)
- Change status
- Modify details

**Cancellation Reasons Stored:**
- Customer: "Found cheaper option"
- Worker: "Emergency, equipment broke"
- Admin: "Policy violation"

---

## Permission Summary Table

| Status | Customer Can | Worker Can | Admin Can |
|--------|--------------|-----------|-----------|
| **PENDING** | View, Cancel | View, Accept (→CONFIRMED), Cancel | View, Cancel, Update |
| **CONFIRMED** | View, Cancel | View, Start (→IN_PROGRESS), Cancel | View, Cancel, Update |
| **IN_PROGRESS** | View, Cancel | View, Complete (→COMPLETED), Cancel | View, Cancel, Update |
| **COMPLETED** | View only | View only | View, Cancel (rare) |
| **CANCELLED** | View only | View only | View only |

---

## Status Update Restrictions

### Valid Transitions

✅ **Allowed:**
- PENDING → CONFIRMED (worker accepts)
- CONFIRMED → IN_PROGRESS (worker starts)
- IN_PROGRESS → COMPLETED (worker finishes)
- Any stage → CANCELLED (by authorized party)

❌ **Not Allowed:**
- PENDING → IN_PROGRESS (must confirm first)
- PENDING → COMPLETED (can't skip stages)
- COMPLETED → anything (final state)
- CANCELLED → anything (final state)
- Backwards: CONFIRMED → PENDING

---

## Code Implementation

### Update Status Endpoint
```
PATCH /api/bookings/:id/status
Authorization: Bearer token (Worker or Admin only)

Body:
{
  "status": "CONFIRMED" | "IN_PROGRESS" | "COMPLETED"
}
```

### Cancel Endpoint
```
PATCH /api/bookings/:id/cancel
Authorization: Bearer token (Customer, Worker, or Admin)

Body:
{
  "cancellationReason": "string (optional but recommended)"
}
```

### View Bookings
```
GET /api/bookings
Authorization: Bearer token (Any authenticated user)

Response:
- Customer: sees their bookings
- Worker: sees bookings assigned to them
- Admin: sees all bookings
```

---

## Business Logic Examples

### Example 1: Happy Path
```
1. John creates booking → PENDING
2. Rajesh accepts → CONFIRMED
3. Rajesh arrives, starts → IN_PROGRESS
4. Work done → COMPLETED
```

### Example 2: Customer Cancels Early
```
1. John creates booking → PENDING
2. John cancels (plans changed) → CANCELLED
3. Rajesh never sees it
```

### Example 3: Worker Declines
```
1. John creates booking → PENDING
2. Rajesh sees it, cancels (not available) → CANCELLED
3. John must create new booking with different worker
```

### Example 4: Mid-Work Issue
```
1. John creates → PENDING
2. Rajesh accepts → CONFIRMED
3. Rajesh starts → IN_PROGRESS
4. Customer dispute → John cancels → CANCELLED
5. Payment/refund handled separately
```

---

## Error Scenarios

### Scenario 1: Customer Tries to Update Status
```
Request: PATCH /api/bookings/2/status (as customer)
Body: { "status": "CONFIRMED" }

Response: 403 Forbidden
{
  "error": "Only the assigned worker or admin can update booking status."
}
```

### Scenario 2: Cancel Already Completed
```
Request: PATCH /api/bookings/2/cancel (any user)
Current Status: COMPLETED

Response: 400 Bad Request
{
  "error": "Cannot cancel a completed booking."
}
```

### Scenario 3: Worker Updates Wrong Booking
```
Request: PATCH /api/bookings/2/status (worker A)
Booking assigned to: worker B

Response: 403 Forbidden
{
  "error": "Only the assigned worker or admin can update booking status."
}
```

---

## Future Enhancements

### Payment Integration
- CONFIRMED → customer charged hold amount
- COMPLETED → full payment released to worker
- CANCELLED → refund based on cancellation policy

### Rating System
- COMPLETED → customer can rate worker
- COMPLETED → worker can rate customer

### Rescheduling
- Allow date changes in PENDING/CONFIRMED
- Worker must accept new time
- No status change, just update scheduledAt

### Auto-Cancellation
- PENDING > 24 hours → auto-cancel
- IN_PROGRESS > scheduled time + buffer → flag for review

---

## Testing Checklist

- [ ] Customer creates booking → PENDING
- [ ] Worker accepts → CONFIRMED
- [ ] Worker starts → IN_PROGRESS
- [ ] Worker completes → COMPLETED
- [ ] Customer cancels PENDING booking
- [ ] Worker cancels CONFIRMED booking
- [ ] Cannot cancel COMPLETED booking
- [ ] Customer cannot update status
- [ ] Worker cannot update other worker's booking
- [ ] Admin can cancel any booking
