import React, { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';

const AuthTest: React.FC = () => {
  const { user, session, loading } = useAuth();
  const [authStatus, setAuthStatus] = useState<string>('Checking...');

  useEffect(() => {
    if (loading) {
      setAuthStatus('Loading...');
    } else if (user && session) {
      setAuthStatus(`✅ Authenticated as ${user.email}`);
    } else {
      setAuthStatus('❌ Not authenticated');
    }
  }, [user, session, loading]);

  return (
    <div className="fixed top-4 right-4 bg-white p-4 border rounded-lg shadow-lg z-50">
      <h3 className="font-bold text-sm mb-2">Auth Status</h3>
      <p className="text-xs">{authStatus}</p>
      {user && (
        <div className="mt-2 text-xs text-gray-600">
          <p>User ID: {user.id}</p>
          <p>Email: {user.email}</p>
          <p>Last Sign In: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Unknown'}</p>
        </div>
      )}
    </div>
  );
};

export default AuthTest;
