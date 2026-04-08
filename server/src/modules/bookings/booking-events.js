const EventEmitter = require('events');

/**
 * Booking-specific event emitter
 * Safely manages booking acceptance/rejection events without global pollution
 * Prevents memory leaks from dangling listeners
 */
class BookingEventManager extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(1000); // Prevent warnings for high-concurrency scenarios
  }

  /**
   * Wait for a specific worker to accept or reject a booking
   * Returns true if accepted, false if rejected or timed out
   */
  async waitForWorkerDecision(bookingId, workerId, timeoutMs = 300000) {
    return new Promise((resolve) => {
      let settled = false;
      let timeoutHandle;

      const cleanup = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        this.off(`booking:${bookingId}:accepted`, onAccepted);
        this.off(`booking:${bookingId}:rejected`, onRejected);
      };

      const finish = (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      const onAccepted = (acceptedWorkerId) => {
        if (String(acceptedWorkerId) === String(workerId)) {
          finish(true);
        }
      };

      const onRejected = (rejectedWorkerId) => {
        if (String(rejectedWorkerId) === String(workerId)) {
          finish(false);
        }
      };

      // Set timeout to prevent indefinite waiting
      timeoutHandle = setTimeout(() => {
        finish(false); // Timeout = rejection
      }, timeoutMs);

      // Register listeners with error protection
      this.once(`booking:${bookingId}:accepted`, onAccepted);
      this.once(`booking:${bookingId}:rejected`, onRejected);

      // Safety check: if no listeners are registered after a tick, something went wrong
      process.nextTick(() => {
        const listeners = this.listenerCount(`booking:${bookingId}:accepted`) +
                         this.listenerCount(`booking:${bookingId}:rejected`);
        if (listeners === 0 && !settled) {
          console.warn(`[BOOKING_EVENTS] No listeners for booking ${bookingId}:${workerId}`);
        }
      });
    });
  }

  /**
   * Emit worker acceptance event
   */
  emitAcceptance(bookingId, workerId) {
    this.emit(`booking:${bookingId}:accepted`, workerId);
  }

  /**
   * Emit worker rejection event
   */
  emitRejection(bookingId, workerId) {
    this.emit(`booking:${bookingId}:rejected`, workerId);
  }

  /**
   * Clean up all listeners for a booking (useful for cleanup)
   */
  cleanupBooking(bookingId) {
    this.removeAllListeners(`booking:${bookingId}:accepted`);
    this.removeAllListeners(`booking:${bookingId}:rejected`);
  }
}

// Singleton instance
const bookingEventManager = new BookingEventManager();

module.exports = bookingEventManager;
