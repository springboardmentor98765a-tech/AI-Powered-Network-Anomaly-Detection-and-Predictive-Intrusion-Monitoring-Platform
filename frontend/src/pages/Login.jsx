
import { useState } from "react";
import API from "../services/api";
import "../styles/Login.css";

import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Login() {
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { setUser } = useAuth();

    const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
        const response = await API.post("/auth/login", {
            identifier,
            password,
        });

        localStorage.setItem(
            "access_token",
            response.data.access_token
        );

        const userResponse = await API.get("/auth/me");

        setUser(userResponse.data);

        navigate("/dashboard");

    } catch (err) {
        localStorage.removeItem("access_token");
        setUser(null);

        setError(
            err.response?.data?.detail ||
            "Login failed. Check your credentials."
        );
    } finally {
        setLoading(false);
    }
};

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-icon">🛡️</div>

                <h1>Network Anomaly Detection</h1>
                <p className="subtitle">
                    Security Monitoring Platform
                </p>

                <h2>Welcome Back</h2>
                <p className="login-description">
                    Sign in to access your dashboard
                </p>

                <form onSubmit={handleLogin}>
                    <label>Username or Email</label>
                    <input
                        type="text"
                        placeholder="Enter username or email"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                    />

                    <label>Password</label>
                    <input
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    {error && <p className="error-message">{error}</p>}

                    <button type="submit" disabled={loading}>
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>

                <p className="login-footer">
                    Secure access for authorized personnel only
                </p>
            </div>
        </div>
    );
}

export default Login;
