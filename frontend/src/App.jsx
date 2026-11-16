
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import Users from "./pages/Users";
import Teams from "./pages/Teams";
import Roles from "./pages/Roles";
import Audit from "./pages/Audit";

function App() {
    return (
        <BrowserRouter>
            <Routes>

                {/* Default route */}
                <Route
                    path="/"
                    element={<Navigate to="/dashboard" replace />}
                />

                {/* Login page */}
                <Route
                    path="/login"
                    element={<Login />}
                />

                {/* Protected dashboard */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />

                {/* User Management */}
                <Route
                    path="/users"
                    element={
                        <ProtectedRoute>
                            <Users />
                        </ProtectedRoute>
                    }
                />

                {/* Team Management */}
                <Route
                    path="/teams"
                    element={
                        <ProtectedRoute>
                            <Teams />
                        </ProtectedRoute>
                    }
                />

                {/* Role Management */}
                <Route
                    path="/roles"
                    element={
                        <ProtectedRoute>
                            <Roles />
                        </ProtectedRoute>
                    }
                />

                {/* Audit Logs */}
<Route
    path="/audit"
    element={
        <ProtectedRoute>
            <Audit />
        </ProtectedRoute>
    }
/>

                {/* Unknown routes */}
                <Route
                    path="*"
                    element={<Navigate to="/dashboard" replace />}
                />

            </Routes>
        </BrowserRouter>
    );
}

export default App;
