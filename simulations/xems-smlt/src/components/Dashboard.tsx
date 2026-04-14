import React, { useEffect, useState } from "react";
import api from "../api/axios";
import {
    Activity,
    LayoutDashboard,
    LogOut,
    ShieldAlert,
    Cpu,
} from "lucide-react";

const Dashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const [widgets, setWidgets] = useState<Record<string, any>>({});
    const [adminData, setAdminData] = useState<any>(null);
    const [adminError, setAdminError] = useState("");
    const [loading, setLoading] = useState(false);

    const fetchWidgets = async () => {
        setLoading(true);
        const widgetIds = ["profile", "stats", "alerts", "system", "logs"];

        // STRESS TEST: Concurrent requests
        // This will trigger multiple atomic rotations if enabled,
        // testing the Grace Period of XEMS. 
        try {
            const results = await Promise.all(
                widgetIds.map((id) => api.get(`/api/dashboard/widgets/${id}`)),
            );
            const data: Record<string, any> = {};
            results.forEach((res, i) => {
                data[widgetIds[i]] = res.data;
            });
            setWidgets(data);
        } catch (err) {
            console.error("Failed to fetch widgets", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAdminStats = async () => {
        setAdminError("");
        setAdminData(null);
        try {
            const res = await api.get("/admin-api/stats");
            setAdminData(res.data);
        } catch (err: any) {
            setAdminError(err.response?.data?.error || "Access Denied");
        }
    };

    useEffect(() => {
        fetchWidgets();
    }, []);

    const handleLogout = async () => {
        try {
            await api.post("/api/logout");
            onLogout();
        } catch (err) {
            console.error("Logout failed", err);
        }
    };

    return (
        <div
            style={{
                padding: "20px",
                color: "white",
                background: "#121212",
                minHeight: "100vh",
            }}
        >
            <header
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "30px",
                    borderBottom: "1px solid #333",
                    paddingBottom: "15px",
                }}
            >
                <h1
                    style={{
                        margin: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                    }}
                >
                    <LayoutDashboard size={32} color="#4ade80" /> Enterprise
                    Dashboard
                </h1>
                <button
                    onClick={handleLogout}
                    style={{
                        background: "#333",
                        color: "white",
                        border: "none",
                        padding: "8px 16px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                    }}
                >
                    <LogOut size={18} /> Logout
                </button>
            </header>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: "20px",
                }}
            >
                {Object.entries(widgets).map(([id, data]) => (
                    <div
                        key={id}
                        style={{
                            background: "#1e1e1e",
                            padding: "20px",
                            borderRadius: "10px",
                            border: "1px solid #333",
                        }}
                    >
                        <h3
                            style={{
                                marginTop: 0,
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                borderBottom: "1px solid #222",
                                paddingBottom: "10px",
                            }}
                        >
                            <Activity size={20} color="#4ade80" />{" "}
                            {id.toUpperCase()}
                        </h3>
                        <p style={{ fontSize: "14px", color: "#aaa" }}>
                            {data.data}
                        </p>
                        <small style={{ color: "#555" }}>
                            User ID: {data.sessionInfo.userId}
                        </small>
                    </div>
                ))}

                {/* RELOAD BUTTON FOR STRESS TEST */}
                <div
                    style={{
                        gridColumn: "1 / -1",
                        display: "flex",
                        justifyContent: "center",
                    }}
                >
                    <button
                        onClick={fetchWidgets}
                        disabled={loading}
                        style={{
                            padding: "12px 24px",
                            background: "#222",
                            border: "1px solid #4ade80",
                            color: "#4ade80",
                            borderRadius: "8px",
                            cursor: "pointer",
                        }}
                    >
                        {loading
                            ? "Stressing XEMS..."
                            : "Trigger Concurrent Requests"}
                    </button>
                </div>

                {/* ADMIN ISOLATION TEST */}
                <div
                    style={{
                        gridColumn: "1 / -1",
                        background: "#1a1a1a",
                        padding: "30px",
                        borderRadius: "12px",
                        marginTop: "20px",
                        border: "1px dashed #444",
                    }}
                >
                    <h2
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                        }}
                    >
                        <ShieldAlert size={24} color="#f87171" /> Admin
                        Isolation Test (Port 3729)
                    </h2>
                    <p style={{ color: "#888" }}>
                        This request targets the administrative port. It should
                        fail unless the session is explicitly linked to the
                        admin port with admin role.
                    </p>

                    <button
                        onClick={fetchAdminStats}
                        style={{
                            padding: "10px 20px",
                            background: "#f87171",
                            color: "black",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: "bold",
                            cursor: "pointer",
                        }}
                    >
                        Fetch Admin Stats
                    </button>

                    <div
                        style={{
                            marginTop: "20px",
                            padding: "15px",
                            background: "#000",
                            borderRadius: "6px",
                        }}
                    >
                        {adminError ? (
                            <div style={{ color: "#f87171" }}>
                                <strong>Status:</strong> {adminError} (ISOLATED
                                ✅)
                            </div>
                        ) : adminData ? (
                            <div style={{ color: "#4ade80" }}>
                                <strong>Status:</strong> Access Granted (LEAK?
                                ❌)
                                <pre
                                    style={{
                                        fontSize: "12px",
                                        marginTop: "10px",
                                    }}
                                >
                                    {JSON.stringify(adminData, null, 2)}
                                </pre>
                            </div>
                        ) : (
                            <div style={{ color: "#555" }}>
                                No test performed yet.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <footer
                style={{
                    marginTop: "40px",
                    textAlign: "center",
                    color: "#444",
                    fontSize: "12px",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "5px",
                    }}
                >
                    <Cpu size={14} /> XEMS Engine Robustness Simulation v1.0
                </div>
            </footer>
        </div>
    );
};

export default Dashboard;

