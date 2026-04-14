import { useState } from "react";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);

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

