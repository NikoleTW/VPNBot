import { apiRequest } from "./queryClient";

interface LoginResponse {
  token: string;
  username: string;
  expiresAt: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface VerifyTokenResponse {
  valid: boolean;
  username?: string;
  expiresAt?: string;
}

/**
 * Authentication helper functions
 */
export const auth = {
  /**
   * Log in a user
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await apiRequest("POST", "/api/admin/login", credentials);
    const data = await response.json();
    
    // Store token in localStorage
    localStorage.setItem("authToken", data.token);
    localStorage.setItem("isAuthenticated", "true");
    localStorage.setItem("username", data.username);
    
    return data;
  },
  
  /**
   * Log out a user
   */
  async logout(): Promise<void> {
    const token = localStorage.getItem("authToken");
    
    if (token) {
      try {
        await apiRequest("POST", "/api/admin/logout", { token });
      } catch (error) {
        console.error("Error during logout:", error);
      }
    }
    
    // Clear localStorage
    localStorage.removeItem("authToken");
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("username");
  },
  
  /**
   * Verify if a token is valid
   */
  async verifyToken(): Promise<VerifyTokenResponse> {
    const token = localStorage.getItem("authToken");
    
    if (!token) {
      return { valid: false };
    }
    
    try {
      const response = await apiRequest("POST", "/api/admin/verify-token", { token });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error verifying token:", error);
      // Clear invalid token
      localStorage.removeItem("authToken");
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("username");
      return { valid: false };
    }
  },
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return localStorage.getItem("isAuthenticated") === "true";
  },
  
  /**
   * Get current username
   */
  getUsername(): string | null {
    return localStorage.getItem("username");
  },
  
  /**
   * Initialize admin account
   */
  async setupAdmin(credentials: LoginCredentials & { email?: string }): Promise<any> {
    const response = await apiRequest("POST", "/api/admin/setup", credentials);
    return response.json();
  }
};