# ExpertsHub V2: Full Project Overview and AI Features Implementation Plan

## 1. Project Summary
ExpertsHub V2 (UrbanPro V2 workspace) is a service marketplace platform where customers can discover and book local professionals, workers can manage availability and earnings, and admins can control verification, disputes, and platform operations.

The platform is implemented as a hybrid architecture:
- Frontend: React + Vite application in `client/`
- Core backend: Node.js + Express API in `server/src/`
- Data layer: PostgreSQL with Prisma
- Cloud data/auth integration: Supabase SDK and edge functions in `supabase/functions/`
- Real-time and cache: Socket.IO + Redis (ioredis)
- Payments: Razorpay
- Observability: Sentry + structured logging

---

## 2. Current Project Architecture

### 2.1 Frontend (`client/`)
- React 18 with Vite build pipeline
- Tailwind CSS for design system and utility styling
- State and server data:
  - React Query for API state
  - Context API for auth/theme/city/notifications
  - Zustand for local scoped stores where needed
- Feature modules already aligned for scale:
  - API clients in `client/src/api/` (auth, bookings, chat, payments, reviews, safety, verification, workers, customers, admin)
  - Domain components in `client/src/components/features/`
  - Role-based pages in `client/src/pages/`
- PWA capabilities via `vite-plugin-pwa` and service worker assets
- Internationalization present (`i18next` in `client/src/config/`)

### 2.2 Backend (`server/`)
- Express 5 API with modular source layout in `server/src/`
- Prisma ORM and migrations in `server/prisma/`
- Security and reliability middleware: helmet, cors, rate limiting, validation
- Operational capabilities:
  - Real-time communication through Socket.IO
  - Redis-backed caching and pub/sub patterns
  - File/media processing (`multer`, `sharp`, `cloudinary`)
  - Email notifications (`nodemailer`)
  - Scheduled jobs (`node-cron`)
  - Reporting/export (`pdfkit`, `fast-csv`)

### 2.3 Data and Integrations
- PostgreSQL remains the transactional source of truth
- Supabase client is integrated for auth/data services and edge function extensibility
- Redis cache pipeline is retained for performance-sensitive paths
- Payment orchestration is connected to Razorpay

### 2.4 Roles and Core Product Flows
- Customer flows:
  - Account onboarding
  - Service search and booking lifecycle
  - Wallet/payments/reviews
- Worker flows:
  - Registration + KYC
  - Availability management
  - Job acceptance/completion and payout visibility
- Admin flows:
  - Verification moderation
  - Booking/payment/dispute oversight
  - Platform analytics and operational controls

---

## 3. Why AI in ExpertsHub V2
AI is used to improve conversion, trust, safety, and operational efficiency across all three personas.

Primary goals:
- Reduce support and onboarding friction
- Improve worker-customer matching quality
- Detect fraud and abuse earlier
- Improve pricing, utilization, and retention
- Automate repetitive admin workflows

---

## 4. AI Feature Portfolio (Planned and Mapped to Existing Modules)

## 4.1 Chatbot / Virtual Assistant (Highest Priority)
Scope:
- Customer assistant: discover services, create bookings, payment/help support, booking status
- Worker assistant: onboarding guidance, KYC checklist, availability updates, payout and job FAQs
- Admin assistant: triage recurring queries, summarize pending approvals/disputes, quick operational actions

Channels:
- In-app web chat widget
- Optional WhatsApp/voice channel (Phase 2+)

Backend integration points:
- `auth`, `services`, `bookings`, `payments`, `verification`, `notifications`, `chat`, `admin` API modules

Capabilities:
- Intent recognition and guided workflows
- Action execution through existing APIs
- Escalation to human support/admin
- Conversation memory with safe role-based context

## 4.2 Smart Recommendations
Use cases:
- Recommend workers for a booking request
- Recommend services to returning customers
- Suggest optimal slots using historical completion and cancellation patterns

Signals:
- Location distance
- Worker rating and response behavior
- Service category history
- Time/day demand trends

Model approach:
- Start with ranking heuristics and feature-weighted scoring
- Upgrade to learned ranking models after sufficient event data

## 4.3 Fraud Detection and Trust Scoring
Coverage:
- Booking fraud and abnormal cancellation loops
- Payment anomalies and suspicious refund patterns
- Review spam or coordinated manipulation
- Multi-account abuse indicators

Approach:
- Rule engine first (deterministic controls)
- Add anomaly models (Isolation Forest or equivalent) after baseline telemetry quality is strong

Outputs:
- Risk score
- Reason codes
- Action policy (allow, challenge, review, block)

## 4.4 NLP for Reviews and Support Content
Capabilities:
- Sentiment scoring of reviews
- Toxic/abusive language detection
- Intent clustering from support conversations to identify recurring pain points

Outcome:
- Auto-flag high-risk content for moderation
- Feed product improvement backlog with real user pain patterns

