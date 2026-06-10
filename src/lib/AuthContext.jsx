import React, { createContext, useState, useContext, useEffect } from 'react';
import { client, supabase } from '@/api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const applySession = (session) => {
      if (session?.user) {
        // Reuse the same user-shape helper as client.auth.me()
        client.auth.me().then((me) => {
          setUser(me);
          setIsAuthenticated(true);
          setAuthError(null);
          setIsLoadingAuth(false);
        });
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    };

    supabase.auth.getSession().then(({ data }) => applySession(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    await client.auth.logout();
  };

  const navigateToLogin = () => {
    client.auth.redirectToLogin();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        appPublicSettings: null,
        logout,
        navigateToLogin,
        checkAppState: () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
