import { useState, useEffect } from "react";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import api from "./api/axios";

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await api.get("/auth/status");
                if (response.data.authenticated) {
                    setIsLoggedIn(true);
                }
            } catch (err) {
                console.log("No active session");
            } finally {
                setIsLoading(false);
            }
        };
        checkAuth();
    }, []);

    if (isLoading) {
        return (
            <div
                style={{
                    width: "100%",
                    minHeight: "100vh",
                    background: "#000",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#00f0ff",
                    fontFamily: "Inter, sans-serif",
                }}
            >
                <div className="animate-pulse">Loading Secure Session...</div>
            </div>
        );
    }

    return (
        <div style={{ width: "100%", minHeight: "100vh", background: "#000" }}>
            {!isLoggedIn ? (
                <Login onLoginSuccess={() => setIsLoggedIn(true)} />
            ) : (
                <Dashboard onLogout={() => setIsLoggedIn(false)} />
            )}
        </div>
    );
}

export default App;

