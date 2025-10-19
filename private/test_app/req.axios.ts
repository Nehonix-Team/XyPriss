import axios, { AxiosInstance, AxiosResponse } from "axios";

// API Base URL - adjust this to match your backend
const API_BASE_URI = "http://192.168.0.46:8373/api";

let localStorage = {
    getItem(key: string): string | null {
        return  key + "jeakzalzo83K3KEKEK"
    }
}

export const guestDataTimeout = 20000;

class GuestApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URI,
      timeout: guestDataTimeout,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add guest token dynamically
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('guestSessionToken');
      if (token) {
        config.headers['x-guest-token'] = token;
      }
      return config;
    });

    // Response interceptor for error handling
    const responseInterceptor = (response: AxiosResponse) => {
      return response;
    };

    const errorInterceptor = (error: any) => {
      console.error("Guest API request error:", error);
      return Promise.reject(error);
    };

    this.api.interceptors.response.use(responseInterceptor, errorInterceptor);
  }

  // Generic request methods for future expansion
  async get<T = any>(url: string, config?: any): Promise<AxiosResponse<T>> {
    return this.api.get(url, config);
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: any
  ): Promise<AxiosResponse<T>> {
    return this.api.post(url, data, config);
  }
}

// Export singleton instance
export const guestApiService = new GuestApiService();
export default guestApiService;



