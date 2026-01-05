import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/features/auth';
import { isApiOk } from '@/shared/lib/api-response';

export default function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const result = await authService.handleOAuthCallback();
        
        if (!isApiOk(result)) {
          console.error('OAuth callback error:', result.error);
          navigate('/login');
          return;
        }

        if (result.data.session) {
          // Successfully authenticated, redirect to dashboard
          navigate('/dashboard');
        } else {
          // No session found, redirect to login
          navigate('/login');
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        navigate('/login');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-brand-light">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-brand-dark font-body">Completing sign in...</p>
      </div>
    </div>
  );
}
