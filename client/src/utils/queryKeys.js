// Centralized query keys for React Query
// Keeps cache namespaces consistent across roles and features

export const queryKeys = {
  bookings: {
    customer: () => ['bookings', 'customer'],
    worker: () => ['bookings', 'worker'],
    admin: () => ['bookings', 'admin'],
    detail: (id) => ['bookings', 'detail', id],
  },
  reviews: {
    customerPending: () => ['reviews', 'customer', 'pending'],
    customerWritten: () => ['reviews', 'customer', 'written'],
    workerPending: () => ['reviews', 'worker', 'pending'],
    workerWritten: () => ['reviews', 'worker', 'written'],
    workerReceived: () => ['reviews', 'worker', 'received'],
  },
};