## 4.5 Dynamic Pricing Intelligence
Objective:
- Recommend fair, context-aware price bands based on demand, location, time, worker quality, and historical close rates

Guardrails:
- Keep admin-defined min/max boundaries
- Explainability labels for why a recommendation changed

## 4.6 Image and Document Verification (KYC)
Scope:
- OCR extraction from uploaded IDs
- Face/selfie and document consistency checks (where legally permitted)
- Quality checks (blur, crop, mismatch)

Flow impact:
- Faster worker onboarding and reduced manual verification load

## 4.7 Predictive Analytics
Use cases:
- Demand forecasting by city/category/time block
- Worker availability forecasting
- Customer churn propensity and retention trigger suggestions

Surface:
- Admin dashboard cards and scheduled reports

## 4.8 Automated Alerts and Safety Intelligence
Signals:
- Route/activity anomalies
- Panic/safety event risk patterns
- Repeated failed payment or suspicious geo-behavior

Response:
- Real-time alerting + prioritized escalation playbooks

---

## 5. Technical Implementation Design

### 5.1 AI Service Layer (Recommended)
Create a dedicated AI orchestration module in backend:
- `server/src/modules/ai/`
  - `router.js` (AI endpoints)
  - `service.js` (orchestration)
  - `providers/` (LLM, speech, OCR adapters)
  - `policies/` (safety and guardrails)
  - `prompts/` (versioned system/user prompt templates)
  - `tools/` (booking, profile, payment action wrappers)

Why:
- Keeps AI concerns isolated from existing business modules
- Makes provider changes low-risk
- Supports audit logging, fallback, and rate limiting in one place

### 5.2 Data and Event Pipeline
Capture and normalize AI-relevant events:
- Search events
- Booking lifecycle transitions
- Worker acceptance/completion timelines
- Payment outcomes and refunds
- Review and moderation actions
- Support/chat transcripts with privacy-safe retention

Storage strategy:
- Keep transactional writes in PostgreSQL
- Keep derived feature tables/materialized views for model input
- Use Redis for short-lived context caches only

### 5.3 Model Strategy by Phase
- Phase A: Rules + heuristics + prompt workflows
- Phase B: Classical ML models for ranking/anomaly/forecasting
- Phase C: Fine-tuned or retrieval-augmented assistants with stricter governance

### 5.4 Frontend Integration Plan
Add AI UX in existing React architecture:
- Shared AI chat widget under `client/src/components/features/chat/`
- Voice input button and transcript states for supported browsers
- AI recommendation cards on customer and worker dashboards
- Admin AI insights panel in analytics/operations pages

### 5.5 Security, Privacy, and Compliance
- Role-based authorization on every AI action tool
- PII minimization before sending data to external AI providers
- Explicit consent for voice and sensitive automation actions
- Prompt injection defenses and output validation
- Full audit trail for AI-generated actions and overrides

---

## 6. Delivery Roadmap (Project-Specific)

## Phase 1: Chat Assistant MVP (2-3 weeks)
Deliverables:
- In-app text chatbot
- FAQ + guided workflows for onboarding, bookings, and payments
- API tool actions for read-only queries first, then safe write actions
- Admin escalation path

Success metrics:
- 25-35% reduction in repetitive support tickets
- Improved registration-to-first-booking conversion

## Phase 2: Recommendations + Fraud Foundation (3-4 weeks)
Deliverables:
- Worker/service recommendation engine v1
- Fraud rule engine and risk scoring dashboard
- Event instrumentation hardening

Success metrics:
- Higher booking completion and lower cancellation rate
- Reduced manual fraud review load

## Phase 3: NLP + KYC Automation + Dynamic Pricing Pilot (4-6 weeks)
Deliverables:
- Review sentiment and abuse classifier
- OCR-driven KYC pre-check pipeline
- Price recommendation pilot for limited categories/cities

Success metrics:
- Faster verification turnaround
- Lower moderation backlog
- Improved margin and conversion balance

## Phase 4: Predictive Analytics + Safety Intelligence (4 weeks)
Deliverables:
- Forecasting dashboards for demand/churn
- Automated proactive alerts
- Ops playbooks linked to risk thresholds

Success metrics:
- Better workforce planning accuracy
- Earlier detection of high-risk events

---

## 7. Suggested API Endpoints (Initial Contract)
- `POST /api/ai/chat`
- `POST /api/ai/chat/action`
- `POST /api/ai/voice/transcribe`
- `POST /api/ai/voice/speak`
- `GET /api/ai/recommendations/workers`
- `GET /api/ai/recommendations/services`
- `POST /api/ai/fraud/score`
- `POST /api/ai/reviews/analyze`
- `POST /api/ai/kyc/verify`
- `GET /api/ai/forecast/demand`

All endpoints should enforce role-aware scopes and generate structured audit records.

---

