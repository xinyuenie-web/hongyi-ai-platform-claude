'use client';

import { createContext, useContext } from 'react';

export const AuthContext = createContext<{ token: string; logout: () => void }>({
  token: '',
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
