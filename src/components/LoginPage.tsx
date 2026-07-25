import React, { useState } from 'react';
import { User, StoreSettings } from '../types';
import { Wrench, Lock, User as UserIcon, LogIn, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  settings: StoreSettings;
  users: User[];
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  settings,
  users,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setError('Please enter your username.');
      return;
    }

    if (!password) {
      setError('Please enter your password / PIN.');
      return;
    }

    // Match user by username
    const foundUser = users.find(
      (u) => u.username.trim().toLowerCase() === cleanUsername
    );

    if (!foundUser) {
      setError('Invalid username or password.');
      return;
    }

    if (!foundUser.active) {
      setError('This user account is deactivated.');
      return;
    }

    // Verify PIN / Password
    if (foundUser.pin && foundUser.pin !== password) {
      setError('Invalid username or password.');
      return;
    }

    onLoginSuccess(foundUser);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-xl shadow-blue-600/30 overflow-hidden">
            {settings.storeLogo ? (
              <img
                src={settings.storeLogo}
                alt={settings.storeName}
                className="w-full h-full object-cover"
              />
            ) : (
              <Wrench className="w-8 h-8 stroke-[2.5]" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {settings.storeName}
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Sign in to access POS & Inventory Management
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-2xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-blue-400" />
              <span>Username</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoFocus
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-white text-sm font-semibold placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-400" />
              <span>Password / PIN</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-white text-sm font-semibold placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <LogIn className="w-4 h-4" />
            <span>Log In</span>
          </button>
        </form>
      </div>
    </div>
  );
};