## 8. DevOps, Observability, and Quality Gates
- Secrets in server-side environment only; never in public Vite config
- Per-feature flags for progressive rollout and rapid rollback
- Sentry instrumentation for AI endpoints and UI experiences
- Latency/error/cost dashboards per provider and feature
- Offline evaluations and shadow-mode runs before full launch
- Human override controls for high-impact decisions

---

## 9. Risks and Mitigations
- Hallucinated actions:
  - Mitigation: strict tool schema validation + confirmation for sensitive writes
- Data leakage:
  - Mitigation: redaction, scoped retrieval, encrypted logs
- Model drift and unfair outcomes:
  - Mitigation: periodic recalibration, bias checks, fairness dashboards
- Vendor lock-in:
  - Mitigation: provider adapter interface in AI service layer

---

## 10. Immediate Next Sprint Tasks
1. Create `server/src/modules/ai/` scaffold with health and chat endpoints.
2. Build chatbot MVP with read-only tools over bookings/services/profile.
3. Add chat widget shell in frontend and connect to `/api/ai/chat`.
4. Add event tracking for recommendation and fraud training data.
5. Define AI audit log schema and dashboard for admin visibility.

---

## 11. Conclusion
ExpertsHub V2 already has strong modular foundations (frontend API layer, backend modules, real-time stack, Supabase compatibility, and role-driven workflows). This AI plan is designed to integrate incrementally, starting with high-impact assistant automation and then layering recommendations, trust systems, and predictive intelligence without disrupting existing core booking and payment operations.

---

## 12. Implemented AI Command System (March 24, 2026)

### 12.1 API to Action Mapping (Verified)

| Action | Existing Backend API | Backend Service Used by AI Tool | Notes |
|---|---|---|---|
| search workers | `GET /api/services/:id/workers` + `GET /api/services` | `listServices`, `getServiceWorkers` | Service name -> serviceId resolution + optional location filtering |
| get worker details | `GET /api/workers/:workerId` + `GET /api/workers/:workerId/services` | `getWorkerProfileById`, `getWorkerServicesById` | Public profile + offered services |
| check availability | (booking validation path) | `isWorkerAvailable` (exported from booking service) | Slot conflict check before confirmation |
| create booking | `POST /api/bookings` | `createBooking` | No execution without explicit confirmation |
| get bookings | `GET /api/bookings` | `getBookingsByUser` | Role-aware filtering retained |
| get wallet | `GET /api/growth/wallet` | `getWalletSnapshot` (centralized in growth service) | Reused by controller and AI |
| redeem wallet | `POST /api/growth/wallet/redeem` | `redeemWalletBalance` (centralized in growth service) | Confirmation mandatory |
| cancel booking | `PATCH /api/bookings/:id/cancel` | `cancelBooking` | Confirmation mandatory |
| update profile | `POST /api/customers/profile` / `POST /api/workers/profile` | `upsertCustomerProfile`, `upsertWorkerProfile` | Confirmation mandatory |

### 12.2 Implemented Backend Files

- AI routes and controller:
  - `server/src/modules/ai/ai.routes.js`
  - `server/src/modules/ai/ai.controller.js`
- AI orchestrator:
  - `server/src/modules/ai/service.js`
  - `server/src/modules/ai/intent.js`
- Tool contracts:
  - `server/src/modules/ai/tools/`
  - Required tools implemented: `searchWorkers`, `getWorkerDetails`, `checkAvailability`, `createBooking`, `getBookings`, `getWallet`, `redeemWallet`
  - Additional safety tools: `cancelBooking`, `updateProfile`

### 12.3 Implemented Frontend Integration

- API client:
  - `client/src/api/ai.js`
- Chat widget:
  - `client/src/components/features/chat/AICommandWidget.jsx`
- App shell integration:
  - `client/src/App.jsx` (authenticated users)

### 12.4 Security and Safety Controls Added

- Authentication required on AI endpoints
- Dedicated rate limits:
  - `aiChatLimiter`
  - `aiVoiceLimiter`
- Strict tool role checks and input validation
- Explicit confirmation gate for sensitive actions:
  - booking creation
  - wallet redemption
  - cancellation
  - profile updates
- AI action logging for auditability

### 12.5 Voice Ready Extension

- `POST /api/ai/voice` added
- Voice transcript feeds same orchestrator pipeline as chat (no duplicate logic)

### 12.6 Universal Intent Schema Implemented

```json
{
  "intent": "string",
  "confidence": 0.0,
  "entities": {
    "service": "string?",
    "workerId": "number?",
    "date": "string?",
    "time": "string?",
    "price": "number?",
    "location": "string?",
    "mode": "direct | broadcast | undefined"
  }
}
```

Supported intents implemented:
- `create_booking`
- `search_service`
- `get_booking_status`
- `cancel_booking`
- `view_wallet`
- `redeem_wallet`
- `update_profile`
- `help`

---

**Prepared by GitHub Copilot (GPT-5.3-Codex)**  
March 24, 2026
