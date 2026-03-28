# UrbanPro V2 API Catalog + Tool Schema Conversion + Agent Flow

## 1) Objective
This document inventories backend APIs categorically by role and operation, and provides a conversion blueprint to tool schema and full agent orchestration flow.

Scope includes:
- All HTTP routes mounted in server
- Access classification by role
- Operational grouping for tool conversion
- Internal AI operation map (platformOps actions)
- End-to-end agent flow (parse -> authorize -> execute -> summarize)

---

## 2) Access Model
- PUBLIC: No auth required
- AUTHENTICATED: Any logged-in user
- CUSTOMER: Auth + CUSTOMER role
- WORKER: Auth + WORKER role
- ADMIN: Auth + ADMIN role
- CUSTOMER|WORKER: Either role
- INTERNAL: Secret-protected operational route

---

## 3) Non-API and System Routes

| Method | Path | Access | Operation |
|---|---|---|---|
| GET | /health | PUBLIC | Service health status |
| GET | /health/email | PUBLIC* | SMTP/provider readiness check (token-gated in production) |
| POST | /health/email/send-test | PUBLIC* | Send test verification email (token-gated in production) |
| GET | /metrics | PUBLIC | Prometheus metrics |
| GET | /uploads/profile-photos/* | PUBLIC | Public profile photo asset serving |
| GET | /uploads/verification-docs/* | AUTHENTICATED | Secure verification docs access |
| GET | /uploads/booking-photos/* | AUTHENTICATED | Secure booking media access |
| GET | /uploads/chat-attachments/* | AUTHENTICATED | Secure chat media access |

---

## 4) API Catalog by Module (Full)

## 4.1 Auth (/api/auth)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| POST | /api/auth/register | PUBLIC | Register user |
| POST | /api/auth/register-customer | PUBLIC | Register customer |
| POST | /api/auth/register-worker | PUBLIC | Register worker |
| POST | /api/auth/login | PUBLIC | Login |
| POST | /api/auth/logout | AUTHENTICATED | Logout |
| GET | /api/auth/me | AUTHENTICATED | Current user profile |
| GET | /api/auth/verify-email | PUBLIC | Verify email token |
| POST | /api/auth/forgot-password | PUBLIC | Password reset request |
| POST | /api/auth/reset-password | PUBLIC | Password reset submit |
| POST | /api/auth/change-password | AUTHENTICATED | Change password |

## 4.2 Workers (/api/workers)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| POST | /api/workers/profile | AUTHENTICATED | Create/update worker profile |
| GET | /api/workers/me | AUTHENTICATED | Get my worker profile |
| POST | /api/workers/services | WORKER | Add offered service |
| GET | /api/workers/me/services | WORKER | List my offered services |
| GET | /api/workers/:workerId/services | PUBLIC | List worker services |
| GET | /api/workers/leaderboard/top | PUBLIC | Top workers leaderboard |
| GET | /api/workers/:workerId | PUBLIC | Worker profile details |
| DELETE | /api/workers/services/:serviceId | WORKER | Remove offered service |

## 4.3 Services (/api/services)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| POST | /api/services | ADMIN | Create service |
| GET | /api/services | PUBLIC | List/search services |
| GET | /api/services/:id | PUBLIC | Service detail |
| GET | /api/services/:id/workers | PUBLIC | Workers by service |
| PATCH | /api/services/:id | ADMIN | Update service |
| DELETE | /api/services/:id | ADMIN | Delete service |

## 4.4 Bookings (/api/bookings)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| POST | /api/bookings/preview-price | CUSTOMER|WORKER | Dynamic price preview |
| POST | /api/bookings | CUSTOMER|WORKER | Create booking |
| GET | /api/bookings | AUTHENTICATED | List my bookings |
| GET | /api/bookings/open | AUTHENTICATED | Open bookings/job board |
| GET | /api/bookings/:id | AUTHENTICATED | Booking detail |
| PATCH | /api/bookings/:id/status | AUTHENTICATED | Update booking status |
| PATCH | /api/bookings/:id/cancel | AUTHENTICATED | Cancel booking |
| POST | /api/bookings/:id/pay | CUSTOMER | Pay booking |
| POST | /api/bookings/:id/accept | WORKER | Accept booking |
| POST | /api/bookings/:id/start | WORKER | Start booking (OTP verify) |
| POST | /api/bookings/:id/complete | WORKER | Complete booking (OTP verify) |
| POST | /api/bookings/:id/otp/refresh | WORKER | Refresh OTP |
| GET | /api/bookings/:id/sessions | AUTHENTICATED | List booking sessions |
| POST | /api/bookings/:id/sessions | WORKER | Create booking session |
| POST | /api/bookings/:id/sessions/:sessionId/start | WORKER | Start session |
| POST | /api/bookings/:id/sessions/:sessionId/end | WORKER | End session |
| PATCH | /api/bookings/:id/reschedule | AUTHENTICATED | Reschedule booking |
| GET | /api/bookings/:id/history | AUTHENTICATED | Booking status history |
| GET | /api/bookings/:id/cancellation-policy | AUTHENTICATED | Cancellation policy |

## 4.5 Customers (/api/customers)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| POST | /api/customers/profile | AUTHENTICATED | Create/update customer profile |
| GET | /api/customers/profile | AUTHENTICATED | Get customer profile |

## 4.6 Uploads (/api/uploads)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| POST | /api/uploads/profile-photo | AUTHENTICATED | Upload profile photo |
| POST | /api/uploads/verification-doc | AUTHENTICATED | Upload verification document |
| POST | /api/uploads/booking-photo | AUTHENTICATED | Upload booking media |
| POST | /api/uploads/chat-attachment | AUTHENTICATED | Upload chat attachment |

## 4.7 Availability (/api/availability)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| GET | /api/availability/me | WORKER | List worker availability |
| POST | /api/availability | WORKER | Add availability slot |
| DELETE | /api/availability/:id | WORKER | Remove availability slot |

## 4.8 Reviews (/api/reviews)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| POST | /api/reviews | AUTHENTICATED | Create review |
| GET | /api/reviews/written | AUTHENTICATED | My written reviews |
| GET | /api/reviews/received | AUTHENTICATED | Reviews received |
| GET | /api/reviews/pending | AUTHENTICATED | Pending reviews |
| GET | /api/reviews/customer | AUTHENTICATED | Legacy alias (written) |
| GET | /api/reviews/worker | AUTHENTICATED | Legacy alias (received) |

## 4.9 Verification (/api/verification)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| GET | /api/verification/me | WORKER | Verification status |
| POST | /api/verification/apply | WORKER | Apply verification |
| GET | /api/verification/admin | ADMIN | List verification applications |
| PATCH | /api/verification/admin/:id | ADMIN | Review verification application |

## 4.10 Admin (/api/admin)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| GET | /api/admin/dashboard | ADMIN | Admin summary dashboard |
| GET | /api/admin/fraud-alerts | ADMIN | Fraud alerts |
| GET | /api/admin/ai-audits/summary | ADMIN | AI audit summary |
| GET | /api/admin/ai-audits | ADMIN | AI audit logs |
| GET | /api/admin/users | ADMIN | User list/filter |
| GET | /api/admin/workers | ADMIN | Worker list/filter |
| PATCH | /api/admin/users/:id/status | ADMIN | Update user status |
| DELETE | /api/admin/users/:id | ADMIN | Delete user |
| GET | /api/admin/coupons | ADMIN | Coupon list |
| POST | /api/admin/coupons | ADMIN | Create coupon |
| PATCH | /api/admin/coupons/:id/status | ADMIN | Update coupon status |
| DELETE | /api/admin/coupons/:id | ADMIN | Delete coupon |

## 4.11 Payments (/api/payments)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| GET | /api/payments/me | CUSTOMER|WORKER | My payments |
| GET | /api/payments/admin | ADMIN | All payments |
| POST | /api/payments/webhook | PUBLIC | Razorpay webhook |

## 4.12 Safety (/api/safety)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| POST | /api/safety/sos | AUTHENTICATED | Trigger SOS |
| GET | /api/safety/contacts | AUTHENTICATED | List emergency contacts |
| POST | /api/safety/contacts | AUTHENTICATED | Add emergency contact |
| DELETE | /api/safety/contacts/:id | AUTHENTICATED | Delete emergency contact |
| GET | /api/safety/active-booking | AUTHENTICATED | Current active booking |
| GET | /api/safety/sos/alerts | ADMIN | Active SOS alerts |
| PATCH | /api/safety/sos/alerts/:id | ADMIN | Update SOS alert status |

## 4.13 Location (/api/location)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| GET | /api/location/nearby | AUTHENTICATED | Nearby workers |
| GET | /api/location/worker/:id | AUTHENTICATED | Worker location |
| POST | /api/location/update | WORKER | Update worker location |
| GET | /api/location/cities | PUBLIC | City list |
| GET | /api/location/cities/:slug/services | PUBLIC | Services in city |

## 4.14 Notifications (/api/notifications)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| GET | /api/notifications | AUTHENTICATED | List notifications |
| PATCH | /api/notifications/:id/read | AUTHENTICATED | Mark one as read |
| POST | /api/notifications/read-all | AUTHENTICATED | Mark all as read |
| GET | /api/notifications/mock-gateway | ADMIN | Admin test/mock gateway logs |
| GET | /api/notifications/push/vapid-key | AUTHENTICATED | Push VAPID key |
| POST | /api/notifications/push/subscribe | AUTHENTICATED | Subscribe push endpoint |
| POST | /api/notifications/push/unsubscribe | AUTHENTICATED | Unsubscribe push endpoint |
| GET | /api/notifications/push/subscriptions | AUTHENTICATED | List push subscriptions |
| GET | /api/notifications/preferences | AUTHENTICATED | Get notification preferences |
| PATCH | /api/notifications/preferences | AUTHENTICATED | Update notification preferences |

## 4.15 Chat (/api/chat)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| GET | /api/chat/conversations | AUTHENTICATED | List conversations |
| GET | /api/chat/booking/:bookingId | AUTHENTICATED | Get/create booking conversation |
| GET | /api/chat/:conversationId/messages | AUTHENTICATED | List messages |
| POST | /api/chat/:conversationId/messages | AUTHENTICATED | Send message |

## 4.16 Growth (/api/growth)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| GET | /api/growth/wallet | AUTHENTICATED | Wallet snapshot |
| POST | /api/growth/wallet/topup/order | AUTHENTICATED | Create topup order |
| POST | /api/growth/wallet/topup/confirm | AUTHENTICATED | Confirm topup |
| POST | /api/growth/wallet/topup/fail | AUTHENTICATED | Mark topup failed |
| POST | /api/growth/wallet/redeem | AUTHENTICATED | Redeem wallet balance |
| POST | /api/growth/wallet/add | ADMIN | Add wallet credits |
| GET | /api/growth/referrals | AUTHENTICATED | Referral info |
| POST | /api/growth/referrals/apply | AUTHENTICATED | Apply referral code |
| POST | /api/growth/coupons/validate | AUTHENTICATED | Validate coupon |
| POST | /api/growth/favorites/toggle | AUTHENTICATED | Toggle favorite worker |
| GET | /api/growth/favorites | AUTHENTICATED | List favorites |
| GET | /api/growth/favorites/ids | AUTHENTICATED | Favorite IDs |
| GET | /api/growth/favorites/check/:workerProfileId | AUTHENTICATED | Favorite check |
| GET | /api/growth/loyalty | AUTHENTICATED | Loyalty summary |
| POST | /api/growth/loyalty/redeem | AUTHENTICATED | Redeem loyalty points |
| GET | /api/growth/proplus | AUTHENTICATED | ProPlus status |
| POST | /api/growth/proplus/subscribe | AUTHENTICATED | Subscribe ProPlus |
| POST | /api/growth/proplus/cancel | AUTHENTICATED | Cancel ProPlus |
| POST | /api/growth/giftcards/purchase | AUTHENTICATED | Purchase gift card |
| POST | /api/growth/giftcards/redeem | AUTHENTICATED | Redeem gift card |
| GET | /api/growth/giftcards/check/:code | AUTHENTICATED | Gift card check |

## 4.17 Payouts (/api/payouts)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| GET | /api/payouts/bank-details | WORKER | Payout bank details |
| POST | /api/payouts/bank-details | WORKER | Update payout bank details |
| POST | /api/payouts/instant | WORKER | Instant payout request |
| GET | /api/payouts/history | WORKER | Payout history |

## 4.18 Invoices (/api/invoices)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| GET | /api/invoices/booking/:id | AUTHENTICATED | Booking invoice |
| GET | /api/invoices/worker-report | WORKER | Worker report export |
| GET | /api/invoices/gstr1 | ADMIN | GST export |

## 4.19 Analytics (/api/analytics)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| GET | /api/analytics/summary | ADMIN | Admin analytics summary |

## 4.20 AI (/api/ai)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| POST | /api/ai/chat | AUTHENTICATED | AI chat input |
| POST | /api/ai/voice | AUTHENTICATED | AI voice input |
| POST | /api/ai/session/reset | AUTHENTICATED | Reset AI session |

## 4.21 Cache (/api/cache)

| Method | Endpoint | Access | Operation |
|---|---|---|---|
| GET | /api/cache/service-catalog | PUBLIC | Cached service catalog |
| GET | /api/cache/worker-profile/:id | PUBLIC | Cached worker profile |
| POST | /api/cache/relay | INTERNAL | Cache relay/invalidation |

---

## 5) Role-Categorized API Matrix

## 5.1 PUBLIC
- /health, /health/email, /metrics
- /uploads/profile-photos/*
- /api/auth/register, /api/auth/login, /api/auth/forgot-password, /api/auth/reset-password, /api/auth/verify-email
- /api/services, /api/services/:id, /api/services/:id/workers
- /api/workers/:workerId, /api/workers/:workerId/services, /api/workers/leaderboard/top
- /api/location/cities, /api/location/cities/:slug/services
- /api/payments/webhook
- /api/cache/service-catalog, /api/cache/worker-profile/:id

## 5.2 AUTHENTICATED (All Roles)
- /api/auth/me, /api/auth/logout, /api/auth/change-password
- /api/bookings (read/update limited by ownership rules)
- /api/customers/profile
- /api/uploads/* (except static public profile photos)
- /api/reviews/*
- /api/safety/sos, /api/safety/contacts*, /api/safety/active-booking
- /api/notifications/* (except admin mock-gateway)
- /api/chat/*
- /api/growth/* (except /wallet/add)
- /api/invoices/booking/:id
- /api/ai/chat, /api/ai/voice, /api/ai/session/reset

## 5.3 WORKER
- /api/workers/services, /api/workers/me/services, /api/workers/services/:serviceId
- /api/availability/*
- /api/verification/me, /api/verification/apply
- /api/payouts/*
- /api/location/update
- /api/bookings accept/start/complete/session lifecycle endpoints
- /api/invoices/worker-report

## 5.4 ADMIN
- /api/admin/*
- /api/verification/admin*
- /api/analytics/summary
- /api/safety/sos/alerts*
- /api/payments/admin
- /api/services create/update/delete
- /api/growth/wallet/add
- /api/invoices/gstr1
- /api/notifications/mock-gateway

---

## 6) Internal AI Operations Map (Functions and Operations)

The AI assistant currently centralizes platform actions through platformOps tool actions.

| Action | Role | Backend service function |
|---|---|---|
| payment_history | CUSTOMER/WORKER/ADMIN | paymentService.listMyPayments |
| notifications | CUSTOMER/WORKER/ADMIN | notificationService.getUserNotifications + getUnreadCount |
| mark_notifications_read | CUSTOMER/WORKER/ADMIN | notificationService.markAsRead / markAllAsRead |
| reviews_my | CUSTOMER/WORKER/ADMIN | reviewService.getMyReviews |
| reviews_about_me | CUSTOMER/WORKER/ADMIN | reviewService.getReviewsAboutMe |
| reviews_pending | CUSTOMER/WORKER/ADMIN | reviewService.getPendingReviews |
| create_review | CUSTOMER/WORKER/ADMIN | reviewService.createReview |
| availability_list/add/remove | WORKER/ADMIN | availabilityService.listAvailability/createAvailability/removeAvailability |
| verification_status/apply | WORKER/ADMIN | verificationService.getMyApplication/applyForVerification |
| payout_details/history/update/instant | WORKER/ADMIN | payoutService.* |
| nearby_workers | CUSTOMER/WORKER/ADMIN | locationService.getNearbyWorkers |
| cities_list/city_services | CUSTOMER/WORKER/ADMIN | locationService.getCities/getCityServices |
| services_list | CUSTOMER/WORKER/ADMIN | serviceService.listServices |
| top_workers | CUSTOMER/WORKER/ADMIN | workerService.getTopWorkers |
| favorites_list/toggle | CUSTOMER/WORKER/ADMIN | growthService.getFavoriteWorkers/toggleFavoriteWorker |
| subscription_status/subscribe/cancel | CUSTOMER/WORKER/ADMIN | growthService.getProPlusSubscription/subscribeProPlus/cancelProPlus |
| coupon_validate | CUSTOMER/WORKER/ADMIN | growthService.validateCoupon |
| referral_code_generate/referral_apply | CUSTOMER/WORKER/ADMIN | growthService.generateReferralCode/applyReferral |
| chat_conversations/chat_messages | CUSTOMER/WORKER/ADMIN | chatService.getUserConversations/getMessages |
| booking_details | CUSTOMER/WORKER/ADMIN | bookingService.getBookingById |
| profile_get | CUSTOMER/WORKER/ADMIN | workerService.getMyWorkerProfile OR customerService.getCustomerProfile |
| safety_contacts_list/add/delete | CUSTOMER/WORKER/ADMIN | safetyService.getEmergencyContacts/addEmergencyContact/deleteEmergencyContact |
| sos_trigger | CUSTOMER/WORKER/ADMIN | safetyService.triggerSOS |
| admin_ai_audit_summary/list | ADMIN | adminService.getAiAuditSummary/listAiAudits |
| admin_verification_queue/review | ADMIN | verificationService.listApplications/reviewApplication |
| admin_sos_alerts | ADMIN | safetyService.getActiveSosAlerts |

---

## 7) Tool Schema Conversion Blueprint

## 7.1 Canonical Tool Contract
Use one canonical tool envelope for all backend API tools:

{
  "name": "<toolName>",
  "description": "<what operation does>",
  "inputSchema": {
    "type": "object",
    "properties": {
      "action": { "type": "string" },
      "params": { "type": "object", "additionalProperties": true }
    },
    "required": ["action"]
  },
  "security": {
    "requiresAuth": true,
    "allowedRoles": ["CUSTOMER", "WORKER", "ADMIN"]
  },
  "http": {
    "method": "GET|POST|PATCH|DELETE",
    "path": "/api/..."
  }
}

## 7.2 Recommended Tool Namespaces
- authTools
- bookingTools
- paymentTools
- notificationTools
- reviewTools
- availabilityTools
- verificationTools
- payoutTools
- locationTools
- growthTools
- safetyTools
- adminTools
- aiTools

## 7.3 Example: bookingTools schema

{
  "name": "bookingTools",
  "description": "Booking lifecycle operations",
  "inputSchema": {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": [
          "create",
          "list_mine",
          "get_details",
          "cancel",
          "reschedule",
          "accept",
          "start",
          "complete",
          "session_create",
          "session_start",
          "session_end"
        ]
      },
      "bookingId": { "type": "integer" },
      "sessionId": { "type": "integer" },
      "serviceId": { "type": "integer" },
      "workerProfileId": { "type": "integer" },
      "scheduledAt": { "type": "string" },
      "otp": { "type": "string" }
    },
    "required": ["action"]
  }
}

## 7.4 Example: realtimeReadTools schema

{
  "name": "realtimeReadTools",
  "description": "On-demand realtime reads",
  "inputSchema": {
    "type": "object",
    "properties": {
      "target": {
        "type": "string",
        "enum": [
          "wallet",
          "notifications",
          "payments",
          "bookings",
          "profile",
          "availability",
          "payouts",
          "verification"
        ]
      },
      "limit": { "type": "integer", "minimum": 1, "maximum": 20 }
    },
    "required": ["target"]
  }
}

---

## 8) Full Agent Flow (Execution Design)

## 8.1 High-Level
1. Receive user message
2. Detect language, role, and intent
3. If transactional intent: choose deterministic tool
4. If read intent: run realtime read tool(s)
5. Format response from returned data
6. If write action: ask confirm -> execute -> return final status
7. Log audit event

## 8.2 Flow by Branch

### A) Realtime Read Branch
- Intent: wallet/notifications/payments/bookings/profile/etc
- Agent calls corresponding read tool
- Agent summarizes live data into structured bullets/key-value
- Return concise answer + next actions

### B) Transactional Write Branch
- Intent: booking create/cancel, payout update, verification apply, SOS, admin review
- Validate required entities
- If missing fields: ask focused follow-up
- Create pending action
- Wait explicit confirm
- Execute tool
- Return success/failure + updated data

### C) Conversational Branch
- If not mapped to deterministic action
- Optional LLM response with platform context
- Must not claim write execution without actual tool run

## 8.3 Safety and Governance
- Always enforce role gates before tool execution
- Never expose sensitive admin or private data across roles
- Never fabricate data; prefer realtime reads
- For destructive actions always use explicit confirm
- Audit every action (intent, action, result, error)

---

## 9) Conversion Checklist

- [ ] Define tool registry per namespace in agent runtime
- [ ] Map each API endpoint to tool action and schema fields
- [ ] Add centralized role policy map in tool router
- [ ] Add idempotency rules for write tools
- [ ] Add standardized output envelope:
  - success
  - data
  - error
  - meta (source, timestamp)
- [ ] Add confirmation policy for high-risk actions
- [ ] Add realtime-read short-circuit for user data queries
- [ ] Add agent tests by role (CUSTOMER, WORKER, ADMIN)

---

## 10) Notes
- This catalog is based on route mounts and route module declarations currently present in server codebase.
- AI assistant operations also include tool-level action abstractions under platformOps for unified execution.
- For production hardening, keep webhook/internal routes out of general-purpose agent exposure unless explicitly needed.
