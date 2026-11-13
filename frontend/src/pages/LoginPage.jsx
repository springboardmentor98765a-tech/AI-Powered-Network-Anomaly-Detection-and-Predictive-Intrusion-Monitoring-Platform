import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Shield, AlertCircle, KeyRound, User } from 'lucide-react';

export default function LoginPage() {
  const { login, error: contextError } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!identifier.trim() || !password) {
      setLocalError('Please enter both username/email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(identifier.trim(), password);
    } catch (err) {
      setLocalError(err.message || 'Invalid credentials. Please verify your username/email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
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

        {/* Login Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Sign in to console</CardTitle>
            <CardDescription>Enter your analyst credentials to continue</CardDescription>
          </CardHeader>

          <CardContent>
            {(localError || contextError) && (
              <div
                role="alert"
                aria-live="polite"
                className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-800 text-xs leading-relaxed"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{localError || contextError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="identifier">
                  Email or Username <span aria-hidden="true" className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type="text"
                    id="identifier"
                    name="username"
                    autoComplete="username"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter username or email"
                    className="pl-8"
                  />
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">
                  Password <span aria-hidden="true" className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type="password"
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="pl-8"
                  />
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full mt-2"
              >
                {loading ? 'Authenticating...' : 'Continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
