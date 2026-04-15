import axios from "axios";

const api = axios.create({
    baseURL: "/api",
    withCredentials: true, // Required for XEMS HttpOnly cookies
});

// Interceptor to handle errors globally if needed
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.warn("Session expired or unauthorized");
        }
        return Promise.reject(error);
    },
);

export default api;

