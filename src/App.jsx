/**
 * Fast B Agent Portal — App Router
 *
 * Uses onValue (real-time listener) instead of get() to keep
 * the agent's wallet_balance and stats always in sync with Firebase.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { auth, db } from './firebase';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ScannerPage from './pages/ScannerPage';
import ActivatePage from './pages/ActivatePage';
import SuccessPage from './pages/SuccessPage';

function ProtectedRoute({ children, agent }) {
  if (!agent) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubData = null; // RTDB listener cleanup

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Clean up previous RTDB listener when auth state changes
      if (unsubData) {
        unsubData();
        unsubData = null;
      }

      if (user) {
        // ── Real-time listener on agent document ──────────
        // This replaces the old get() one-time fetch.
        // Any change to agents/{uid} (including wallet_balance)
        // will instantly update the UI.
        const agentRef = ref(db, `agents/${user.uid}`);
        unsubData = onValue(agentRef, (snap) => {
          if (snap.exists()) {
            setAgent({ uid: user.uid, ...snap.val() });
          } else {
            setAgent(null);
          }
          setLoading(false);
        }, (err) => {
          console.error('Agent listener error:', err);
          setAgent(null);
          setLoading(false);
        });
      } else {
        setAgent(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubData) unsubData();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal-600">
        <div className="text-center">
          <div className="text-4xl font-bold text-white mb-2">Fast B</div>
          <div className="text-teal-200 text-sm">Agent Portal</div>
          <div className="mt-6">
            <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={agent ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute agent={agent}><DashboardPage agent={agent} /></ProtectedRoute>} />
      <Route path="/scan" element={<ProtectedRoute agent={agent}><ScannerPage agent={agent} /></ProtectedRoute>} />
      <Route path="/activate/:uid" element={<ProtectedRoute agent={agent}><ActivatePage agent={agent} /></ProtectedRoute>} />
      <Route path="/success" element={<ProtectedRoute agent={agent}><SuccessPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
