import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const TOKEN_STORAGE_KEY = 'trustvault_auth_token';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || null);
  const [isLoading, setIsLoading] = useState(true);

  // Verify stored token on initial load
  useEffect(() => {
    async function verifySession() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          setUser(result.data.user);
        } else {
          // Token expired or invalid
          logout();
        }
      } catch (err) {
        console.error('Session verification error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    verifySession();
  }, [token]);

  // Refresh current user session profile
  const refreshProfile = async () => {
    if (!token) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setUser(result.data.user);
        return result.data.user;
      }
    } catch (err) {
      console.error('Profile refresh error:', err);
    }
    return null;
  };

  // Register new account (public accounts default to viewer, owner requests are queued)
  const register = async (name, email, password, requestedRole = 'viewer') => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        email,
        password,
        requestedRole,
        accountType: requestedRole,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Registration failed');
    }

    const { user: newUser, token: newToken } = data.data;
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    return { user: newUser, token: newToken, message: data.message };
  };

  // Log in with existing credentials
  const login = async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Invalid email or password');
    }

    const { user: authUser, token: authToken } = data.data;
    localStorage.setItem(TOKEN_STORAGE_KEY, authToken);
    setToken(authToken);
    setUser(authUser);
    return authUser;
  };

  // Sign out and clear stored session
  const logout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        register,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
