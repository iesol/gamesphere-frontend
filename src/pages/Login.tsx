import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const { login, user, organizations } = useAuth();
  const navigate = useNavigate();

  const handleSuccess = async (credentialResponse: any) => {
    try {
      await login(credentialResponse.credential);
    } catch (e: any) {
      const msg = e?.response?.data?.message || '';
      if (msg.includes('User not found')) {
        navigate('/access-denied');
      } else {
        console.error('Login failed', e);
      }
    }
  };

  useEffect(() => {
    if (!user) return;
    if (organizations.length === 0) {
      navigate('/admin/orgs');
    } else if (organizations.length === 1) {
      localStorage.setItem('gamesphere_org_id', organizations[0].id);
      navigate('/dashboard');
    } else {
      navigate('/org-picker');
    }
  }, [user, organizations]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900">
      <div className="card p-10 max-w-md w-full text-center">
        <img src="/logo.svg" alt="GameSphere" className="w-14 h-14 mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-1 tracking-tight">GameSphere</h1>
        <p className="text-gray-500 mb-8">Multi-tenant gaming tournament platform</p>
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => console.error('Google login failed')}
            theme="outline"
            size="large"
            shape="rectangular"
            width="300"
          />
        </div>
      </div>
    </div>
  );
}
