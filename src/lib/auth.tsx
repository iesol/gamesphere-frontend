import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from './api';

interface User {
  id: string;
  email: string;
  name: string;
  pictureUrl?: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  organizations: Organization[];
  isLoading: boolean;
  login: (credential: string) => Promise<void>;
  logout: () => void;
  setActiveOrg: (orgId: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('gamesphere_token'));
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data.user);
          setOrganizations(res.data.organizations);
          if (res.data.token) {
            localStorage.setItem('gamesphere_token', res.data.token);
          }
        })
        .catch(() => {
          localStorage.removeItem('gamesphere_token');
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (credential: string) => {
    localStorage.removeItem('gamesphere_org_id');
    const res = await api.post('/auth/google', { credential });
    const { token: newToken, user: newUser, organizations: orgs } = res.data;
    localStorage.setItem('gamesphere_token', newToken);
    setToken(newToken);
    setUser(newUser);
    setOrganizations(orgs || []);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('gamesphere_token');
    localStorage.removeItem('gamesphere_org_id');
    setToken(null);
    setUser(null);
    setOrganizations([]);
  }, []);

  const setActiveOrg = useCallback((orgId: string) => {
    localStorage.setItem('gamesphere_org_id', orgId);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, organizations, isLoading, login, logout, setActiveOrg }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
