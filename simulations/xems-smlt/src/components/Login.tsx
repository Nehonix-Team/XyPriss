import React, { useState } from "react";
import api from "../api/axios";
import { Lock, Mail, ShieldCheck } from "lucide-react";

interface LoginProps {
    onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [email, setEmail] = useState("user@xypriss.com");
    const [password, setPassword] = useState("password123");
    const [otp, setOtp] = useState("");
    const [tempToken, setTempToken] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleStep1 = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const res = await api.post("/api/login", { email, password });
            if (res.data.status === "mfa_pending") {
                setTempToken(res.data.tempToken);
                setStep(2);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    const handleStep2 = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const res = await api.post("/api/mfa/verify", { otp, tempToken });
            if (res.data.status === "success") {
                onLoginSuccess();
            }
        } catch (err: any) {
            setError(err.response?.data?.error || "MFA verification failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="login-container"
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                padding: "40px",
                background: "#1a1a1a",
                borderRadius: "12px",
                color: "white",
                maxWidth: "400px",
                margin: "100px auto",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                border: "1px solid #333",
            }}
        >
            <h2
                style={{
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                }}
            >
                <ShieldCheck size={28} color="#4ade80" /> Secure Portal
            </h2>

            {error && (
                <div style={{ color: "#ff4d4d", fontSize: "14px" }}>
                    {error}
                </div>
            )}

            {step === 1 ? (
                <form
                    onSubmit={handleStep1}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "15px",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "5px",
                        }}
                    >
                        <label style={{ fontSize: "12px", color: "#888" }}>
                            Email
                        </label>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                background: "#222",
                                padding: "10px",
                                borderRadius: "6px",
                            }}
                        >
                            <Mail
                                size={18}
                                style={{ color: "#555", marginRight: "10px" }}
                            />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "white",
                                    outline: "none",
                                    width: "100%",
                                }}
                            />
                        </div>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "5px",
                        }}
                    >
                        <label style={{ fontSize: "12px", color: "#888" }}>
                            Password
                        </label>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                background: "#222",
                                padding: "10px",
                                borderRadius: "6px",
                            }}
                        >
                            <Lock
                                size={18}
                                style={{ color: "#555", marginRight: "10px" }}
                            />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "white",
                                    outline: "none",
                                    width: "100%",
                                }}
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: "12px",
                            background: "#4ade80",
                            color: "#000",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: "bold",
                            cursor: "pointer",
                        }}
                    >
                        {loading ? "In progress..." : "Login"}
                    </button>
                </form>
            ) : (
                <form
                    onSubmit={handleStep2}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "15px",
                    }}
                >
                    <p style={{ fontSize: "14px", color: "#aaa" }}>
                        Enter the code 123456 to verify your identity.
                    </p>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "5px",
                        }}
                    >
                        <label style={{ fontSize: "12px", color: "#888" }}>
                            MFA Code
                        </label>
                        <input
                            type="text"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="123456"
                            style={{
                                background: "#222",
                                border: "none",
                                color: "white",
                                padding: "10px",
                                borderRadius: "6px",
                                outline: "none",
                            }}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: "12px",
                            background: "#4ade80",
                            color: "#000",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: "bold",
                            cursor: "pointer",
                        }}
                    >
                        {loading ? "Verifying..." : "Verify"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setStep(1)}
                        style={{
                            background: "none",
                            border: "none",
                            color: "#888",
                            fontSize: "12px",
                            cursor: "pointer",
                        }}
                    >
                        Back to login
                    </button>
                </form>
            )}
        </div>
    );
};

export default Login;

