import { useEffect, useState } from "react";
import { getProfile, logout, type User } from "../api";

interface Props {
    onLogout: () => void;
}

export default function Dashboard({ onLogout }: Props) {
    const [user, setUser] = useState<User | null>(null);
    const [tokenRotated, setTokenRotated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {
        async function fetchProfile() {
            const result = await getProfile();
            setLoading(false);
            if (result.ok && result.data) {
                setUser(result.data.user);
                setTokenRotated(result.data.tokenRotated);
            } else {
                setError(result.error ?? "Failed to load profile");
            }
        }
        fetchProfile();
    }, []);

    async function handleLogout() {
        setLoggingOut(true);
        await logout();
        onLogout();
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-400 text-sm">Loading session…</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-red-800/50 rounded-2xl p-8 max-w-md w-full text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                    <button
                        onClick={onLogout}
                        className="text-violet-400 hover:text-violet-300 text-sm transition-colors"
                    >
                        Back to login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Top bar */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs text-gray-500 font-mono">
                            XEMS Session Active
                        </span>
                    </div>
                    <button
                        id="logout-btn"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="text-sm text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                        {loggingOut ? "Signing out…" : "Sign out"}
                    </button>
                </div>

                {/* Profile card */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-xl font-bold text-violet-300">
                            {user?.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                            <h2 className="text-white font-semibold text-lg">
                                {user?.name}
                            </h2>
                            <p className="text-gray-400 text-sm">
                                {user?.email}
                            </p>
                        </div>
                        <span className="ml-auto text-xs bg-violet-900/50 text-violet-300 border border-violet-700/50 px-2.5 py-1 rounded-full font-medium">
                            {user?.role}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-800/60 rounded-xl p-4">
                            <p className="text-xs text-gray-500 mb-1">
                                User ID
                            </p>
                            <p className="text-white text-sm font-mono truncate">
                                {user?.id}
                            </p>
                        </div>
                        <div className="bg-gray-800/60 rounded-xl p-4">
                            <p className="text-xs text-gray-500 mb-1">
                                Member since
                            </p>
                            <p className="text-white text-sm">
                                {user?.createdAt
                                    ? new Date(
                                          user.createdAt,
                                      ).toLocaleDateString()
                                    : "—"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Token rotation status */}
                <div
                    className={`rounded-2xl border p-5 ${
                        tokenRotated
                            ? "bg-emerald-950/30 border-emerald-800/40"
                            : "bg-gray-900 border-gray-800"
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center ${tokenRotated ? "bg-emerald-500/20" : "bg-gray-800"}`}
                        >
                            <svg
                                className={`w-4 h-4 ${tokenRotated ? "text-emerald-400" : "text-gray-500"}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                        </div>
                        <div>
                            <p
                                className={`text-sm font-medium ${tokenRotated ? "text-emerald-300" : "text-gray-400"}`}
                            >
                                {tokenRotated
                                    ? "Token rotated on this request"
                                    : "Token stable (no rotation needed)"}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                                XEMS auto-rotates tokens to prevent replay
                                attacks
                            </p>
                        </div>
                    </div>
                </div>

                {/* Security info */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">
                        Security Details
                    </h3>
                    <div className="space-y-2.5">
                        {[
                            {
                                label: "Storage",
                                value: "HttpOnly Cookie + Memory (no localStorage)",
                                ok: true,
                            },
                            {
                                label: "Encryption",
                                value: "AES-256-GCM · Hardware-bound key",
                                ok: true,
                            },
                            {
                                label: "Token rotation",
                                value: "Automatic on every request",
                                ok: true,
                            },
                            {
                                label: "Sandbox",
                                value: "auth-automated (isolated namespace)",
                                ok: true,
                            },
                        ].map((item) => (
                            <div
                                key={item.label}
                                className="flex items-center justify-between text-sm"
                            >
                                <span className="text-gray-500">
                                    {item.label}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <div
                                        className={`w-1.5 h-1.5 rounded-full ${item.ok ? "bg-emerald-400" : "bg-red-400"}`}
                                    />
                                    <span className="text-gray-300 text-xs">
                                        {item.value}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

