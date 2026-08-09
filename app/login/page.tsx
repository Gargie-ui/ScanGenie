'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { user, isGuest, isLoading, signIn, signUp, continueAsGuest } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated or guest
  useEffect(() => {
    if (!isLoading && (user || isGuest)) {
      router.replace('/');
    }
  }, [user, isGuest, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        const { data, error: authError } = await signUp(email, password, name);
        if (authError) {
          setError(authError.message);
        } else if (data?.session) {
          // Auto logged in (email confirmation is disabled in Supabase)
          router.replace('/');
        } else {
          setSuccess('Account created! If you do not receive a confirmation email, disable "Confirm Email" in Supabase Dashboard > Authentication > Providers > Email.');
          setIsSignUp(false);
          setPassword('');
        }
      } else {
        const { error: authError } = await signIn(email, password);
        if (authError) {
          setError(authError.message);
        }
        // Redirect handled by useEffect
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestAccess = () => {
    continueAsGuest(name);
    // Redirect handled by useEffect
  };

  // Show nothing while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0d] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // If already logged in, don't flash login page
  if (user || isGuest) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0d] flex relative overflow-hidden select-none">

      {/* ──── Animated Background Orbs ──── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-primary/15 rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute -bottom-60 -right-40 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-tertiary/8 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
        {/* Grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(208,188,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(208,188,255,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* ──── Left: Branding Hero ──── */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center relative px-12">
        
        {/* Floating decorative elements */}
        <div className="absolute top-20 left-16 w-20 h-20 border border-primary/15 rounded-2xl rotate-12 opacity-40" />
        <div className="absolute bottom-32 right-20 w-14 h-14 border border-secondary/15 rounded-xl -rotate-6 opacity-30" />
        <div className="absolute top-1/3 right-16 w-3 h-3 bg-primary/40 rounded-full animate-bounce" style={{ animationDuration: '3s' }} />
        <div className="absolute bottom-1/3 left-24 w-2 h-2 bg-tertiary/40 rounded-full animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }} />

        <div className="relative z-10 max-w-md text-center space-y-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-container flex items-center justify-center border border-white/10 shadow-xl shadow-primary/20">
              <span className="material-symbols-outlined text-on-primary-container text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
          </div>

          <div>
            <h1 className="text-4xl font-bold text-on-surface tracking-tight mb-3">
              Scan<span className="text-primary">Genie</span>
            </h1>
            <p className="text-base text-on-surface-variant leading-relaxed max-w-sm mx-auto">
              Intelligent document analysis powered by <span className="text-primary font-semibold">RAG</span> and <span className="text-secondary font-semibold">Gemini AI</span>. Upload, query, and discover insights from your documents.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            {[
              { icon: 'upload_file', label: 'PDF & DOCX Upload', color: 'primary' },
              { icon: 'psychology', label: 'AI-Powered Q&A', color: 'secondary' },
              { icon: 'hub', label: 'Vector Embeddings', color: 'tertiary' },
              { icon: 'format_quote', label: 'Source Citations', color: 'primary' },
            ].map((feat, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1b1b1f]/60 border border-white/5 text-[11px] text-on-surface-variant font-medium"
              >
                <span className={`material-symbols-outlined text-sm text-${feat.color}`}>{feat.icon}</span>
                {feat.label}
              </div>
            ))}
          </div>

          {/* Trust badge */}
          <div className="flex items-center justify-center gap-2 text-[10px] text-on-surface-variant/40 uppercase tracking-widest font-bold pt-4">
            <span className="material-symbols-outlined text-sm text-primary/50">verified</span>
            Powered by Gemini 2.5 Flash &bull; Supabase Vector Store
          </div>
        </div>
      </div>

      {/* ──── Right: Auth Form ──── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-[420px]">

          {/* Mobile logo (hidden on desktop) */}
          <div className="flex lg:hidden items-center justify-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center border border-white/10 shadow-lg">
              <span className="material-symbols-outlined text-on-primary-container text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">
              Scan<span className="text-primary">Genie</span>
            </h1>
          </div>

          {/* Glass card form */}
          <div className="glass-card rounded-3xl p-7 sm:p-8 space-y-6 shadow-2xl">
            
            {/* Header */}
            <div className="text-center space-y-1.5">
              <h2 className="text-lg font-bold text-on-surface">
                {isSignUp ? 'Create Your Account' : 'Welcome Back'}
              </h2>
              <p className="text-xs text-on-surface-variant">
                {isSignUp
                  ? 'Sign up to save your documents and chat history.'
                  : 'Sign in to access your documents and conversations.'}
              </p>
            </div>

            {/* Error / Success alerts */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-error-container/15 border border-error/20 text-error text-xs leading-relaxed animate-in slide-in-from-top-2 duration-200">
                <span className="material-symbols-outlined text-sm mt-0.5 shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs leading-relaxed animate-in slide-in-from-top-2 duration-200">
                <span className="material-symbols-outlined text-sm mt-0.5 shrink-0">check_circle</span>
                <span>{success}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name field (Shown on Sign Up) */}
              {isSignUp && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <label htmlFor="login-name" className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider flex items-center justify-between">
                    <span>What should we call you?</span>
                    <span className="text-primary text-xs">😊</span>
                  </label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg group-focus-within:text-primary transition-colors">sentiment_satisfied</span>
                    <input
                      id="login-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Gigi"
                      disabled={submitting}
                      autoComplete="name"
                      className="w-full pl-11 pr-4 py-3 bg-[#1b1b1f]/50 border border-white/8 focus:border-primary/40 rounded-xl text-sm text-on-surface placeholder-on-surface-variant/30 outline-none transition-all focus:shadow-[0_0_0_3px_rgba(208,188,255,0.08)] disabled:opacity-50"
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg group-focus-within:text-primary transition-colors">mail</span>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={submitting}
                    autoComplete="email"
                    className="w-full pl-11 pr-4 py-3 bg-[#1b1b1f]/50 border border-white/8 focus:border-primary/40 rounded-xl text-sm text-on-surface placeholder-on-surface-variant/30 outline-none transition-all focus:shadow-[0_0_0_3px_rgba(208,188,255,0.08)] disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="login-password" className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                  Password
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg group-focus-within:text-primary transition-colors">lock</span>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={submitting}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    className="w-full pl-11 pr-12 py-3 bg-[#1b1b1f]/50 border border-white/8 focus:border-primary/40 rounded-xl text-sm text-on-surface placeholder-on-surface-variant/30 outline-none transition-all focus:shadow-[0_0_0_3px_rgba(208,188,255,0.08)] disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={submitting || !email.trim() || !password.trim()}
                className="w-full py-3 bg-primary text-on-primary text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-primary/15 cursor-pointer disabled:opacity-40 disabled:pointer-events-none border border-white/10 mt-2"
              >
                {submitting ? (
                  <>
                    <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                    {isSignUp ? 'Creating Account...' : 'Signing In...'}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">{isSignUp ? 'person_add' : 'login'}</span>
                    {isSignUp ? 'Create Account' : 'Sign In'}
                  </>
                )}
              </button>
            </form>

            {/* Toggle Sign In / Sign Up */}
            <p className="text-center text-xs text-on-surface-variant">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                  setSuccess('');
                }}
                className="text-primary font-semibold hover:underline cursor-pointer"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-[10px] text-on-surface-variant/40 uppercase tracking-widest font-bold">or</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>

            {/* Continue as Guest */}
            <button
              onClick={handleGuestAccess}
              disabled={submitting}
              className="w-full py-3 bg-[#1b1b1f]/60 hover:bg-[#25252b]/70 border border-white/8 hover:border-primary/20 text-on-surface-variant hover:text-on-surface text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              <span className="material-symbols-outlined text-lg">person_outline</span>
              Continue as Guest
            </button>

            <p className="text-center text-[10px] text-on-surface-variant/30 leading-relaxed">
              Guest mode gives full access. Sign in to save your data across sessions.
            </p>
          </div>

          {/* Footer */}
          <p className="text-center mt-6 text-[9px] text-on-surface-variant/25 uppercase tracking-widest font-bold">
            ScanGenie v2.0 &bull; Advanced RAG Pipeline
          </p>
        </div>
      </div>
    </div>
  );
}
