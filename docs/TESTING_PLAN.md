# 🧪 COMPLETE TESTING PLAN - UrbanPro V2 Bookings Module

**Date:** January 29, 2026  
**Status:** Pre-Testing Setup Phase  
**Objective:** Build complete test data and verify booking workflow end-to-end

---

## 📊 CURRENT STATE

### Database Status:
- ✅ 1 Customer user (registered)
- ❌ 0 Services
- ❌ 0 Workers
- ❌ 0 Worker Profiles
- ❌ 0 Worker-Service associations
- ❌ 0 Bookings

### What's Complete:
- ✅ Auth endpoints (register, login, logout, me)
- ✅ Worker profile endpoints (create/update, view)
- ✅ Services endpoints (list, get by ID)
- ✅ Bookings endpoints (create, list, view, update status, cancel)
- ✅ Database schema (all models)
- ✅ Prisma migrations applied

### What's Missing for Testing:
- ❌ Service creation endpoint (admin)
- ❌ Worker-Service association endpoint
- ❌ Test data (services, workers)

---

## 🎯 TESTING PHASES

### **PHASE 1: Create Services via API** 📝

**Goal:** Build admin endpoint to create services

**Tasks:**
1. Add `createService()` function to `service.service.js`
2. Add `createService()` controller to `service.controller.js`
3. Add validation schema `createServiceSchema` to `service.schemas.js` (new file)
4. Add `POST /api/services` route (admin/auth required)
5. Test with Postman

**Why:** Need services in database before workers can offer them

**Time Estimate:** 15-20 minutes (with teaching explanations)

---

### **PHASE 2: Register Worker User** 👷

**Goal:** Create a worker account via existing auth endpoint

**Postman Request:**
```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "name": "Rajesh Kumar",
  "email": "rajesh.worker@example.com",
  "password": "Worker@123",
  "role": "WORKER"
}
```

**Expected Response:** 201 with user object and JWT token in cookie

**Why:** Need at least one worker to test bookings

**Time Estimate:** 2 minutes

---

### **PHASE 3: Create Worker Profile** 🛠️

**Goal:** Worker creates their profile with bio, skills, hourly rate

**Postman Request:**
```http
POST http://localhost:3000/api/workers/profile
Cookie: token=<WORKER_JWT_TOKEN>
Content-Type: application/json

{
  "bio": "Experienced plumber with 10 years of expertise in residential and commercial plumbing",
  "hourlyRate": 500,
  "skills": ["Plumbing", "Pipe Fitting", "Leak Detection", "Water Heater Installation"],
  "serviceAreas": ["Mumbai", "Navi Mumbai", "Thane"]
}
```

**Expected Response:** 201 with worker profile object

**Why:** Worker needs a profile to receive bookings

**Time Estimate:** 2 minutes

---

### **PHASE 4: Associate Worker with Services** 🔗

**Goal:** Build endpoint to link workers with services they offer

**Tasks:**
1. Add `addWorkerService()` function to `worker.service.js`
2. Add `addWorkerService()` controller to `worker.controller.js`
3. Add validation schema for worker-service association
4. Add `POST /api/workers/services` route
5. Test with Postman

**Postman Request (after building):**
```http
POST http://localhost:3000/api/workers/services
Cookie: token=<WORKER_JWT_TOKEN>
Content-Type: application/json

{
  "serviceId": 2
}
```

**Why:** System must verify worker offers the service before accepting bookings

**Time Estimate:** 15-20 minutes (with teaching explanations)

---

### **PHASE 5: Test Booking Creation** 🎯

**Goal:** Customer books a worker for a service

**Prerequisites:**
- ✅ Service exists (ID: 2 - Plumbing)
- ✅ Worker exists (ID: 2)
- ✅ Worker Profile exists (ID: 1)
- ✅ Worker offers service (WorkerService entry exists)

**Step 1: Login as Customer**
```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "your-customer-email@example.com",
  "password": "your-password"
}
```

**Step 2: Browse Available Services**
```http
GET http://localhost:3000/api/services
```

**Step 3: Create Booking**
```http
POST http://localhost:3000/api/bookings
Cookie: token=<CUSTOMER_JWT_TOKEN>
Content-Type: application/json

{
  "workerId": 1,
  "serviceId": 2,
  "scheduledDate": "2026-02-15T10:00:00.000Z",
  "addressDetails": "Flat 301, Royal Apartments, Andheri West, Mumbai 400058, India",
  "estimatedPrice": 800,
  "notes": "Kitchen sink is leaking badly. Please bring replacement parts if needed."
}
```

**Expected Response:** 201 with complete booking object including customer, worker, and service details

**Time Estimate:** 5 minutes

---

### **PHASE 6: Test Booking Workflow** 🔄

**Goal:** Test full booking lifecycle (PENDING → CONFIRMED → IN_PROGRESS → COMPLETED)

#### **Step 1: Worker Views Incoming Bookings**
```http
GET http://localhost:3000/api/bookings
Cookie: token=<WORKER_JWT_TOKEN>
```

**Expected:** List of bookings with status PENDING

---

#### **Step 2: Worker Accepts Booking**
```http
PATCH http://localhost:3000/api/bookings/1/status
Cookie: token=<WORKER_JWT_TOKEN>
Content-Type: application/json

{
  "status": "CONFIRMED"
}
```

**Expected:** 200 with booking status changed to CONFIRMED

---

