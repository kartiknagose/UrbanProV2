# UrbanPro V2 — Production Roadmap

> **From MVP to Real-Time Marketplace**
>
> This document outlines the complete development workflow to transform UrbanPro V2
> from a working prototype into a production-grade, scalable marketplace — comparable
> to Urban Company, Amazon Home Services, Uber, and Blinkit.
>
> **Last updated:** February 11, 2026

---

## Table of Contents

1. [Current State (Phase 0)](#phase-0-current-state)
2. [Phase 1 — Trust & Safety](#phase-1-trust--safety)
3. [Phase 2 — Real-Time & Location](#phase-2-real-time--location)
4. [Phase 3 — Real Payments](#phase-3-real-payments)
5. [Phase 4 — Mobile-First Experience](#phase-4-mobile-first-experience)
6. [Phase 5 — Intelligence & Automation](#phase-5-intelligence--automation)
7. [Phase 6 — Scale & Deploy](#phase-6-scale--deploy)
8. [Phase 7 — Business Growth](#phase-7-business-growth)
9. [Technical Architecture](#technical-architecture)
10. [Database Evolution Plan](#database-evolution-plan)
11. [API Design Standards](#api-design-standards)
12. [Testing Strategy](#testing-strategy)
13. [Priority Matrix](#priority-matrix)

---

## Phase 0: Current State

### What We Have

| Module                | Status | Details                                                      |
| --------------------- | ------ | ------------------------------------------------------------ |
| Authentication        | ✅ Done | JWT cookie-based auth, email/password login, role-based access |
| User Roles            | ✅ Done | CUSTOMER, WORKER, ADMIN with protected routes                |
| Service Catalog       | ✅ Done | 10 services across 5 categories with CRUD by admin           |
| Booking Lifecycle     | ✅ Done | PENDING → CONFIRMED → IN_PROGRESS → COMPLETED / CANCELLED   |
| Payment (Simulated)   | ✅ Done | Mark-as-paid flow with payment records                       |
| Two-Way Reviews       | ✅ Done | Customer ↔ Worker reviews, aggregate rating on worker profile |
| Worker Verification   | ✅ Done | Application → Admin approval workflow                        |
| Admin Dashboard       | ✅ Done | Stats, user management, booking oversight                    |
| Worker Dashboard      | ✅ Done | One-click Accept / Reject / Start / Complete buttons         |
| Customer Dashboard    | ✅ Done | Quick Pay and Leave Review actions                           |
| Theme System          | ✅ Done | Dark / Light mode with persistence                           |
| Responsive Design     | ✅ Done | Mobile-friendly layout                                       |

### Current Tech Stack

```
Frontend:   React 18 + Vite + React Router + TanStack Query
Styling:    Tailwind CSS + custom design tokens
Animation:  Framer Motion
Backend:    Node.js + Express.js
Database:   PostgreSQL via Prisma ORM
Auth:       JWT (httpOnly cookies) + bcryptjs
```

### What's Missing for Production

- No real payment processing
- No real-time updates (polling only)
- No location/map features
- No push notifications
- No chat system
- No OTP verification
- No file uploads (photos, documents)
- No containerization or CI/CD
- No monitoring or logging
- No rate limiting beyond basic

---

## Phase 1: Trust & Safety

**Timeline:** Week 1–2
**Goal:** Users won't book a stranger to come to their home without trust mechanisms.

### 1.1 Worker Identity Verification (KYC)

**Problem:** Currently, any user can sign up as a worker. There is no identity verification.

**Solution:**

Workers must complete identity verification before receiving bookings:

```
Registration → Submit Documents → Admin Reviews → Approved / Rejected
```

**Implementation Details:**

| Document        | Format     | Storage      | Verification Method      |
| --------------- | ---------- | ------------ | ------------------------ |
| Aadhaar Card    | Image/PDF  | AWS S3       | Manual review by admin   |
| PAN Card        | Image/PDF  | AWS S3       | Manual review by admin   |
| Selfie Photo    | Image      | AWS S3       | Face match with Aadhaar  |
| Address Proof   | Image/PDF  | AWS S3       | Manual review by admin   |

**Schema Changes:**

```prisma
model WorkerVerification {
  id              Int      @id @default(autoincrement())
  workerProfileId Int      @unique
  workerProfile   WorkerProfile @relation(fields: [workerProfileId], references: [id])

  aadhaarUrl      String?
  panUrl          String?
  selfieUrl       String?
  addressProofUrl String?

  verificationLevel VerificationLevel @default(BASIC)
  backgroundCheck   BackgroundCheckStatus @default(PENDING)

  verifiedAt      DateTime?
  verifiedBy      Int?        // Admin user ID
  rejectionReason String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum VerificationLevel {
  BASIC         // Email verified only
  DOCUMENTS     // Documents submitted
  VERIFIED      // Admin approved
  PREMIUM       // Background check passed
}

enum BackgroundCheckStatus {
  PENDING
  IN_PROGRESS
  PASSED
  FAILED
}
```

**Frontend Changes:**
- Worker onboarding wizard (multi-step form with file uploads)
- Admin verification dashboard (view documents, approve/reject)
- Verification badges on worker profiles visible to customers
- Filter workers by verification level in search

**Trust Badges Displayed to Customers:**

| Badge              | Criteria                              | Icon     |
| ------------------ | ------------------------------------- | -------- |
| ✅ ID Verified     | Aadhaar + PAN approved                | Shield   |
| 🔒 Background OK  | Background check passed               | Lock     |
| ⭐ Top Rated       | Rating ≥ 4.5 with 20+ reviews        | Star     |
| 🏆 UrbanPro Pro    | All of the above + 100+ bookings     | Trophy   |

---

### 1.2 OTP-Based Booking Verification

**Problem:** Workers can fraudulently mark a job as "Started" without being present.

**Solution:** Generate a 4-digit OTP when booking is CONFIRMED. Customer shares it with the worker in person. Worker enters OTP in the app to transition from CONFIRMED → IN_PROGRESS.

**Flow:**

```
Booking Confirmed
  └→ System generates OTP (4-digit)
  └→ Customer sees OTP on their dashboard / receives SMS
  └→ Worker arrives at location
  └→ Customer tells worker the OTP
  └→ Worker enters OTP in app
  └→ System verifies → Status changes to IN_PROGRESS
  └→ OTP expires after 30 minutes
```

**Schema Changes:**

```prisma
model Booking {
  // ... existing fields ...
  startOtp          String?    // 4-digit code
  otpGeneratedAt    DateTime?
  otpVerifiedAt     DateTime?
}
```

**API Endpoints:**

| Method | Endpoint                        | Role   | Action                      |
| ------ | ------------------------------- | ------ | --------------------------- |
| GET    | `/api/bookings/:id/otp`         | CUSTOMER | View OTP for confirmed booking |
| POST   | `/api/bookings/:id/verify-otp`  | WORKER   | Submit OTP to start job     |

---

### 1.3 Photo Proof of Work

**Problem:** No evidence of work quality. Disputes are hard to resolve.

**Solution:** Worker uploads before/after photos at job start and completion.

**Implementation:**

```
Job Start (IN_PROGRESS)
  └→ Worker takes "before" photos (2-5 images)
  └→ Uploaded to S3, linked to booking

Job Complete (COMPLETED)
  └→ Worker takes "after" photos (2-5 images)
  └→ Customer reviews photos before confirming completion
  └→ Photos available for dispute resolution
```

**Schema Changes:**

```prisma
model BookingPhoto {
  id        Int      @id @default(autoincrement())
  bookingId Int
  booking   Booking  @relation(fields: [bookingId], references: [id])
  url       String
  type      PhotoType  // BEFORE or AFTER
  caption   String?
  createdAt DateTime @default(now())
}

enum PhotoType {
  BEFORE
  AFTER
}
```

---

### 1.4 SOS / Emergency Button

**Problem:** Safety risk when strangers enter a customer's home.

**Solution:**

- SOS button available in active booking screen for both customer and worker
- Pressing SOS triggers:
  1. SMS to pre-registered emergency contacts
  2. GPS location shared with emergency contacts
  3. Alert sent to UrbanPro support team
  4. Optional: connection to local emergency services

**Schema Changes:**

```prisma
model EmergencyContact {
  id       Int    @id @default(autoincrement())
  userId   Int
  user     User   @relation(fields: [userId], references: [id])
  name     String
  phone    String
  relation String // "Parent", "Spouse", "Friend"
}

model SOSAlert {
  id        Int      @id @default(autoincrement())
  bookingId Int
  booking   Booking  @relation(fields: [bookingId], references: [id])
  triggeredBy Int    // User ID
  latitude  Float?
  longitude Float?
  status    SOSStatus @default(ACTIVE)
  resolvedAt DateTime?
  createdAt DateTime @default(now())
}

enum SOSStatus {
  ACTIVE
  ACKNOWLEDGED
  RESOLVED
}
```

---

## Phase 2: Real-Time & Location

**Timeline:** Week 3–4
**Goal:** Transform from a form-based app to a live, real-time experience.

### 2.1 WebSocket Integration (Socket.IO)

**Problem:** Users must refresh the page to see booking status updates.

**Solution:** WebSocket connection pushes real-time events to all connected clients.

**Architecture:**

```
┌──────────┐                    ┌──────────────┐
│  Client  │ ←── WebSocket ──→  │  Socket.IO   │
│  (React) │                    │   Server     │
└──────────┘                    └──────┬───────┘
                                       │
                                       │ Pub/Sub
                                       │
                                ┌──────▼───────┐
                                │    Redis      │
                                │  (Pub/Sub)    │
                                └──────┬───────┘
                                       │
                                ┌──────▼───────┐
                                │  PostgreSQL   │
                                └──────────────┘
```

**Events to Push in Real-Time:**

| Event                    | Sent To          | Trigger                          |
| ------------------------ | ---------------- | -------------------------------- |
| `booking:created`        | Worker           | Customer creates a booking       |
| `booking:accepted`       | Customer         | Worker accepts (CONFIRMED)       |
| `booking:rejected`       | Customer         | Worker rejects (CANCELLED)       |
| `booking:started`        | Customer         | Worker starts job (IN_PROGRESS)  |
| `booking:completed`      | Customer         | Worker completes job             |
| `booking:paid`           | Worker           | Customer pays                    |
| `review:received`        | Worker/Customer  | Other party leaves review        |
| `worker:location`        | Customer         | Worker's live GPS (every 10s)    |
| `chat:message`           | Worker/Customer  | New chat message                 |
| `notification:general`   | Any              | System announcements             |

**Server Implementation (Socket.IO):**

```javascript
// server/src/config/socket.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token
      || socket.handshake.headers.cookie?.split('token=')[1]?.split(';')[0];

    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const userRole = socket.user.role;

    // Join personal room for targeted notifications
    socket.join(`user:${userId}`);

    // Join role-based room
    socket.join(`role:${userRole}`);

    console.log(`User ${userId} (${userRole}) connected`);

    // Worker location updates
    socket.on('location:update', (data) => {
      // data = { latitude, longitude, bookingId }
      // Broadcast to the customer of the active booking
      io.to(`booking:${data.bookingId}`).emit('worker:location', {
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: Date.now(),
      });
    });

    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`);
    });
  });

  return io;
}

module.exports = { initializeSocket };
```

**Client Implementation (React Hook):**

```javascript
// client/src/hooks/useSocket.js
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

export function useSocket(eventHandlers = {}) {
  const { user } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
      withCredentials: true,
    });

    socketRef.current = socket;

    // Register event handlers
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  return socketRef;
}
```

**NPM Packages Required:**

```bash
# Server
npm install socket.io redis ioredis

# Client
npm install socket.io-client
```

---

### 2.2 Location Services & Maps

**Problem:** No way to show worker location, calculate distances, or estimate arrival times.

**Solution:** Integrate Google Maps API (or Mapbox) for geocoding, routing, and live tracking.

**Features:**

| Feature                | API Used                | Purpose                              |
| ---------------------- | ----------------------- | ------------------------------------ |
| Address autocomplete   | Places Autocomplete API | Clean address input during booking   |
| Geocoding              | Geocoding API           | Convert address to lat/lng           |
| Distance calculation   | Distance Matrix API     | Find nearest workers                 |
| Live tracking map      | Maps JavaScript SDK     | Show worker on map during job        |
| ETA calculation        | Directions API          | "Worker arrives in 15 min"           |
| Service area zones     | Custom polygons         | Restrict services to served areas    |

**Schema Changes:**

```prisma
model UserAddress {
  id          Int    @id @default(autoincrement())
  userId      Int
  user        User   @relation(fields: [userId], references: [id])
  label       String // "Home", "Office"
  fullAddress String
  landmark    String?
  latitude    Float
  longitude   Float
  city        String
  pincode     String
  isDefault   Boolean @default(false)
  createdAt   DateTime @default(now())
}

model WorkerLocation {
  id              Int    @id @default(autoincrement())
  workerProfileId Int    @unique
  workerProfile   WorkerProfile @relation(fields: [workerProfileId], references: [id])
  latitude        Float
  longitude       Float
  isOnline        Boolean @default(false)
  lastUpdated     DateTime @default(now())
}
```

---

### 2.3 Auto-Assignment Algorithm

**Problem:** Customer manually picks a worker. This doesn't scale.

**Solution:** When a customer books a service, the system automatically finds the best matching worker.

**Matching Algorithm (Weighted Score):**

```
Score = (Distance × 0.30) + (Rating × 0.25) + (Availability × 0.20)
      + (Experience × 0.15) + (Response Rate × 0.10)
```

| Factor          | Weight | Measurement                              |
| --------------- | ------ | ---------------------------------------- |
| Distance        | 30%    | Km from customer (inverse — closer = higher) |
| Rating          | 25%    | Average review rating (1–5)              |
| Availability    | 20%    | Has open slots in requested time         |
| Experience      | 15%    | Total completed bookings                 |
| Response Rate   | 10%    | % of bookings accepted within 5 min      |

**Flow:**

```
Customer books service
  └→ System queries workers who:
      ├── Offer the requested service
      ├── Are within 10km radius
      ├── Have availability on requested date/time
      └── Are verified (level ≥ VERIFIED)
  └→ Ranks by weighted score
  └→ Sends request to top worker
  └→ Worker has 5 min to accept
      ├── Accepted → Booking confirmed
      └── Declined / Timeout → Auto-send to next worker
```

---

### 2.4 Push Notifications

**Problem:** Users don't know about booking updates unless they open the app.

**Solution:** Multi-channel notification system.

| Channel          | Use Case                              | Library/Service     |
| ---------------- | ------------------------------------- | ------------------- |
| In-App (Socket)  | Real-time while app is open           | Socket.IO           |
| Push (Browser)   | When app is in background             | Web Push API + VAPID |
| Email            | Booking confirmations, receipts       | Nodemailer + SendGrid |
| SMS              | OTP, critical alerts, SOS             | Twilio / MSG91      |
| WhatsApp         | Booking reminders (India market)      | Twilio WhatsApp API |

**Notification Preferences Schema:**

```prisma
model NotificationPreference {
  id       Int    @id @default(autoincrement())
  userId   Int    @unique
  user     User   @relation(fields: [userId], references: [id])

  emailBookings     Boolean @default(true)
  emailPromotions   Boolean @default(true)
  smsBookings       Boolean @default(true)
  smsPromotions     Boolean @default(false)
  pushEnabled       Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Notification {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  type      String   // "booking_update", "review_received", "payment", "promo"
  title     String
  message   String
  data      Json?    // { bookingId: 5, status: "CONFIRMED" }
  read      Boolean  @default(false)
  readAt    DateTime?
  createdAt DateTime @default(now())
}
```

---

## Phase 3: Real Payments

**Timeline:** Week 5–6
**Goal:** Replace simulated payments with actual money flow.

### 3.1 Payment Gateway Integration

**Recommended:** Razorpay (India market) or Stripe (global)

**Why Razorpay for India:**
- UPI, cards, net banking, wallets — all in one SDK
- ₹0 setup fee, 2% per transaction
- Auto-settlement to bank accounts
- Subscription and recurring payment support
- Excellent documentation and dashboard

**Payment Flow — Escrow Model:**

```
┌─────────────────────────────────────────────────────────────┐
│                     PAYMENT LIFECYCLE                       │
│                                                             │
│  Customer                 Platform                 Worker   │
│     │                        │                       │      │
│     │──── Books Service ────→│                       │      │
│     │                        │                       │      │
│     │←── Payment Link ──────│                       │      │
│     │                        │                       │      │
│     │──── Pays ₹1000 ──────→│                       │      │
│     │                        │── Holds in Escrow ──→│      │
│     │                        │                       │      │
│     │                        │   Worker Completes    │      │
│     │                        │   Customer Confirms   │      │
│     │                        │                       │      │
│     │                        │── Commission ₹200 ──→ Platform│
│     │                        │── Payout ₹800 ──────→│      │
│     │                        │                       │      │
│     │←── Invoice + Receipt ──│                       │      │
└─────────────────────────────────────────────────────────────┘
```

**Schema Changes:**

```prisma
model Payment {
  id               Int           @id @default(autoincrement())
  bookingId        Int
  booking          Booking       @relation(fields: [bookingId], references: [id])
  customerId       Int
  customer         User          @relation(fields: [customerId], references: [id])

  // Razorpay fields
  razorpayOrderId   String?   @unique
  razorpayPaymentId String?   @unique
  razorpaySignature String?

  amount           Decimal
  currency         String    @default("INR")
  status           PaymentStatus @default(PENDING)
  method           String?   // "upi", "card", "netbanking", "wallet"

  // Commission
  platformFee      Decimal?  // Platform's cut
  workerPayout     Decimal?  // Amount to worker
  payoutStatus     PayoutStatus @default(PENDING)
  payoutReference  String?

  // Refund
  refundAmount     Decimal?
  refundReason     String?
  refundedAt       DateTime?

  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}

enum PaymentStatus {
  PENDING
  AUTHORIZED     // Payment authorized but not captured
  CAPTURED       // Money received
  FAILED
  REFUNDED
  PARTIALLY_REFUNDED
}

enum PayoutStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

**Razorpay Integration Steps:**

```
1. npm install razorpay
2. Create Razorpay account → Get API keys
3. Server: Create order → Return orderId to frontend
4. Frontend: Open Razorpay checkout modal
5. User completes payment
6. Razorpay sends webhook to server
7. Server verifies signature → Updates payment status
8. Server schedules worker payout (T+1)
```

---

### 3.2 Commission & Payout System

**Commission Model:**

| Service Category | Platform Commission | Worker Gets |
| ---------------- | ------------------- | ----------- |
| Cleaning         | 20%                 | 80%         |
| Plumbing         | 15%                 | 85%         |
| Electrical       | 15%                 | 85%         |
| AC Repair        | 18%                 | 82%         |
| Painting         | 12%                 | 88%         |

**Payout Schedule:**
- Daily automatic settlement at 11 PM IST
- Minimum payout threshold: ₹100
- Workers can request instant payout (small fee)

---

### 3.3 Refund & Cancellation Policy

| When Cancelled                     | Customer Refund | Worker Compensation |
| ---------------------------------- | --------------- | ------------------- |
| Before worker accepts              | 100% refund     | ₹0                  |
| After acceptance, > 2hr before job | 100% refund     | ₹0                  |
| After acceptance, < 2hr before job | 75% refund      | 25% of booking      |
| After worker reaches location      | 50% refund      | 50% of booking      |
| After job starts                   | No refund       | Full payout         |

---

### 3.4 Dynamic Pricing Engine

**Pricing = Base Price × Multipliers**

| Factor           | Multiplier Range | Logic                               |
| ---------------- | ---------------- | ----------------------------------- |
| Time of day      | 1.0x – 1.5x     | Evening/weekend = higher            |
| Demand/supply    | 1.0x – 2.0x     | High demand, few workers = surge    |
| Urgency          | 1.0x – 1.8x     | Same-day booking = premium          |
| Worker rating    | 1.0x – 1.3x     | Top-rated workers charge more       |
| Distance         | 1.0x – 1.2x     | Farther = travel surcharge          |

**Formula:**

```
Final Price = Base Price
            × Time Multiplier
            × Demand Multiplier
            × Urgency Multiplier
            × Worker Tier Multiplier
            + Distance Surcharge
            + GST (18%)
```

---

### 3.5 Invoicing & Tax Compliance

- Auto-generate GST-compliant invoices for every completed booking
- Monthly revenue reports for workers (for ITR filing)
- Platform GST registration and filing
- TDS deduction where applicable

---

## Phase 4: Mobile-First Experience

**Timeline:** Week 7–8
**Goal:** 80%+ of home service bookings happen on mobile devices.

### 4.1 Progressive Web App (PWA) — Recommended First Step

**Why PWA before native apps:**
- Zero additional code (works with existing React app)
- Install to home screen
- Push notifications
- Offline capability
- No app store approval delays
- Ships in 1 day

**Implementation Checklist:**

```
[ ] Create manifest.json (app name, icons, theme color)
[ ] Register service worker (Vite PWA plugin)
[ ] Add install prompt banner
[ ] Implement offline page
[ ] Configure push notification subscription
[ ] Add splash screens for iOS/Android
[ ] Test with Lighthouse PWA audit (target score: 90+)
```

**Required Package:**

```bash
npm install -D vite-plugin-pwa
```

---

### 4.2 Native Mobile App (Phase 6+ when needed)

**When to build native apps:**
- You have 10,000+ monthly active users
- PWA push notifications aren't sufficient
- You need deep OS integration (camera, GPS background, NFC payments)
- App store presence becomes important for marketing

**Recommended Stack:**

| Option        | Best For                     | Effort    |
| ------------- | ---------------------------- | --------- |
| React Native  | Sharing logic with web app   | Medium    |
| Expo          | Fastest to ship              | Low       |
| Flutter       | Best UI performance          | Medium    |
| Swift/Kotlin  | Best native experience       | High      |

**Recommendation:** Start with **Expo (React Native)** — fastest path from your existing React codebase.

---

## Phase 5: Intelligence & Automation

**Timeline:** Week 9–10
**Goal:** Use data to make smarter decisions automatically.

### 5.1 Smart Worker Matching

Replace manual worker selection with ML-based matching:

```
Input Features:
  - Customer location (lat/lng)
  - Requested service category
  - Preferred date/time
  - Customer's past rating behavior
  - Budget range

Matching Model:
  - Collaborative filtering (customers who liked X also liked Y)
  - Gradient boosted trees for scoring
  - Real-time feature store (Redis)

Output:
  - Ranked list of workers with match scores
  - Estimated price range
  - Predicted customer satisfaction score
```

---

### 5.2 Demand Forecasting

Predict service demand by area, time, and category:

| Data Source            | Feature                              |
| ---------------------- | ------------------------------------ |
| Historical bookings    | Seasonality, day-of-week patterns    |
| Weather data           | Rain → more plumbing, summer → more AC |
| Local events           | Festival → more cleaning             |
| New construction data  | New buildings → electrical + painting |

**Use Cases:**
- Pre-position workers in high-demand areas
- Send proactive SMS: "Summer is here — book AC service at 20% off!"
- Optimize worker schedules for maximum utilization

---

### 5.3 Fraud Detection

| Fraud Pattern                | Detection Method                     | Action              |
| ---------------------------- | ------------------------------------ | -------------------- |
| Fake reviews                 | NLP sentiment analysis + IP tracking | Auto-flag + review   |
| Worker no-shows              | GPS verify at scheduled time         | Auto-penalty         |
| Payment chargebacks          | Transaction pattern analysis         | Account freeze       |
| Fake bookings (spam)         | Rate limiting + device fingerprint   | Block                |
| Off-platform transactions    | Detect keywords in chat              | Warning              |

---

### 5.4 In-App Chat System

**Problem:** Customer and worker have no way to communicate within the app.

**Solution:** Real-time chat tied to each booking.

**Features:**
- Text messages
- Image sharing (for showing the problem)
- Voice messages
- Quick replies ("I'm on my way", "Please wait 10 min")
- Auto-translated messages (Hindi ↔ English)

**Schema:**

```prisma
model ChatMessage {
  id        Int      @id @default(autoincrement())
  bookingId Int
  booking   Booking  @relation(fields: [bookingId], references: [id])
  senderId  Int
  sender    User     @relation(fields: [senderId], references: [id])
  content   String
  type      MessageType @default(TEXT)
  mediaUrl  String?
  readAt    DateTime?
  createdAt DateTime @default(now())
}

enum MessageType {
  TEXT
  IMAGE
  VOICE
  QUICK_REPLY
  SYSTEM  // "Worker has accepted your booking"
}
```

---

### 5.5 Analytics Dashboard (Admin)

**Key Metrics to Track:**

| Category     | Metrics                                                    |
| ------------ | ---------------------------------------------------------- |
| Revenue      | GMV, platform revenue, avg booking value, MoM growth       |
| Users        | DAU, MAU, new signups, churn rate                          |
| Bookings     | Completion rate, cancellation rate, avg time to complete    |
| Workers      | Utilization rate, avg response time, earnings distribution |
| Quality      | Avg rating, complaint rate, repeat booking rate            |
| Marketing    | CAC, CLV, referral conversion rate                         |

---

## Phase 6: Scale & Deploy

**Timeline:** Week 11–12
**Goal:** From localhost to handling 10,000+ concurrent users.

### 6.1 Infrastructure Architecture

```
                        ┌─────────────────┐
                        │   CloudFlare    │  CDN + DDoS Protection
                        │   (or AWS CF)   │  + SSL Termination
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │    Nginx /      │  Reverse Proxy
                        │  API Gateway    │  + Load Balancing
                        │  (Kong / AWS)   │  + Rate Limiting
                        └────────┬────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
        ┌─────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐
        │ API Pod 1 │     │ API Pod 2 │     │ API Pod 3 │
        │ (Node.js) │     │ (Node.js) │     │ (Node.js) │
        └─────┬─────┘     └─────┬─────┘     └─────┬─────┘
              │                  │                  │
        ┌─────▼──────────────────▼──────────────────▼─────┐
        │              Redis Cluster                       │
        │  (Sessions, Cache, Pub/Sub, Rate Limiting)       │
        └─────────────────────┬───────────────────────────┘
                              │
        ┌─────────────────────▼───────────────────────────┐
        │       PostgreSQL (Primary + Read Replicas)       │
        └─────────────────────┬───────────────────────────┘
                              │
        ┌─────────────────────▼───────────────────────────┐
        │            AWS S3 / Cloudinary                    │
        │   (Photos, Documents, Invoices, Static Assets)   │
        └─────────────────────────────────────────────────┘
```

---

### 6.2 Deployment Stack

| Component        | Free-Tier Production (Current)          | Scale-Up (Future)               |
| ---------------- | ---------------------------------------- | ------------------------------- |
| Hosting          | Vercel (frontend) + Render Node (API)   | AWS ECS / GCP Cloud Run         |
| Database         | Supabase / Neon                          | AWS RDS (Multi-AZ)              |
| Cache            | Upstash Redis                            | AWS ElastiCache (Redis)         |
| File Storage     | Cloudinary                               | AWS S3 + CloudFront             |
| CI/CD            | GitHub Actions (lint + build checks)     | GitHub Actions + progressive CD |
| Container        | Not required                             | Optional (Docker/Kubernetes)    |
| Monitoring       | Render logs + basic metrics              | Grafana + Prometheus            |
| Error Tracking   | Console + host logs                      | Sentry                          |
| Logging          | Console / Winston                         | Winston + Loki / ELK            |
| Secrets          | Render/Vercel env vars                   | Secrets Manager/Vault           |

---

### 6.3 Deployment Policy (Docker-Free by Default)

Production deployments use platform-native runtimes:

- Frontend: Vercel (root directory: client)
- Backend: Render Web Service (root directory: server, runtime: Node)
- Database: Supabase or Neon PostgreSQL
- Cache: Upstash Redis
- Media: Cloudinary

Docker is optional and used only for local full-stack parity or later infra migration.

---

### 6.4 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: cd server && npm ci && npm test
      - run: cd client && npm ci && npm run build
```

Deployments are then triggered by platform hooks (Render auto-deploy for backend and Vercel auto-deploy for frontend) instead of Docker image publishing.

---

### 6.5 Performance Optimization

| Area       | Optimization                         | Expected Impact         |
| ---------- | ------------------------------------ | ----------------------- |
| Database   | Add indexes on frequently queried columns | 5–10x query speedup   |
| Database   | Connection pooling (PgBouncer)       | Handle 10x more connections |
| Caching    | Redis cache for service catalog, worker profiles | 80% fewer DB reads  |
| API        | Response compression (gzip/brotli)   | 60–70% smaller payloads |
| Frontend   | Code splitting + lazy loading        | 40% faster initial load |
| Frontend   | Image optimization (WebP, lazy load) | 50% less bandwidth     |
| CDN        | Static assets on CloudFront          | <50ms global latency   |
| Queries    | Prisma query batching                | Reduce N+1 queries     |

---

## Phase 7: Business Growth

**Timeline:** Ongoing
**Goal:** Sustainable user acquisition, retention, and revenue growth.

### 7.1 User Acquisition Features

| Feature               | How It Works                                        | Expected ROI |
| --------------------- | --------------------------------------------------- | ------------ |
| Referral Program      | User refers friend → both get ₹100 credit           | High         |
| First Booking Offer   | 30% off first booking                               | High         |
| SEO Landing Pages     | "/plumber-in-mumbai", "/ac-repair-delhi"             | Medium       |
| Google/Meta Ads       | Targeted ads to location + interest                  | Medium       |
| Influencer Partnerships | Local influencers demo the service                 | Medium       |
| Corporate Tie-ups     | B2B contracts with offices, apartments               | High         |

---

### 7.2 Retention Features

| Feature                | Implementation                                    |
| ---------------------- | ------------------------------------------------- |
| **UrbanPro Plus**      | Subscription: ₹199/month → priority booking, 10% off, free cancellation |
| **Loyalty Points**     | 1 point per ₹10 spent → redeem 100 points = ₹20 off |
| **Service Packages**   | "Home Maintenance Pack" = cleaning + AC + plumbing at 25% off |
| **Repeat Booking**     | One-click rebook with same worker                 |
| **Scheduled Services** | Recurring bookings (weekly cleaning, monthly AC check) |
| **Wishlist**           | Save workers for future bookings                  |
| **Service Reminders**  | "It's been 6 months since your last AC service"   |

---

### 7.3 Worker Engagement

| Feature              | Purpose                                    |
| -------------------- | ------------------------------------------ |
| Worker Leaderboard   | Gamification — top workers get bonus + visibility |
| Skill Badges         | "Electrician Level 3" based on completions + certifications |
| Guaranteed Earnings  | "Complete 10 jobs this week → earn minimum ₹8000" |
| Training Content     | Video tutorials for skill improvement      |
| Worker Community     | Forum for workers to share tips             |
| Equipment Financing  | Partner with NBFC for tool loans           |

---

### 7.4 Multi-City Expansion

```
City Launch Checklist:
  [ ] Local service catalog with city-specific pricing
  [ ] Onboard minimum 50 workers per category
  [ ] Set up service area boundaries (geo-fencing)
  [ ] Local payment methods (if different)
  [ ] Customer support in local language
  [ ] Marketing budget for launch promotions
  [ ] Compliance with local regulations
```

---

## Technical Architecture

### Complete System Architecture (Production)

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Web App  │  │ PWA      │  │ iOS App  │  │ Android  │         │
│  │ (React)  │  │ (React)  │  │ (RN/Expo)│  │ (RN/Expo)│         │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘         │
│       └──────────────┴──────────────┴──────────────┘              │
│                              │                                    │
│                      HTTPS + WebSocket                            │
└──────────────────────────────┼────────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────────┐
│                       API GATEWAY LAYER                           │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Nginx / Kong / AWS API Gateway                             │  │
│  │  - SSL Termination                                          │  │
│  │  - Rate Limiting (100 req/min/user)                         │  │
│  │  - Request Routing                                          │  │
│  │  - CORS                                                     │  │
│  │  - WebSocket Upgrade                                        │  │
│  └────────────────────────────┬────────────────────────────────┘  │
└───────────────────────────────┼───────────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────────┐
│                      APPLICATION LAYER                            │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐      │
│  │  API     │  │ Socket   │  │  Job     │  │ Notification │      │
│  │ Server   │  │ Server   │  │ Queue    │  │ Service      │      │
│  │(Express) │  │(Socket.IO│  │ (Bull)   │  │ (Email/SMS)  │      │
│  │          │  │ + Redis) │  │          │  │              │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘      │
│       └──────────────┴──────────────┴──────────────┘              │
└───────────────────────────────┼───────────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────────┐
│                        DATA LAYER                                 │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐      │
│  │PostgreSQL│  │  Redis   │  │  AWS S3  │  │ Elasticsearch│      │
│  │(Primary +│  │ (Cache,  │  │ (Files,  │  │ (Search,     │      │
│  │ Replicas)│  │  Queue,  │  │  Images) │  │  Analytics)  │      │
│  │          │  │  PubSub) │  │          │  │              │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Database Evolution Plan

### Current → Production Migration Path

```
Phase 0 (Now):     12 tables
Phase 1 (Safety):  +4 tables (WorkerVerification, EmergencyContact, SOSAlert, BookingPhoto)
Phase 2 (Realtime):+3 tables (UserAddress, WorkerLocation, Notification)
Phase 3 (Payment): +0 tables (Payment table enhanced with Razorpay fields)
Phase 5 (Chat):    +1 table  (ChatMessage)
Phase 7 (Growth):  +3 tables (Referral, Subscription, LoyaltyPoints)

Total Production:  ~23 tables
```

---

## API Design Standards

### REST API Convention

```
GET    /api/v1/bookings          → List bookings (with pagination)
GET    /api/v1/bookings/:id      → Get single booking
POST   /api/v1/bookings          → Create booking
PATCH  /api/v1/bookings/:id      → Update booking
DELETE /api/v1/bookings/:id      → Delete booking (soft delete)

Query Parameters:
  ?page=1&limit=20              → Pagination
  ?sort=createdAt:desc          → Sorting
  ?status=COMPLETED             → Filtering
  ?search=plumber               → Text search
  ?include=reviews,payments     → Related data
```

### Standard API Response Format

```json
// Success
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "BOOKING_NOT_FOUND",
    "message": "Booking with ID 999 does not exist.",
    "statusCode": 404
  }
}
```

### API Versioning

Add `/api/v1/` prefix to all routes. When breaking changes are needed, introduce `/api/v2/` while keeping v1 alive for backward compatibility.

---

## Testing Strategy

### Testing Pyramid

```
                 ┌───────┐
                 │  E2E  │        5% — Playwright / Cypress
                 │ Tests │        Critical user flows only
                ┌┴───────┴┐
                │Integration│     25% — Supertest + Test DB
                │  Tests   │      API endpoint testing
               ┌┴──────────┴┐
               │  Unit Tests │    70% — Jest / Vitest
               │             │    Service logic, utils, validators
               └─────────────┘
```

### What to Test

| Layer        | Tool              | What                                    |
| ------------ | ----------------- | --------------------------------------- |
| Unit         | Jest              | Service functions, validators, utils    |
| Integration  | Supertest + Jest  | Full API request/response cycle         |
| E2E          | Playwright        | Login → Book → Pay → Review flow        |
| Performance  | k6 / Artillery    | API load testing (target: 500 req/s)    |
| Security     | OWASP ZAP         | SQL injection, XSS, CSRF               |

---

## Priority Matrix

### What to Build Next (Effort vs Impact)

```
HIGH IMPACT ────────────────────────────────────────────────
  │                                                        │
  │  🔴 Razorpay         🔴 Real-Time            🟡 Auto│
  │     Integration         Notifications           Assign│
  │                                                        │
  │  🔴 OTP Booking      🟡 In-App Chat                   │
  │     Verification                                       │
  │                                                        │
  │  🟡 PWA Support      🟡 Worker                        │
  │                          Location                      │
  │                                                        │
  │  🟢 Referral         🟢 Analytics       🟢 Demand    │
  │     Program              Dashboard          Forecast  │
  │                                                        │
  │  🟢 Service          🟢 Loyalty                       │
  │     Packages             Points                        │
  │                                                        │
LOW IMPACT  ────────────────────────────────────────────────
  LOW EFFORT                                    HIGH EFFORT
```

**Legend:** 🔴 Do first | 🟡 Do second | 🟢 Do when ready

---

## Summary

```
Phase 0 (NOW):    MVP ✅ — Working app with core features
Phase 1 (W1-2):   Trust — KYC, OTP, photo proof, SOS
Phase 2 (W3-4):   Real-Time — WebSocket, maps, auto-assign
Phase 3 (W5-6):   Money — Razorpay, escrow, payouts, invoicing
Phase 4 (W7-8):   Mobile — PWA → native apps
Phase 5 (W9-10):  Intelligence — ML matching, fraud, chat, analytics
Phase 6 (W11-12): Scale — Docker, K8s, CI/CD, monitoring
Phase 7 (Ongoing): Growth — Referrals, subscriptions, multi-city
```

> **Remember:** Amazon started as a bookstore. Uber started in San Francisco only.
> Build one phase at a time. Ship fast. Iterate based on user feedback.

---

*Document authored for UrbanPro V2 project.*
*For questions or to begin any phase, open a new conversation with the phase number.*
