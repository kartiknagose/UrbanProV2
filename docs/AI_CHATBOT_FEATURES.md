# AI Chatbot - Features, Abilities & Capabilities

**Document Date:** March 24, 2026  
**Status:** Production Ready (MVP Phase)  
**Platform:** ExpertsHub V2 / UrbanPro V2

---

## Table of Contents

1. [Overview](#overview)
2. [Core Features](#core-features)
3. [User Abilities](#user-abilities)
4. [Supported Intents](#supported-intents)
5. [Technical Capabilities](#technical-capabilities)
6. [Safety & Security](#safety--security)
7. [Multilingual Support](#multilingual-support)
8. [Frontend Experience](#frontend-experience)
9. [API Architecture](#api-architecture)
10. [System Limitations](#system-limitations)
11. [Future Enhancements](#future-enhancements)

---

## Overview

The AI Chatbot is a natural language command system integrated into ExpertsHub V2, enabling customers and workers to interact with the platform through conversational dialog. The system uses intent recognition, entity extraction, and session-based state management to understand user requests and execute corresponding actions.

### Key Characteristics

- **Natural Language Processing:** Understands English, Hindi (Devanagari), Marathi, and Hinglish
- **Multi-Turn Conversations:** Maintains context across multiple exchanges to gather complete information
- **Session Persistence:** Stores conversation state for 30 minutes, surviving browser refresh and page navigation
- **Confirmation Gates:** Mandatory explicit confirmation before sensitive operations (booking, cancellation, wallet redemption)
- **Audit Trail:** Logs all AI-driven actions for compliance and troubleshooting
- **Rate Limited:** Protected against abuse with separate limits for chat and voice inputs
- **Role-Based Access:** Different capabilities for customers, workers, and admins

---

## Core Features

### 1. **Natural Language Understanding**

The chatbot recognizes user intent through pattern matching and regex-based entity extraction:

- **Intent Recognition:** Identifies the user's primary goal (book a service, check wallet, cancel booking, etc.)
- **Entity Extraction:** Pulls structured data from conversational input:
  - Service names (plumber, electrician, carpenter, etc.)
  - Dates and times (tomorrow 10 AM, next Monday 3 PM)
  - Locations (ZIP code, city, landmark-based addresses)
  - Monetary amounts (₹500, 1000 rupees)
  - Worker references (by ID or pronouns like "him", "her")
  - Booking IDs (numeric references to existing bookings)
  - Customer profile fields (name, phone, address)

### 2. **Conversation Memory & Context**

- **Session State Machine:** Tracks user context across turns (searched workers, pending confirmations, extracted entities)
- **Persistence Layer:** Stores state in Redis with 30-minute TTL and in-memory fallback
- **Context Merging:** Builds cumulative understanding across turns; user can provide data incrementally
- **Ambient Information:** Remembers previous responses within same session (e.g., selected worker name for confirmation)

### 3. **Confirmation System**

Sensitive operations require explicit user confirmation:

- **Trigger Actions:**
  - Create Booking
  - Cancel Booking
  - Redeem Wallet Balance
  - Update Profile Information

- **Confirmation Flow:**
  1. User requests sensitive action
  2. Chatbot prepares action details and asks for confirmation
  3. User must reply with confirmation words: `yes`, `confirm`, `proceed`, `ok`, `yup`, `sure`
  4. Action executes only after confirmation; state cleared after execution
  5. User can decline action; chatbot abandons it gracefully

- **Example Flow:**
  ```
  User: "Book plumber for tomorrow 10 AM"
  Bot: "I'll book this plumber for tomorrow at 10:00 AM, cost ₹500. Confirm? (yes/no)"
  User: "Yes"
  Bot: "✓ Booking created (ID: 12345)"
  ```

### 4. **Worker Selection & Availability**

- **Worker Search:** Returns numbered list of workers matching service/location criteria
- **Smart Selection:** User can select by number ("Book #2") or by name
- **Availability Check:** Verifies no booking conflicts before confirmation
- **Real-Time Conflict Detection:** Prevents double-booking on same date/time
- **Address Fallback:** Uses customer's default address if not specified

### 5. **Booking Management**

- **Create Bookings:** Full multi-step flow with entity extraction and availability validation
- **View Bookings:** List all customer or worker bookings (role-aware filtering)
- **Get Status:** Query specific booking details by booking ID
- **Cancel Bookings:** Remove bookings with optional reason capture

### 6. **Wallet & Payment Capabilities**

- **View Wallet Balance:** Show customer or worker wallet balance with transaction history (latest 50)
- **Transaction History:** Display date, amount, type (debit/credit), and description for each transaction
- **Redeem Wallet:** Withdraw balance to registered bank account with confirmation
- **Balance Validation:** Prevents redemption of unavailable or insufficient amounts

### 7. **Profile Management**

- **View Profile:** Retrieve current user profile information
- **Update Profile:** Modify name, email, phone, address, city with confirmation
- **Profile Validation:** Ensures required fields and formats before update

---

## User Abilities

### Customer Users Can:

1. **Search for services and workers**
   - By service type (e.g., "Find a plumber")
   - By location (e.g., "Find electricians in Pune")
   - With multiple filters (service + location)

2. **Book services**
   - Specify date, time, location, preferred worker
   - Proceed through multi-step flow if information is incomplete
   - Confirm booking before final execution

3. **Manage bookings**
   - View all their bookings
   - Check status of specific booking
   - Cancel upcoming bookings with confirmation

4. **Manage wallet**
   - Check available balance
   - View transaction history
   - Redeem balance to bank account

5. **Update profile**
   - Modify contact details
   - Change default service address
   - Update city/location

6. **Get help**
   - List all available commands
   - Understand chatbot capabilities

### Worker Users Can:

1. **View their bookings**
   - Filter bookings assigned to them (role-aware)
   - Check booking details and customer info

2. **Check wallet**
   - View earnings balance
   - See payment transactions
   - Redeem earnings

3. **Update profile**
   - Modify service offerings
   - Change availability hours
   - Update service descriptions

### Admin Users Can:

- Access all customer and worker data through tools
- View complete booking and transaction history
- Retrieve user profiles
- Manage AI-driven actions in audit trail

---

## Supported Intents

The chatbot recognizes and handles **8 core intents**:

### 1. **create_booking**
- **Triggers:** "Book a plumber", "Schedule electrician", "I need a service"
- **Entities Needed:** service, date/time, location (optional: worker, price)
- **Flow:** Search → Filter → Select Worker → Check Availability → Confirm → Execute
- **Confirmation:** Required
- **Output:** Booking ID, scheduled time, worker name, cost

### 2. **search_service**
- **Triggers:** "Find a plumber", "List carpenters in Mumbai", "Show workers"
- **Entities Needed:** service, location (optional)
- **Flow:** Get services → Get service workers → Apply location filter → Return list (max 10)
- **Output:** Numbered worker list with ratings, `[1] Name - 4.8★, ₹500/hr`

### 3. **get_booking_status**
- **Triggers:** "What's my booking status?", "Status of booking 12345", "Check my order"
- **Entities Needed:** booking ID (optional: can query all bookings)
- **Flow:** Retrieve booking records → Filter by role → Display details
- **Output:** Booking ID, date, time, worker, status (confirmed/completed/cancelled)

### 4. **cancel_booking**
- **Triggers:** "Cancel my booking", "Remove booking 12345", "I don't need this service"
- **Entities Needed:** booking ID (auto-found if only one pending)
- **Flow:** Resolve booking → Confirm cancellation → Execute → Return confirmation
- **Confirmation:** Required (with booking details)
- **Output:** Cancellation confirmed, refund policy noted

### 5. **view_wallet**
- **Triggers:** "Check my wallet", "How much balance?", "Show my earnings"
- **Entities Needed:** None
- **Flow:** Fetch wallet snapshot → Return balance + recent transactions
- **Output:** Current balance (INR), last 5 transactions with dates

### 6. **redeem_wallet**
- **Triggers:** "Withdraw my earnings", "Redeem balance of ₹500", "Cash out wallet"
- **Entities Needed:** amount (optional: defaults to full balance if not provided)
- **Flow:** Validate balance → Confirm amount and bank account → Execute transaction → Return confirmation
- **Confirmation:** Required (with amount and account ending digits)
- **Output:** Transaction ID, processing time, account details

### 7. **update_profile**
- **Triggers:** "Update my name", "Change my address", "Update profile to John"
- **Entities Needed:** fields to update (name, email, phone, address, city)
- **Flow:** Parse update request → Validate format → Confirm changes → Execute upsert → Acknowledge
- **Confirmation:** Required (with old vs new values)
- **Output:** Profile updated, fields changed listed

### 8. **help**
- **Triggers:** "Help", "What can you do?", "List commands"
- **Entities Needed:** None
- **Flow:** Return list of available intents + example commands
- **Output:** Formatted help text with 5-8 example utterances

### Special Intent: **confirm_action**
- **Triggers:** "Yes", "Confirm", "Proceed", "OK", "Sure", "Yup"
- **Purpose:** Responds to confirmation prompts; executes pending action
- **Handling:** Only recognized when `state.pendingAction` is set
- **Output:** Executes tool associated with pending action

---

## Technical Capabilities

### 1. **Tool System (11 Implementations)**

Each intent routes through stateless, role-validated tool implementations:

| Tool Name | Purpose | Confirmation Required | Dependencies |
|-----------|---------|----------------------|--------------|
| `searchWorkers` | Filter workers by service/location | No | listServices, getServiceWorkers |
| `getWorkerDetails` | Fetch profile + services for one worker | No | userService.getUserProfile |
| `checkAvailability` | Detect booking conflicts | No | bookingService.isWorkerAvailable |
| `createBooking` | Create new booking with validation | **Yes** | bookingService.createBooking |
| `getBookings` | List bookings (role-filtered) | No | bookingService.getBookingsByUser |
| `getWallet` | Fetch balance + transaction history | No | GrowthService.getWalletSnapshot |
| `redeemWallet` | Withdraw balance to bank | **Yes** | GrowthService.redeemWalletBalance |
| `cancelBooking` | Cancel booking with refund | **Yes** | bookingService.cancelBooking |
| `updateProfile` | Modify user profile fields | **Yes** | upsertCustomerProfile / upsertWorkerProfile |
| Intent/Success | Safety tool for positive responses | No | toolSuccess helper |
| Intent/Fallback | Catch-all for unknown inputs | No | toolFailure helper |

### 2. **Entity Extraction**

The system extracts structured data from natural language:

- **Date Parsing:** "tomorrow", "next Monday", "25 March", absolute dates
  - Timezone aware; converts to ISO 8601
  - Validates against booking constraints (no past dates, reasonable buffer)

- **Time Parsing:** "10 AM", "3:30 PM", "10 o'clock", "after 5"
  - Converts 12/24-hour formats
  - Validates business hours constraints

- **Location Parsing:** PIN codes, city names, landmarks
  - Matches against service availability zones
  - Optional; uses customer default if not provided

- **Monetary Amount Parsing:** "₹500", "500 rupees", "500", "one thousand"
  - Validates against wallet balance and transaction limits
  - Returns INR value

- **Worker Reference Parsing:**
  - By ID: "worker 123" or "#2" (from search results)
  - By pronoun: "him", "her" (requires context from previous response)
  - By name: "John" (resolved against search results)

- **Service Name Parsing:** Fuzzy matching against service catalog
  - Handles variations ("plumbing" → "plumber")
  - Suggestions if no exact match

### 3. **Session State Management**

**Session Storage Model:**

```
Redis Key: ai:session:{userId}:{sessionId}
TTL: 30 minutes

Structure:
{
  "context": {
    "service": "plumber",
    "date": "2026-03-25",
    "time": "10:00",
    "location": "Pune",
    "workerId": 42,
    "price": 500,
    "mode": "on-site"
  },
  "pendingAction": {
    "name": "createBooking",
    "input": { ... }
  } || null,
  "workerOptions": [ 
    { id: 42, name: "John", rating: 4.8, ... },
    { id: 43, name: "Jane", rating: 4.6, ... }
  ],
  "language": "en" || "hi" || "mr"
}
```

**Fallback:** If Redis unavailable, state stored in in-memory Map with user-scoped cleanup

### 4. **Orchestrator Service**

Central orchestration engine (`service.js`) implements:

- **Intent Parsing Engine:** Routes natural language to handlers
- **State Lifecycle:** Load → Parse → Dispatch → Save/Execute
- **Error Handling:** Graceful degradation; suggests clarification questions
- **Audit Logging:** Tracks all intent processing and tool execution
- **Language Detection:** Auto-selects response language based on input

---

## Safety & Security

### 1. **Authentication & Authorization**

- **Required:** Valid JWT token in HTTP-only cookie
- **Checked at:** Route entry point (before rate limiting)
- **Role Validation:** Each tool validates `user.role` against CUSTOMER/WORKER/ADMIN requirements
- **Scope Enforcement:** Customers can only access their own data; workers see their bookings

### 2. **Rate Limiting**

**Chat Endpoint** (`POST /api/ai/chat`):
- Limit: 120 requests per 15 minutes
- Key: `ai_chat:user:{userId}` (authenticated) or `ai_chat:ip:{ipHash}` (fallback)
- Response: 429 Too Many Requests if exceeded

**Voice Endpoint** (`POST /api/ai/voice`):
- Limit: 60 requests per 15 minutes
- Key: `ai_voice:user:{userId}` or `ai_voice:ip:{ipHash}`
- Response: 429 Too Many Requests if exceeded

### 3. **Input Validation**

- **Message Length:** 1-2000 characters
- **Supported Characters:** Unicode (English, Devanagari), punctuation, digits
- **Entity Ranges:** 
  - Date: Today to 365 days future
  - Amount: ₹1 to ₹100,000 per operation
  - Time: Within business hours (configurable per service)

### 4. **Confirmation Gates**

Four operations require explicit confirmation before execution:

1. **Create Booking** - User confirms service, date, time, worker, cost
2. **Cancel Booking** - User confirms cancellation of specific booking
3. **Redeem Wallet** - User confirms amount and bank account last 4 digits
4. **Update Profile** - User confirms old vs. new values for each field

**Confirmation Validation:**
- Response must contain exact match: `yes`, `confirm`, `proceed`, `ok`, `yup`, `sure`, `confirm` (case-insensitive)
- Typos or partial matches not accepted
- User can decline with `no`, `cancel`, `skip`; action abandoned cleanly

### 5. **Audit Trail**

All AI-driven actions logged with:

```
{
  timestamp: ISO 8601,
  userId: encrypted,
  intent: string (e.g., "create_booking"),
  tool: string (e.g., "createBooking"),
  input: { ... },
  result: { success: true/false, data or error },
  duration: milliseconds,
  language: "en" | "hi" | "mr"
}
```

System Admin can query audit logs via `/api/ai/audit` (future feature)

### 6. **Data Privacy**

- **No Permanent Message Storage:** Chat history not persisted in database
- **Session Isolation:** Each session independent; no cross-user data leakage
- **PII Masking:** Phone numbers and addresses redacted from logs
- **GDPR Compliant:** User can request deletion of session state; TTL cleanup automatic

---

## Multilingual Support

### Language Detection

The chatbot automatically detects input language:

- **English:** Standard Latin characters (ASCII)
- **Hindi (Devanagari):** Unicode range U+0900 to U+097F (native script)
- **Hinglish:** Mix of Latin and Devanagari (e.g., "Kal 10 baje plumber")
- **Marathi:** Devanagari with Marathi-specific keywords

**Detection Algorithm:**
1. Check for Devanagari characters (>50% → Hindi/Marathi)
2. Check for Hinglish keywords (kal, aaj, kal, rat, subah, etc.)
3. Fallback to English if ambiguous

### Multilingual Entity Extraction

- **Date Keywords:** "kal" (tomorrow), "aaj" (today), "parson" (day after tomorrow), etc.
- **Time Keywords:** "subah" (morning), "dophar" (afternoon), "rat" (night), "baje" (o'clock)
- **Service Names:** Translated catalog (अंग्रेज़ी → Devanagari mappings maintained)
- **Location Names:** Supported in all three languages

### Response Localization

The chatbot responds in the same language as user input:

- **English Response Template:** "✓ Booking created for March 25, 2026 at 10:00 AM with John for ₹500."
- **Hindi Response Template:** "✓ 25 मार्च 2026 को 10:00 AM पर जॉन के साथ ₹500 के लिए बुकिंग बनाई गई।"
- **Marathi Response Template:** "✓ 25 मार्च 2026 रोजी 10:00 AM ला जॉन सह ₹500 साठी बुकिंग तयार केली गेली।"

**Hinglish Normalization:** Internally converts Hinglish to English for processing, then responds in original language

---

## Frontend Experience

### Chat Widget Integration

**Location:** Available on all authenticated pages (home, bookings, wallet, profile, etc.)

**Components:**

1. **Message Display Area**
   - User messages: Right-aligned, blue bubble, timestamp
   - Chatbot responses: Left-aligned, gray bubble with avatar
   - Loading indicator: Animated dots while processing
   - Session indicator: Shows active session ID (optional debug mode)

2. **Input & Send**
   - Text input field: 255 character limit with counter
   - Send button: Disabled until message typed
   - Clear history: Optional button to reset session
   - Suggestion chips: Quick-tap buttons for common commands
     - "Book a plumber"
     - "Check my wallet"
     - "View my bookings"

3. **State Persistence**
   - Widget stores `sessionId` in local component state
   - Every request includes current `sessionId`
   - Backend maintains state for 30 minutes; widget survives page refresh
   - User can close widget and reopen within session TTL

4. **Error Handling**
   - Network error: "Unable to connect. Try again?"
   - Timeout (>10s): "Request taking too long. Please retry."
   - Rate limited: "You're sending messages too fast. Please wait."
   - Auth error: "Session expired. Please log in again."

5. **Visual Design**
   - Responsive: Works on mobile (bottom corner), tablet (sidebar), desktop
   - Dark mode support: Automatically adapts to user's theme preference
   - Accessibility: ARIA labels, keyboard navigation (Tab to send, Enter to submit)
   - Animations: Smooth message entry, loading spinner, response delay (100-500ms for natural feel)

### User Journey Example

```
1. User clicks "Chat" or widget auto-appears on page
   → Widget loads empty state with suggestion chips

2. User clicks suggestion "Book a plumber"
   → Message sent: "Book a plumber"
   → sessionId generated: "12ab-34cd-56ef"
   → Response: "I'll help you book a plumber. What service do you need? (plumbing, electrician, etc.)"

3. User types: "I need plumbing. Tomorrow 10 AM in Pune"
   → Message sent (with sessionId)
   → Entities extracted: service=plumber, date=2026-03-25, time=10:00, location=Pune
   → Response: "Found 5 plumbers in Pune. Which would you prefer?
      [1] John - 4.8★, ₹500/hr
      [2] Jane - 4.6★, ₹480/hr
      [3] Mike - 4.5★, ₹450/hr
      [4] Sarah - 4.9★, ₹520/hr
      [5] Tom - 4.4★, ₹400/hr"

4. User types: "Book #2"
   → Entities extracted: selection=2 (Jane)
   → Availability validated: No conflicts
   → Response: "I'll book Jane for March 25, 2026 at 10:00 AM. Cost: ₹480. Confirm? (yes/no)"
   → State.pendingAction set to { name: "createBooking", input: {...} }

5. User types: "Yes"
   → Intent recognized: confirm_action
   → Tool executed: createBooking
   → Response: "✓ Booking created! ID: 42857, Date: March 25, 10:00 AM, Worker: Jane"
   → State cleared; pendingAction = null

6. Widget remains open; user can ask follow-up questions without new session
   → "What's the address?" → Bot returns booking address
   → Page refresh → Widget reopens, same session persists (sessionId remains valid)
```

---

## API Architecture

### Endpoints

**Base URL:** `/api/ai`

#### 1. **POST /api/ai/chat**

Send text message to chatbot.

**Request:**
```json
{
  "message": "Book a plumber tomorrow 10 AM",
  "sessionId": "optional-uuid-for-session-continuation",
  "locale": "optional-language-hint (en|hi|mr)"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "12ab-34cd-56ef",
  "intent": {
    "intent": "create_booking",
    "confidence": 0.95,
    "entities": {
      "service": "plumber",
      "date": "2026-03-25",
      "time": "10:00"
    }
  },
  "reply": "Found 5 plumbers in Pune...",
  "language": "en",
  "requiresConfirmation": true,
  "pendingAction": {
    "name": "createBooking",
    "displayText": "Book plumber on March 25..."
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request (invalid message)
- `401` - Unauthenticated
- `429` - Rate limited
- `500` - Server error

---

#### 2. **POST /api/ai/voice**

Send voice transcript or binary audio to chatbot.

**Request:**
```json
{
  "transcript": "Book a plumber tomorrow",
  "sessionId": "optional-session-id"
}
```

**Response:** Same as `/api/ai/chat`, with additional fields:
- `source: "voice"`
- `transcript: "..."`
- `sttUsed: true/false`
- `sttProvider: "client" | "openai"`

**Note:** Binary audio transcription is supported through server-side STT adapter when either `OPENAI_API_KEY` or `GEMINI_API_KEY` is configured.

**Status Codes:** Same as chat

---

#### 3. **POST /api/ai/session/reset**

Clear current session state and start fresh conversation.

**Request:**
```json
{
  "sessionId": "12ab-34cd-56ef"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Session cleared. Starting fresh conversation."
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthenticated
- `404` - Session not found

---

### Backend Architecture

```
/api/ai
  ├── ai.routes.js
  │   ├── POST /chat (auth + aiChatLimiter)
  │   ├── POST /voice (auth + aiVoiceLimiter)
  │   └── POST /session/reset (auth)
  │
  ├── ai.controller.js
  │   ├── chat() - HTTP handler
  │   ├── voice() - HTTP handler
  │   └── clearSession() - HTTP handler
  │
  ├── service.js (Orchestrator)
  │   ├── processChatInput() - main entry point
  │   ├── loadState() - Redis read
  │   ├── saveState() - Redis write
  │   ├── parseIntent() - delegates to intent.js
  │   ├── executePendingAction() - runs tool from state
  │   └── 8x Intent Handlers
  │       ├── handleCreateBooking()
  │       ├── handleSearchService()
  │       ├── handleBookingStatus()
  │       ├── handleCancelBooking()
  │       ├── handleWallet()
  │       ├── handleRedeemWallet()
  │       ├── handleUpdateProfile()
  │       └── handleHelp()
  │
  ├── intent.js (Parser)
  │   ├── detectLanguage()
  │   ├── normalizeHinglish()
  │   ├── parseIntent()
  │   ├── buildIntentSchema()
  │   └── 7x Entity Extractors
  │       ├── extractDate()
  │       ├── extractTime()
  │       ├── extractLocation()
  │       ├── extractAmount()
  │       ├── extractService()
  │       ├── extractWorkerId()
  │       └── extractBookingId()
  │
  └── tools/ (11 tool implementations)
      ├── index.js (registry + runTool dispatcher)
      ├── helpers.js (shared utilities)
      ├── searchWorkers.js
      ├── getWorkerDetails.js
      ├── checkAvailability.js
      ├── createBooking.js
      ├── getBookings.js
      ├── getWallet.js
      ├── redeemWallet.js
      ├── cancelBooking.js
      └── updateProfile.js
```

---

### Data Flow Diagram

```
User Input (Chat/Voice)
    ↓
[Auth Middleware] ✓ JWT token valid
    ↓
[Rate Limiter] ✓ Within quota
    ↓
ai.controller.chat() / voice()
    ↓
service.processChatInput()
    ├─→ loadState(userId, sessionId) from Redis
    │
    ├─→ intent.parseIntent(message, state)
    │   ├─→ detectLanguage()
    │   ├─→ normalizeHinglish()
    │   └─→ Extract entities via regex
    │
    ├─→ Check if state.pendingAction exists
    │   ├─ Yes: executePendingAction() → run tool → clear state
    │   └─ No: Route to intent handler
    │
    ├─→ Handler (e.g., handleCreateBooking)
    │   ├─→ Check for missing fields
    │   ├─→ Resolve ambiguities (worker selection, etc.)
    │   ├─→ If confirmation needed: set state.pendingAction & ask user
    │   └─→ If ready: run tool immediately
    │
    ├─→ Tool execution (e.g., createBooking)
    │   ├─→ Validate role
    │   ├─→ Validate inputs (dates, amounts, IDs)
    │   ├─→ Call business service (BookingService, GrowthService, etc.)
    │   └─→ Return { success: true/false, data/error }
    │
    ├─→ saveState() to Redis
    │
    └─→ Return HTTP 200 with response
        ├─ intent (name, confidence, entities)
        ├─ reply (localized message)
        ├─ sessionId (for next request)
        └─ pendingAction (if awaiting confirmation)
```

---

## System Limitations

### Current Constraints

1. **Voice Input:**
   - ✓ Voice endpoint implemented
   - ✓ STT (Speech-to-Text) adapter implemented for binary audio
   - Requires `OPENAI_API_KEY` or `GEMINI_API_KEY` to transcribe audio-only requests

2. **No Persistent Chat History:**
   - Messages stored only in session state (30 min TTL)
   - Not persisted in database
   - Widget history cleared on 30-min timeout or page close

3. **Intent Coverage:**
   - Only 8 intents supported
   - Complex workflows (multi-service bookings, recurring appointments) not yet supported

4. **Entity Extraction Accuracy:**
   - Regex-based; no ML model
   - May misinterpret ambiguous inputs (e.g., "25" is treated as price, not date)
   - Works best with structured natural language patterns

5. **Service Coverage:**
   - Limited to services in existing catalog
   - No integration with external APIs (maps, weather, transit)
   - Worker availability checks assume same-day + future only

6. **Multilingual Limitations:**
   - Only supports English, Hindi, Marathi, and Hinglish
   - No support for Tamil, Telugu, Kannada, or other Indian languages
   - Marathi entity extraction less robust than Hindi/English

7. **Confirmation Required:**
   - User must type exact confirmation word ("yes", "confirm")
   - Typos or partial matches rejected
   - No alternative confirmation methods (buttons, swipe, etc.)

8. **Rate Limits:**
   - 120 chat / 15 min per user may be insufficient for rapid-fire usage
   - Voice endpoint more rate-limited (60 / 15 min); may block high-volume use cases

9. **Session Timeout:**
   - 30-minute TTL means long conversations reset state
   - User must re-search workers or re-enter data after timeout

---

## Future Enhancements

### Phase 2 (Planned)

#### 1. **Voice Experience**
- ✅ STT (Speech-to-Text) adapter implemented for binary audio input
- Add TTS (Text-to-Speech) for voice responses
- Support for noisy environments (background noise filtering)

#### 2. **AI Audit Dashboard**
- ✅ Implemented admin page with persistent audit records
- Includes filters for status, channel, date range, user ID, and intent
- Supports CSV export for current filtered dataset
- ✅ Drill-down detail modal implemented for full request/response JSON

#### 3. **Recommendation Engine Phase 2**
- Build ML model ranking workers by:
  - Historical booking completion rate
  - Customer satisfaction (ratings)
  - Response time (how quickly accepted booking)
  - Worker specialization (matches service expertise)

#### 4. **Fraud Detection Phase 2**
- Implement anomaly scorer for booking behavior:
  - Rapid cancellation patterns (user cancels >50% of bookings)
  - Unusual timing (bookings at 3 AM, etc.)
  - Geographic anomalies (bookings jumping between distant cities)
- Flag suspicious patterns; prevent action execution pending review

#### 5. **Advanced Entity Extraction**
- Integrate NER (Named Entity Recognition) model
- Support relative expressions ("next next Monday", "fortnight from now")
- Extract multiple entities per field (multiple locations, multiple dates)

#### 6. **Conversation Context Expansion**
- Extend session TTL from 30 to 60 minutes
- Add persistent chat history (with PII masking) in database
- Allow users to resume previous conversations

#### 7. **Multi-Language Support Expansion**
- Add Tamil, Telugu, Kannada support
- Improve Marathi entity extraction accuracy
- Support code-switching (mixing 3+ languages in single message)

#### 8. **Booking Workflow Enhancements**
- Support recurring/subscription bookings via chat
- Allow worker negotiation (user proposes price; worker counteroffers)
- Add photo upload capability within booking flow

#### 9. **Profile & Safety Tools**
- Two-factor authentication (phone verification for confirmed bookings)
- Emergency contact addition via chat
- Emergency alert tool ("I'm in danger")

#### 10. **Analytics & Insights**
- User dashboard: "You saved 2 hours using AI chat this month"
- Bot analytics: Top intents, common fallback paths, user satisfaction scoring
- A/B testing framework for different confirmation flows

---

## Summary

The AI Chatbot is a production-ready conversational interface enabling customers and workers to interact with ExpertsHub V2 through natural language. It combines intent recognition, session state management, confirmation gates, and strict security controls to provide a safe, auditable automation layer for the most common platform operations: booking services, managing wallet, checking status, and profile updates.

**Key Value:**
- Reduces friction for service booking (multi-step form → 2-3 message conversation)
- Accessible in customer's preferred language (English, Hindi, Marathi, Hinglish)
- Audit trail for compliance; confirmation gates for risk management
- Extensible tool architecture; new capabilities added without core logic changes

**Current Stage:** MVP ready for integration testing; advanced features planned for Phase 2.

---

**Document Version:** 1.0  
**Last Updated:** March 24, 2026  
**Maintained By:** AI Features Team
