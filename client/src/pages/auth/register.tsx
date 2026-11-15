// src/pages/auth/Register.tsx
import { useState, type SubmitEvent } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Input } from "../../components/input";
import api from "../../api/axios";
import { ShieldAlert } from "lucide-react";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleName, setRoleName] = useState<"Analyst" | "Team Lead">("Analyst");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const togglePasswordVisibility = () => setIsPasswordVisible(!isPasswordVisible);

  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const toggleConfirmPasswordVisibility = () => setIsConfirmPasswordVisible(!isConfirmPasswordVisible);

  const handleFormSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsRegistering(true);

    try {
      await api.post("/auth/register", {
        name,
        email,
        password,
        role_name: roleName,
      });
      navigate("/login");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Registration failed");
      console.error("Registration error:", err);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-text">
      {/* Platform Branding */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className="bg-primary/10 p-3 rounded-full text-primary border border-primary/20 flex items-center justify-center">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-3xl font-bold font-heading text-text-h">
          NetShield<span className="text-primary">AI</span>
        </h1>
      </div>

      <div className="w-full max-w-md bg-surface border border-border p-8 rounded-2xl shadow-xl">
        <h3 className="text-2xl font-semibold mb-6 text-center font-heading text-text-h">
          Sign Up
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="flex flex-col w-full gap-4">
          <Input
            label="Full Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            required
          />

          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="operator@netshield.ai"
            required
          />

          {/* Role Selection */}
          <div className="flex flex-col gap-2 w-full">
            <label className="text-sm font-medium text-text">
              Operational Role
            </label>
            <select
              value={roleName}
              onChange={(e) => setRoleName(e.target.value as "Analyst" | "Team Lead")}
              className="w-full px-4 py-3 rounded-lg outline-none text-sm transition-all duration-200 bg-background text-text-h border border-border focus:border-primary focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              <option value="Analyst">SOC Analyst</option>
              <option value="Team Lead">Team Lead</option>
            </select>
          </div>

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            isPasswordVisible={isPasswordVisible}
            togglePasswordVisibility={togglePasswordVisibility}
          />

          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            isPasswordVisible={isConfirmPasswordVisible}
            togglePasswordVisibility={toggleConfirmPasswordVisibility}
          />

          <button
            type="submit"
            disabled={isRegistering}
            className={`w-full mt-3 py-3 px-4 rounded-lg font-semibold text-background bg-primary hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/20 ${
              isRegistering ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            {isRegistering ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-background border-t-transparent animate-spin" />
                Initializing Account...
              </>
            ) : (
              "Register Credentials"
            )}
          </button>

          <div className="text-center text-sm text-muted mt-3">
            Already have an account? 
            <NavLink to="/login" className="text-primary hover:underline font-medium">
              Sign In
            </NavLink>
          </div>
        </form>
      </div>
    </div>
  );
}