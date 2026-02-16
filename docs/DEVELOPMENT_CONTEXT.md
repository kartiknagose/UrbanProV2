# Development Context & Handoff Guide

## 🚀 Project Overview
**UrbanPro V2** is a home services marketplace (like Urban Company) connecting customers with service professionals (cleaners, plumbers, etc.).

**Current Phase:** Trust & Safety (Booking Verification, Safety, and Analytics).

## 🧠 AI Handoff Protocol
**For Copilot / Cursor / Other AI:**
1.  **Read this file first** to understand the current state and architectural decisions.
2.  **Check `docs/PRODUCTION_ROADMAP.md`** for the high-level goals.
3.  **Update this file** after completing a significant task to keep the context fresh for the next session.

---

## ✅ Completed Tasks

### 1. Safety, Disposal & Emergency Handling (Revised)
*   **Status**: Initial SOS system decommissioned; focused on physical verification.
*   **Implementation**:
    *   **SOS Alert System**: Removed from all dashboards/cards to streamline UI (can be reintroduced via WebSocket phase later).
    *   **Photo Proof of Work**: Workers MUST upload a "Before Start" and "After Completion" photo. Photos are stored and linked to the booking for dispute resolution.
    *   **Emergency Contacts**: Backend API ready; UI currently hidden.

### 2. OTP Verification & Activity Progress
*   **Goal**: Secured physical presence and job state transitions.
*   **Implementation**:
    *   **Two-Factor Verification**: 4-digit OTPs generated for both Start and Completion.
    *   **Security**: OTPs are hidden from workers; customers must share them vocally to prevent fraudulent "Start/Complete" marking.
    *   **Dashboard Integration**: Quick-action buttons (Pay Now, Rate & Review) added directly to customer activity cards upon job completion.

### 3. Service Reliability (Location & Availability)
*   **Goal**: Prevent logistical conflicts.
*   **Implementation**:
    *   **Double-Booking Prevention**: Workers are blocked from accepting jobs that overlap within a +/- 2-hour window.
    *   **Service Area Matching**: Customers can only book workers whose defined `serviceAreas` include their location.
    *   **Worker Analytics**: Integrated charts for weekly earnings and job distribution.

---

## 🏗 Technical Implementation Details

### Database Schema (Prisma)
*   **Updated**: Added `startOtp`, `completionOtp`, `photos`, and `serviceAreas`.
*   **Worker Profile**: Added `bio`, `specialties`, and `serviceAreas`.

### Backend (Node.js/Express)
*   **Booking Service**: Centralized logic for OTP verification and availability checks.
*   **Security**: Enhanced RBAC (Role Based Access Control) to ensure workers cannot see customer OTPs.

### Frontend (React/Vite)
*   **UI/UX**: Transitioned to high-premium dark/light mode with Framer Motion animations.
*   **State Management**: Optimized TanStack Query (React Query) for smooth optimistic updates.

---

## ✅ Current Status
*   **Database**: Migrated with new models for OTPs and Photos.
*   **Backend**: Availability logic and OTP handshake fully functional.
*   **Frontend**: UI cleaned of SOS buttons; verification flow polished.
*   **Next step (Recommended)**: **Phase 2: Real-Time & Location (WebSockets)**.
    *   Implement Socket.io for instant booking notifications.
    *   Real-time status updates (polling currently).
    *   Live tracking map for workers.

## 🔮 Future Improvements
1.  **WebSocket Integration**: Instant job offers and status changes.
2.  **Real Payment Gateway**: Integrate Razorpay for actual money flow.
3.  **PWA Support**: Optimize for mobile-first "Add to Home Screen" experience.
