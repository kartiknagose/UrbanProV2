// ClerkBridge — bridges Clerk session state to our custom AuthContext.
// Rendered inside ClerkProvider + AuthProvider so it can read both.

import { useEffect, useContext } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import { AuthContext } from '../../context/AuthContextBase';

export function ClerkBridge() {
  const { isSignedIn, isLoaded } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const auth = useContext(AuthContext);

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      auth._hydrateFromClerk();
    } else {
      auth._clearSession();
    }
    // auth._hydrateFromClerk and auth._clearSession are stable memoized callbacks
    // (defined with useCallback in AuthProvider) so omitting them is intentional.
    // Including them would cause an infinite loop because they reference dispatch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, clerkUser?.id]);

  return null;
}
