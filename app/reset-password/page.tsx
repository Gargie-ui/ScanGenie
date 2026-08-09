'use client';

import React, { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!password.trim()) {
      setError('Please enter a new password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabaseBrowser.auth.updateUser({
        password: password.trim(),
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess('Your password has been updated successfully!');
        setTimeout(() => {
          router.replace('/');
        }, 2000);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0d] flex items-center justify-center px-6 py-12 relative overflow-hidden select-none">
      
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-primary/15 rounded-full blur-[150px]" />
        <div className="absolute -bottom-60 -right-40 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        <div className="glass-card rounded-3xl p-7 sm:p-8 space-y-6 shadow-2xl">
          
          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center border border-white/10 shadow-lg mx-auto mb-2">
              <span className="material-symbols-outlined text-on-primary-container text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>lock_reset</span>
            </div>
            <h2 className="text-lg font-bold text-on-surface">Set New Password</h2>
            <p className="text-xs text-on-surface-variant">
              Please enter your new password below to secure your account.
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-error-container/15 border border-error/20 text-error text-xs leading-relaxed">
              <span className="material-symbols-outlined text-sm mt-0.5 shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs leading-relaxed">
              <span className="material-symbols-outlined text-sm mt-0.5 shrink-0">check_circle</span>
              <span>{success} Redirecting to dashboard...</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div className="space-y-1.5">
              <label htmlFor="reset-new-password" className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                New Password
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg group-focus-within:text-primary transition-colors">lock</span>
                <input
                  id="reset-new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={submitting || !!success}
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

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label htmlFor="reset-confirm-password" className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                Confirm New Password
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg group-focus-within:text-primary transition-colors">lock_clock</span>
                <input
                  id="reset-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={submitting || !!success}
                  className="w-full pl-11 pr-4 py-3 bg-[#1b1b1f]/50 border border-white/8 focus:border-primary/40 rounded-xl text-sm text-on-surface placeholder-on-surface-variant/30 outline-none transition-all focus:shadow-[0_0_0_3px_rgba(208,188,255,0.08)] disabled:opacity-50"
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting || !password.trim() || !confirmPassword.trim() || !!success}
              className="w-full py-3 bg-primary text-on-primary text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-primary/15 cursor-pointer disabled:opacity-40 disabled:pointer-events-none border border-white/10 mt-2"
            >
              {submitting ? (
                <>
                  <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                  Updating Password...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  Update Password
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <Link href="/login" className="text-xs text-primary font-semibold hover:underline">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
