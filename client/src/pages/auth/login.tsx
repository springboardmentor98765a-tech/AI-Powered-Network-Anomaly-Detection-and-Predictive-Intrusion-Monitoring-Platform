// src/pages/auth/login.tsx
import { useState, type SubmitEvent } from "react";
import { NavLink } from "react-router-dom";
import { Input } from "../../components/input";
import { useAuth } from "../../context/authContext";
import { ShieldAlert } from "lucide-react";

export default function LoginPage() {
  const { login, error } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const handleFormSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (email && password) {
      setIsLoggingIn(true);
      try {
        await login(email, password);
      } catch (err) {
        console.error("Login submission error:", err);
      } finally {
        setIsLoggingIn(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-text">
      {/* Platform Title / Header */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className="flex items-center bg-primary/10 p-3 rounded-full text-primary border border-primary/20">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-3xl font-bold font-heading m-0 leading-0 text-text-h">
          NetShield<span className="text-primary">AI</span>
        </h1>
      </div>

      <div className="w-full max-w-md bg-surface border border-border p-8 rounded-2xl shadow-xl">
        <h3 className="text-2xl font-semibold mb-6 text-center font-heading text-text-h">
          Sign In
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="flex flex-col w-full gap-4">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@netshield.ai"
            required
          />

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

          <div className="flex w-full justify-end text-sm">
            <NavLink to="/" className="text-primary hover:underline cursor-pointer">
              Forgot Password?
            </NavLink>
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className={`w-full mt-2 py-3 px-4 rounded-lg font-semibold text-background bg-primary hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/20 ${
              isLoggingIn ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            {isLoggingIn ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-background border-t-transparent animate-spin" />
                Authenticating...
              </>
            ) : (
              "Authenticate Session"
            )}
          </button>

          <div className="text-center text-sm text-muted mt-2">
            Don't have an account? 
            <NavLink to="/register" className="text-primary hover:underline font-medium">
              Create one
            </NavLink>
          </div>
        </form>
      </div>
    </div>
  );
}