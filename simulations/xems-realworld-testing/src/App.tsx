import { useState, useEffect } from "react";
import LoginForm from "./components/LoginForm";
import RegisterForm from "./components/RegisterForm";
import Dashboard from "./components/Dashboard";
import { getProfile } from "./api";

type View = "login" | "register" | "dashboard";

export default function App() {
    const [view, setView] = useState<View>("login");
    const [checking, setChecking] = useState(true);

    // On mount: try to restore session from cookie (no localStorage needed)
    useEffect(() => {
        async function checkSession() {
            const result = await getProfile();
            if (result.ok) {
                setView("dashboard");
            }
            setChecking(false);
        }
        checkSession();
    }, []);

    if (checking) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 text-sm">Checking session…</p>
                </div>
            </div>
        );
    }

    if (view === "dashboard") {
        return <Dashboard onLogout={() => setView("login")} />;
    }

    if (view === "register") {
        return (
            <RegisterForm
                onSuccess={() => setView("dashboard")}
                onSwitchToLogin={() => setView("login")}
            />
        );
    }

    return (
        <LoginForm
            onSuccess={() => setView("dashboard")}
            onSwitchToRegister={() => setView("register")}
        />
    );
}

