/**
 * ROLE-BASED AUTHORIZATION MIDDLEWARE
 * 
 * What is this middleware?
 * This checks if the logged-in user has the required role (ADMIN, WORKER, or CUSTOMER).
 * 
 * Why do we need this?
 * - Some endpoints should only be accessible by admins (e.g., creating services)
 * - Some endpoints should only be accessible by workers (e.g., accepting bookings)
 * - This middleware prevents unauthorized access based on user roles
 * 
 * How to use it:
 * router.post('/admin-only', authenticate, requireRole('ADMIN'), controller);
 * router.post('/worker-only', authenticate, requireRole('WORKER'), controller);
 * router.post('/multiple-roles', authenticate, requireRole('ADMIN', 'WORKER'), controller);
 */

/**
 * REQUIRE SPECIFIC ROLE(S)
 * 
 * This is a "middleware factory" - it creates middleware based on which roles you pass.
 * 
 * Example Usage:
 * - requireRole('ADMIN') → Only admins can access
 * - requireRole('WORKER') → Only workers can access
 * - requireRole('ADMIN', 'WORKER') → Admins OR workers can access
 * 
 * @param {...string} allowedRoles - One or more roles (ADMIN, WORKER, CUSTOMER)
 * @returns {function} - Express middleware function
 */
function requireRole(...allowedRoles) {
  // This returns a middleware function that will be used in routes
  return (req, res, next) => {
    /**
     * HOW THIS WORKS:
     * 
     * 1. User sends request with JWT token in cookie
     * 2. `authenticate` middleware (runs before this) verifies token and adds req.user
     * 3. This middleware checks if req.user.role matches any of the allowedRoles
     * 4. If yes → call next() (proceed to controller)
     * 5. If no → send 403 Forbidden error
     */

    // STEP 1: Check if user is authenticated (authenticate middleware should have run first)
    if (!req.user) {
      // User is not logged in (authenticate middleware failed or wasn't used)
      return res.status(401).json({ 
        error: 'Authentication required. Please log in to access this resource.',
        statusCode: 401
      });
      // Status 401 = Unauthorized (not logged in)
    }

    // STEP 2: Get the user's role from req.user (added by authenticate middleware)
    const userRole = req.user.role;

    // STEP 3: Check if user's role is in the list of allowed roles
    if (!allowedRoles.includes(userRole)) {
      // User's role is not allowed to access this endpoint
      return res.status(403).json({ 
        error: 'Forbidden',
        statusCode: 403
      });
      // Status 403 = Forbidden (logged in, but not authorized)
    }

    // STEP 4: User has the required role, proceed to the next middleware/controller
    next();
  };
}

/**
 * CONVENIENCE SHORTCUTS (Optional - makes routes cleaner)
 * 
 * Instead of:  requireRole('ADMIN')
 * You can use: requireAdmin
 * 
 * These are just shortcuts for better readability.
 */

// Only admins can access
const requireAdmin = requireRole('ADMIN');

// Only workers can access
const requireWorker = requireRole('WORKER');

// Only customers can access
const requireCustomer = requireRole('CUSTOMER');

// Admins OR workers can access (useful for booking-related endpoints)
const requireAdminOrWorker = requireRole('ADMIN', 'WORKER');

/**
 * EXAMPLE USAGE IN ROUTES:
 * 
 * // Option 1: Using the function directly
 * router.post('/services', authenticate, requireRole('ADMIN'), createService);
 * 
 * // Option 2: Using convenience shortcuts
 * router.post('/services', authenticate, requireAdmin, createService);
 * 
 * // Option 3: Multiple roles
 * router.patch('/bookings/:id', authenticate, requireRole('ADMIN', 'WORKER'), updateBooking);
 * 
 * // Or:
 * router.patch('/bookings/:id', authenticate, requireAdminOrWorker, updateBooking);
 */

// Export everything so routes can use them
module.exports = {
  requireRole,           // The main function (flexible, takes any roles)
  requireAdmin,          // Shortcut for admin-only
  requireWorker,         // Shortcut for worker-only
  requireCustomer,       // Shortcut for customer-only
  requireAdminOrWorker,  // Shortcut for admin or worker
};
