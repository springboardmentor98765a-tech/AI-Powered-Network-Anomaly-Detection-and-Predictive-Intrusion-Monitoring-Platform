import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Shield, AlertCircle, KeyRound, User, Mail, Briefcase } from 'lucide-react';

export default function RegisterPage({ onSwitchToLogin }) {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    role: 'Security Analyst',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!formData.fullName.trim() || !formData.username.trim() || !formData.email.trim() || !formData.password) {
      setLocalError('Please fill in all required fields.');
      return;
    }

    if (formData.username.length < 3) {
      setLocalError('Username must be at least 3 characters.');
      return;
    }

    if (formData.password.length < 8) {
      setLocalError('Password must be at least 8 characters in length.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      await register({
        full_name: formData.fullName.trim(),
        username: formData.username.trim(),
        email: formData.email.trim(),
        role: formData.role,
        password: formData.password,
      });
      // User is automatically set and redirected by AuthContext
    } catch (err) {
      setLocalError(err.message || 'Registration failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-slate-900 rounded-lg text-white mb-3 shadow-xs">
            <Shield className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">NetShield AI</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Network Anomaly Detection & Threat Monitoring
          </p>
        </div>

        {/* Register Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Create an account</CardTitle>
            <CardDescription>Enter your credentials and select your access role</CardDescription>
          </CardHeader>

          <CardContent>
            {localError && (
              <div
                role="alert"
                aria-live="polite"
                className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-800 text-xs leading-relaxed"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{localError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">
                  Full Name <span aria-hidden="true" className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type="text"
                    id="fullName"
                    name="fullName"
                    autoComplete="name"
                    required
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Full name"
                    className="pl-8"
                  />
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="username">
                    Username <span aria-hidden="true" className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    id="username"
                    name="username"
                    autoComplete="username"
                    required
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="username"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">
                    Email Address <span aria-hidden="true" className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="analyst@netshield.ai"
                  />
                </div>
              </div>

              {/* Role Dropdown */}
              <div className="space-y-1.5">
                <Label htmlFor="role">
                  Platform Role <span aria-hidden="true" className="text-rose-500">*</span>
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, role: val }))}
                >
                  <SelectTrigger id="role" className="w-full h-8.5 bg-white border-slate-300 text-xs text-slate-900 shadow-xs">
                    <div className="flex items-center gap-2 truncate">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <SelectValue placeholder="Select platform role" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Security Analyst">Security Analyst (Monitoring & Alerts)</SelectItem>
                    <SelectItem value="Team Lead / Supervisor">Team Lead / Supervisor (Team Oversight)</SelectItem>
                    <SelectItem value="Administrator">Administrator (Full System Administration)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="password">
                    Password <span aria-hidden="true" className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type="password"
                      id="password"
                      name="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="••••••••••••"
                      className="pl-8"
                    />
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">
                    Confirm Password <span aria-hidden="true" className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="••••••••••••"
                      className="pl-8"
                    />
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full mt-2"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>

            <div className="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-500">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-medium text-slate-900 hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
