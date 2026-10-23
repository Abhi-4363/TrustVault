import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL, buildApiUrl } from '../config/api';

const AuthContext = createContext(null);

const TOKEN_STORAGE_KEY = 'trustvault_auth_token';

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
          // Token expired, deactivated, or invalid
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

  // Manually set session upon verification or custom login
  const setSession = (authUser, authToken) => {
    if (authToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, authToken);
      setToken(authToken);
    }
    setUser(authUser);
  };

  // Verify email token (autoLogin optional, default false)
  const verifyEmailToken = async (rawToken, autoLogin = false) => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-email?token=${encodeURIComponent(rawToken)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Email verification failed.');
    }

    const { user: verifiedUser, token: authToken } = data.data;
    if (autoLogin) {
      setSession(verifiedUser, authToken);
    }
    return { user: verifiedUser, token: authToken, message: data.message };
  };

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

  // Register new account
  const register = async (nameOrData, email, password, requestedRole = 'viewer', dateOfBirth, termsAccepted, confirmPassword) => {
    let payload;
    if (typeof nameOrData === 'object' && nameOrData !== null) {
      payload = {
        name: nameOrData.name,
        email: nameOrData.email,
        password: nameOrData.password,
        confirmPassword: nameOrData.confirmPassword,
        dateOfBirth: nameOrData.dateOfBirth,
        termsAccepted: Boolean(nameOrData.termsAccepted),
        requestedRole: nameOrData.requestedRole || 'viewer',
        accountType: nameOrData.requestedRole || 'viewer',
      };
    } else {
      payload = {
        name: nameOrData,
        email,
        password,
        confirmPassword,
        dateOfBirth,
        termsAccepted: Boolean(termsAccepted),
        requestedRole,
        accountType: requestedRole,
      };
    }

    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      const err = new Error(data.error?.message || 'Registration failed');
      err.code = data.error?.code;
      err.details = data.error;
      throw err;
    }

    const { user: newUser, token: newToken, isEmailVerified } = data.data;

    // Only establish active authenticated session if account is verified
    if (isEmailVerified !== false && newToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
      setToken(newToken);
      setUser(newUser);
    }

    return { 
      user: newUser, 
      token: newToken, 
      isEmailVerified: isEmailVerified !== false, 
      devVerifyUrl: data.data?.devVerifyUrl,
      message: data.message 
    };
  };

  // Update authenticated user profile (name, dateOfBirth)
  const updateProfile = async (profileData) => {
    if (!token) throw new Error('Authentication required.');
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(profileData),
    });

    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.error?.message || 'Failed to update profile.');
      err.code = data.error?.code;
      err.details = data.error;
      throw err;
    }

    const updatedUser = data.data.user;
    setUser(updatedUser);
    return updatedUser;
  };

  // Fetch fresh profile details from /api/auth/profile
  const fetchProfile = async () => {
    if (!token) return null;
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const data = await response.json();
      setUser(data.data.user);
      return data.data.user;
    }
    return null;
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
      const err = new Error(data.error?.message || 'Invalid email or password');
      err.code = data.error?.code;
      throw err;
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

  // Request Document Owner access for the currently authenticated Viewer
  const requestOwnerAccess = async () => {
    if (!token) throw new Error('Authentication required.');
    const response = await fetch(`${API_BASE_URL}/auth/request-owner-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.error?.message || 'Failed to submit Owner access request.');
      err.code = data.error?.code;
      err.details = data.error;
      throw err;
    }

    // Refresh profile to reflect pending state
    await refreshProfile();
    return data;
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
        setSession,
        verifyEmailToken,
        refreshProfile,
        fetchProfile,
        updateProfile,
        requestOwnerAccess,
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
