# UrbanPro Booking Modes

## Overview
Different ways customers can book services on the platform. Each mode has different business logic, UX flow, and implementation complexity.

---

## 1. Direct Worker Booking (MVP)

**Description:**  
Customer selects a specific worker → books a time slot.

**Flow:**
1. Customer browses workers offering a service
2. Clicks on worker profile → sees availability, reviews, rates
3. Selects date/time → creates booking
4. Booking status: PENDING → Worker can accept/decline
5. Worker accepts → CONFIRMED → Work happens

**Advantages:**
- Simplest to build
- Customer has control (knows who's coming)
- Best for trust-building (new workers)
- Worker gets consistent customers

**Disadvantages:**
- Not all workers always available
- Customer waits for worker to accept
- Worker might decline

**Database:**
```
Booking {
  workerId: 2,        // Specific worker
  serviceId: 1,       // Service type
  scheduledDate: "2026-02-01T10:00:00Z",
  status: "PENDING"   // Waiting for worker
}
```

**Implementation Status:** ✅ Ready for Phase 5

---

## 2. Service-First Booking (Auto-Assign)

**Description:**  
Customer picks a service → system auto-assigns the best available worker.

**Flow:**
1. Customer selects service (Plumbing) → date/time/location
2. System finds available workers offering that service
3. Algorithm picks best: rating > availability > location
4. Booking auto-created with selected worker
5. Worker gets notification instantly

**Advantages:**
- Fast booking (no waiting for acceptance)
- No customer worry about "will worker accept?"
- Optimization by rating/location
- Good for urgent jobs

**Disadvantages:**
- Less customer control
- Workers can't see job before accept
- Requires ranking algorithm
- Complex if no workers available

**Algorithm Example:**
```
Filter: Workers offering service in location
Score each: (rating * 0.5) + (availability_hours * 0.3) + (distance_score * 0.2)
Pick: Highest score worker
```

**Implementation Status:** ⏳ Post-MVP

---

## 3. Request + Bids System

**Description:**  
Customer posts a job → multiple workers offer quotes → customer picks best quote.

**Flow:**
1. Customer creates job request: service + details + max budget
2. Multiple workers see it → submit bids (date/price/description)
3. Customer reviews bids → accepts one
4. Other bids auto-rejected
5. Booking created with accepted worker

**Advantages:**
- Competitive pricing (workers bid lower)
- Customer compares options
- Workers choose what work to take
- Transparent process

**Disadvantages:**
- Takes longer (multiple back-and-forth)
- Complexity: manage multiple bids
- Worker time wasted on rejected bids
- Not ideal for urgent jobs

**Database Schema:**
```
JobRequest {
  customerId: 1,
  serviceId: 1,
  description: "Kitchen pipe leak",
  maxBudget: 1500,
  dateNeeded: "2026-02-01",
  status: "OPEN"    // Accepting bids
}

Bid {
  jobRequestId: 1,
  workerId: 2,
  quotedPrice: 1200,
  proposedDate: "2026-02-01T10:00:00Z",
  description: "Can fix with minimal wall damage",
  status: "PENDING"  // Waiting for customer
}
```

**Implementation Status:** ⏳ Post-MVP (Phase 2+)

---

## 4. Instant/On-Demand Booking

**Description:**  
"I need someone NOW" → nearest available worker gets instant request.

**Flow:**
1. Customer taps "Book Now" with urgent flag
2. System finds nearest available worker
3. Worker gets 30-sec notification → accepts/declines
4. If accepts: booking confirmed, worker arrives
5. If declines: try next nearest worker

**Advantages:**
- Fastest booking possible
- Real emergency solution
- High demand = high prices possible

**Disadvantages:**
- Needs real-time location tracking
- Complex logistics
- Workers may feel forced
- Not all services suit "instant"

**Implementation Status:** ⏳ Future (requires geo-tracking, real-time)

---

## MVP Strategy

**Phase 5-7:** Direct Worker Booking
- Simple
- Demonstrates core marketplace
- Customers learn platform

**Future Phases:** Add other modes based on demand
- If customers want faster → add Auto-Assign
- If workers request control → add Bid System
- If urgent jobs common → add Instant/On-Demand

---

## Current Implementation Details

**Endpoint:** `POST /api/bookings`

**Body:**
```json
{
  "workerId": 2,
  "serviceId": 1,
  "scheduledDate": "2026-02-01T10:00:00.000Z",
  "addressDetails": "House 21, Andheri West, Mumbai",
  "estimatedPrice": 900,
  "notes": "Leaking pipe in kitchen"
}
```

**Validations:**
- Worker exists
- Service exists
- Worker offers that service
- Scheduled date is in future

**Status Progression:**
```
PENDING (customer creates)
  ↓
CONFIRMED (worker accepts)
  ↓
IN_PROGRESS (worker starts)
  ↓
COMPLETED (worker finishes)

OR

CANCELLED (either party cancels with reason)
```

---

## Notes

- **Multi-mode support:** Platform can support all 4 modes simultaneously
- **Different pricing:** Can charge different commission % per mode
- **Worker preferences:** Let workers choose which modes they accept
- **Customer choice:** Show available modes at booking time
