import { api, clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/api";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface AuthUser {
  id: string;
  companyId: string | null;
  roleId: string;
  roleName: string;
  firstName: string;
  email: string;
  permissions: string[];
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(() => !!getAccessToken());

  useEffect(() => {
    if (!getAccessToken()) return;
    api
      .get<AuthUser>("/auth/me")
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const tokens = await api.post<LoginResponse>("/auth/login", { email, password }, { skipAuth: true });
    setTokens(tokens.accessToken, tokens.refreshToken);
    const me = await api.get<AuthUser>("/auth/me");
    setUser(me);
  };

  const logout = async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await api.post("/auth/logout", { refreshToken }, { skipAuth: true }).catch(() => undefined);
    }
    clearTokens();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
