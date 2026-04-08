/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures when external services fail
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service down, requests fail fast
 * - HALF_OPEN: Testing if service recovered
 */

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.successThreshold = options.successThreshold || 2; // Successes to close from HALF_OPEN
    
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = 0;
    this.state = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {function} fn - Async function to execute
   * @returns {Promise} Result from fn if successful
   */
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successes = 0;
        console.log(`[CIRCUIT_BREAKER] ${this.name}: Transitioning to HALF_OPEN`);
      } else {
        const err = new Error(`Circuit breaker is OPEN for ${this.name}. Service unavailable.`);
        err.code = 'CIRCUIT_OPEN';
        throw err;
      }
    }

    try {
      const result = await fn();
      
      // Success: handle state transitions
      if (this.state === 'HALF_OPEN') {
        this.successes++;
        if (this.successes >= this.successThreshold) {
          this.state = 'CLOSED';
          this.failures = 0;
          this.successes = 0;
          console.log(`[CIRCUIT_BREAKER] ${this.name}: Closed (recovered)`);
        }
      } else if (this.state === 'CLOSED') {
        this.failures = 0;
      }
      
      return result;
    } catch (err) {
      this.failures++;
      this.lastFailure = Date.now();
      
      if (this.state === 'HALF_OPEN') {
        // Failure in HALF_OPEN: reopen immediately
        this.state = 'OPEN';
        console.log(`[CIRCUIT_BREAKER] ${this.name}: Reopened (failed in HALF_OPEN)`);
      } else if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
        console.log(`[CIRCUIT_BREAKER] ${this.name}: Opened after ${this.failures} failures`);
      }
      
      throw err;
    }
  }

  /**
   * Get current state
   */
  getState() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure ? new Date(this.lastFailure).toISOString() : null,
    };
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.failures = 0;
    this.successes = 0;
    this.state = 'CLOSED';
    console.log(`[CIRCUIT_BREAKER] ${this.name}: Reset manually`);
  }
}

module.exports = CircuitBreaker;
