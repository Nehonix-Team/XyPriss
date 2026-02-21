/**
 * XEMS Auth API Service
 *
 * All auth is managed via HttpOnly cookies + x-xypriss-token header.
 * No localStorage is used. The XEMS backend handles token rotation automatically.
 */

import axios from "axios";

const BASE_URL = "http://localhost:6578";

// In-memory token store (lives only for the current tab session).
// This is the ONLY place the token is stored on the client — no localStorage.
// But here, we'll only use cookies

// ─── Axios Instance ───────────────────────────────────────────────────────────

const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: true, // Send HttpOnly cookies automatically
    headers: {
        "Content-Type": "application/json",
    },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
}

export interface AuthResponse {
    success: boolean;
    message: string;
    user?: User;
    token?: string;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export async function register(name: string, email: string, password: string) {
    try {
        const { data } = await api.post<AuthResponse>("/auth/register", {
            name,
            email,
            password,
        });
        return { ok: true, data };
    } catch (err: any) {
        return {
            ok: false,
            error:
                err.response?.data?.error ||
                err.message ||
                "Registration failed",
        };
    }
}

export async function login(email: string, password: string) {
    try {
        const { data } = await api.post<AuthResponse>("/auth/login", {
            email,
            password,
        });
        return { ok: true, data };
    } catch (err: any) {
        return {
            ok: false,
            error: err.response?.data?.error || err.message || "Login failed",
        };
    }
}

export async function logout() {
    try {
        const { data } = await api.post<{ success: boolean }>("/auth/logout");
        return { ok: true, data };
    } catch (err: any) {
        return {
            ok: false,
            error: err.response?.data?.error || err.message || "Logout failed",
        };
    }
}

export async function getProfile() {
    try {
        const { data } = await api.get<{ user: User; tokenRotated: boolean }>(
            "/auth/profile",
        );
        return { ok: true, data };
    } catch (err: any) {
        return {
            ok: false,
            error: err.response?.data?.error || err.message || "Unauthorized",
        };
    }
}

