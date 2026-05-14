/**
 * Fast B Agent Portal — App Router
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, get } from 'firebase/database';
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
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await get(ref(db, `agents/${user.uid}`));
        if (snap.exists()) {
          setAgent({ uid: user.uid, ...snap.val() });
        } else {
          setAgent(null);
        }
      } else {
        setAgent(null);
      }
      setLoading(false);
    });
    return () => unsub();
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
      <Route path="/" element={<ProtectedRoute agent={agent}><DashboardPage agent={agent} setAgent={setAgent} /></ProtectedRoute>} />
      <Route path="/scan" element={<ProtectedRoute agent={agent}><ScannerPage agent={agent} setAgent={setAgent} /></ProtectedRoute>} />
      <Route path="/activate/:uid" element={<ProtectedRoute agent={agent}><ActivatePage agent={agent} setAgent={setAgent} /></ProtectedRoute>} />
      <Route path="/success" element={<ProtectedRoute agent={agent}><SuccessPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