#### **Step 3: Worker Starts Job**
```http
PATCH http://localhost:3000/api/bookings/1/status
Cookie: token=<WORKER_JWT_TOKEN>
Content-Type: application/json

{
  "status": "IN_PROGRESS"
}
```

**Expected:** 200 with booking status changed to IN_PROGRESS

---

#### **Step 4: Worker Completes Job**
```http
PATCH http://localhost:3000/api/bookings/1/status
Cookie: token=<WORKER_JWT_TOKEN>
Content-Type: application/json

{
  "status": "COMPLETED"
}
```

**Expected:** 200 with booking status changed to COMPLETED

---

#### **Step 5: Customer Views Their Bookings**
```http
GET http://localhost:3000/api/bookings
Cookie: token=<CUSTOMER_JWT_TOKEN>
```

**Expected:** List with the completed booking showing status COMPLETED

---

### **PHASE 7: Test Cancellation Flow** ❌

#### **Scenario A: Customer Cancels Before Worker Accepts**
```http
PATCH http://localhost:3000/api/bookings/2/cancel
Cookie: token=<CUSTOMER_JWT_TOKEN>
Content-Type: application/json

{
  "cancellationReason": "Emergency came up, need to reschedule for next week"
}
```

**Expected:** 200 with booking status CANCELLED

---

#### **Scenario B: Worker Cancels Before Starting**
```http
PATCH http://localhost:3000/api/bookings/3/cancel
Cookie: token=<WORKER_JWT_TOKEN>
Content-Type: application/json

{
  "cancellationReason": "Vehicle broke down, cannot reach location today"
}
```

**Expected:** 200 with booking status CANCELLED

---

## ✅ SUCCESS CRITERIA

### For Each Phase:
- [ ] API endpoint responds without errors
- [ ] Correct HTTP status codes (200, 201, 400, 404, etc.)
- [ ] Data saved correctly in database
- [ ] Validation works (rejects bad data)
- [ ] Authentication works (rejects unauthorized requests)
- [ ] Related data fetched correctly (includes, relations)

### Overall Success:
- [ ] Customer can browse services
- [ ] Customer can book a worker
- [ ] Worker can view incoming bookings
- [ ] Worker can accept/start/complete bookings
- [ ] Both parties can cancel bookings
- [ ] All status transitions work correctly
- [ ] No server crashes or unhandled errors

---

## 📝 TEST DATA TO CREATE

### Services (3 examples):
1. **House Cleaning**
   - Category: Cleaning
   - Base Price: ₹500
   - Description: Professional home cleaning services

2. **Plumbing Repair**
   - Category: Plumbing
   - Base Price: ₹800
   - Description: Fix leaks, install fixtures, repair pipes

3. **Electrical Work**
   - Category: Electrical
   - Base Price: ₹1000
   - Description: Wiring, fixtures, circuit repairs

### Workers (1 example):
- **Name:** Rajesh Kumar
- **Email:** rajesh.worker@example.com
- **Role:** WORKER
- **Bio:** Experienced plumber with 10+ years
- **Hourly Rate:** ₹500
- **Skills:** Plumbing, Pipe Fitting, Leak Detection
- **Service Areas:** Mumbai, Navi Mumbai, Thane
- **Offers Services:** Plumbing Repair

### Bookings (test cases):
1. **Happy Path:** Customer books → Worker accepts → Completes
2. **Customer Cancellation:** Customer books → Customer cancels
3. **Worker Cancellation:** Customer books → Worker accepts → Worker cancels
4. **Multiple Bookings:** Customer books multiple workers for different services

---

## 🚀 EXECUTION ORDER

**Today (Session 1):**
1. ✅ Document testing plan (this file)
2. 🔄 Build service creation endpoint (Phase 1)
3. 🔄 Build worker-service association endpoint (Phase 4)
4. ✅ Test data creation (Phases 2-3)
5. ✅ Test booking creation (Phase 5)

**Tomorrow (Session 2):**
6. ✅ Test booking workflow (Phase 6)
7. ✅ Test cancellation flow (Phase 7)
8. ✅ Fix any bugs found
9. ✅ Git commit and push

---

## 📊 PROGRESS TRACKER

| Phase | Status | Time Spent | Notes |
|-------|--------|------------|-------|
| Phase 1: Service Creation API | 🔄 In Progress | - | Building with guided teaching |
| Phase 2: Register Worker | ⏳ Not Started | - | Use existing auth endpoint |
| Phase 3: Create Worker Profile | ⏳ Not Started | - | Use existing workers endpoint |
| Phase 4: Worker-Service Link API | ⏳ Not Started | - | Build after Phase 1 |
| Phase 5: Test Booking Creation | ⏳ Not Started | - | Requires Phases 1-4 |
| Phase 6: Test Booking Workflow | ⏳ Not Started | - | Requires Phase 5 |
| Phase 7: Test Cancellation | ⏳ Not Started | - | Requires Phase 5 |

---

## 🎯 NEXT IMMEDIATE ACTION

**Start Phase 1: Build Service Creation Endpoint**

Files to create/modify:
1. `server/src/modules/services/service.schemas.js` (NEW)
2. `server/src/modules/services/service.service.js` (ADD createService function)
3. `server/src/modules/services/service.controller.js` (ADD createService handler)
4. `server/src/modules/services/service.routes.js` (ADD POST route)

**Ready to start building? Let's learn!** 🚀
