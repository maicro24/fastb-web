import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { ref, get, update, runTransaction, push, serverTimestamp } from 'firebase/database';
import { db } from '../firebase';

// ── Pricing Plans ──
const PLANS = [
  { id: '3m', days: 90, label: '3 أشهر', labelEn: '3 Months', price: 250, cost: 200, icon: '📚' },
  { id: '6m', days: 180, label: '6 أشهر', labelEn: '6 Months', price: 400, cost: 350, icon: '⏱️', popular: true },
  { id: '12m', days: 365, label: '12 شهر', labelEn: '12 Months', price: 550, cost: 500, icon: '⭐', best: true },
];

// ── Audio/Haptic helpers ──
function playBeep(success = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = success ? 1200 : 400;
    osc.type = 'sine'; gain.gain.value = 0.3;
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  } catch {}
}
function vibrate() { try { navigator.vibrate?.(200); } catch {} }

// ── Extract UID from QR data (URL or raw) ──
function extractUID(raw) {
  const t = raw.trim();
  // URL format: https://...../activate/UID or https://...../UID
  try {
    const url = new URL(t);
    const parts = url.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && /^[a-zA-Z0-9]{10,128}$/.test(last)) return last;
  } catch {}
  // Raw UID string
  if (/^[a-zA-Z0-9]{10,128}$/.test(t)) return t;
  // Legacy JSON
  try { const d = JSON.parse(t); if (d.uid) return d.uid; } catch {}
  return null;
}

// ── Atomic Recharge Transaction ──
async function processRecharge(agentUid, userUid, plan) {
  const now = new Date();

  // 1. Read user
  const userSnap = await get(ref(db, `users/${userUid}`));
  if (!userSnap.exists()) throw new Error('Utilisateur introuvable');
  const userData = userSnap.val();

  // 2. Calculate subscription end date (append if active)
  const existingExp = userData?.subscription?.expirationTimestamp;
  const baseDate = (existingExp && existingExp > now.getTime()) ? new Date(existingExp) : now;
  const endDate = new Date(baseDate);
  endDate.setDate(endDate.getDate() + plan.days);

  // 3. Atomic deduct from agent wallet (the ONLY safe way)
  const txResult = await runTransaction(ref(db, `agents/${agentUid}/wallet_balance`), (bal) => {
    if (bal === null || bal < plan.cost) return; // abort
    return bal - plan.cost;
  });

  if (!txResult.committed) {
    throw new Error('رصيدك غير كافٍ — Insufficient balance');
  }

  // 4. Update user subscription
  await update(ref(db, `users/${userUid}`), {
    isPro: true,
    'subscription/isPaid': true,
    'subscription/subscriptionStartDate': now.toISOString(),
    'subscription/subscriptionEndDate': endDate.toISOString(),
    'subscription/expirationDate': endDate.toISOString(),
    'subscription/expirationTimestamp': endDate.getTime(),
    'subscription/tierDays': plan.days,
    'subscription/amountPaid': plan.price,
    'subscription/rechargeAmount': plan.price,
    'subscription/lastRechargeDate': now.toISOString(),
    'subscription/paymentMethod': 'agent',
    'subscription/agentId': agentUid,
    'subscription/lastRechargeBy': agentUid,
    'subscription/paidAt': now.toISOString(),
  });

  // 5. Update agent stats (atomic)
  await runTransaction(ref(db, `agents/${agentUid}/total_activations`), (current) => {
    return (current || 0) + 1;
  });

  // 6. Log transaction
  await push(ref(db, 'transactions'), {
    agentId: agentUid,
    userId: userUid,
    amount: plan.cost,
    price: plan.price,
    planId: plan.id,
    days: plan.days,
    date: now.toISOString(),
    timestamp: now.getTime(),
  });

  // Read the actual new balance from the committed transaction
  const newBalance = txResult.snapshot.val();

  return {
    userEmail: userData?.email || userData?.phone || 'N/A',
    userName: userData?.displayName || 'مستخدم',
    endDate: endDate.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' }),
    wasExtended: existingExp && existingExp > now.getTime(),
    newBalance: newBalance,
  };
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function ScannerPage({ agent }) {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const hasScanned = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUid, setModalUid] = useState('');
  const [passenger, setPassenger] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg }
  const [result, setResult] = useState(null);

  // ── Show toast helper ──
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Open recharge modal ──
  const openModal = useCallback(async (uid) => {
    setModalUid(uid);
    setModalOpen(true);
    setSelectedPlan(null);
    setResult(null);
    setPassenger(null);
    try {
      const snap = await get(ref(db, `users/${uid}`));
      if (snap.exists()) {
        setPassenger(snap.val());
      } else {
        showToast('error', 'Code QR invalide ou utilisateur inconnu');
        setModalOpen(false);
      }
    } catch {
      showToast('error', 'Erreur de connexion');
      setModalOpen(false);
    }
  }, []);

  // ── Handle scan result ──
  const handleScan = useCallback((decoded) => {
    if (hasScanned.current) return;
    const uid = extractUID(decoded);
    if (uid) {
      hasScanned.current = true;
      playBeep(true);
      vibrate();
      // Pause scanner but DON'T navigate
      scannerRef.current?.stop().catch(() => {});
      setScanning(false);
      openModal(uid);
    }
  }, [openModal]);

  // ── Process recharge ──
  const handleRecharge = async () => {
    if (!selectedPlan || !modalUid || processing) return;
    setProcessing(true);
    try {
      const res = await processRecharge(agent.uid, modalUid, selectedPlan);
      playBeep(true);
      vibrate();
      setResult(res);
      // NO manual setAgent() — the real-time onValue listener
      // in App.jsx auto-updates agent state from Firebase.
      showToast('success', 'Recharge réussie, solde déduit ✓');
    } catch (err) {
      playBeep(false);
      showToast('error', err.message || 'Échec de la recharge');
    } finally {
      setProcessing(false);
    }
  };

  // ── Close modal & restart scanner ──
  const closeModal = () => {
    setModalOpen(false);
    setModalUid('');
    setPassenger(null);
    setSelectedPlan(null);
    setResult(null);
    hasScanned.current = false;
    // Restart scanner
    startScanner();
  };

  // ── Scanner init ──
  const startScanner = useCallback(async () => {
    let retries = 0;
    const tryStart = async () => {
      try {
        const qr = new Html5Qrcode('qr-reader');
        scannerRef.current = qr;
        await qr.start(
          { facingMode: 'environment' },
          { fps: 30, qrbox: { width: 280, height: 280 }, aspectRatio: 1.0 },
          handleScan,
          () => {}
        );
        setScanning(true);
      } catch {
        if (retries++ < 3) setTimeout(tryStart, 1000);
        else setError('تعذر الوصول للكاميرا');
      }
    };
    tryStart();
  }, [handleScan]);

  useEffect(() => {
    startScanner();
    return () => { scannerRef.current?.stop().catch(() => {}); };
  }, [startScanner]);

  // ── Subscription status ──
  const existingExp = passenger?.subscription?.expirationTimestamp;
  const isActive = existingExp && existingExp > Date.now();

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col relative">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-sm font-semibold animate-bounce ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="px-4 pt-12 pb-4 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="text-white/70 hover:text-white p-2 cursor-pointer">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-white">مسح رمز QR</h1>
        <div className="text-xs text-teal-300 font-bold">{agent?.wallet_balance ?? 0} pts</div>
      </div>

      {/* Scanner */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="relative w-full max-w-sm">
          <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border border-gray-700 relative">
            <div id="qr-reader" className="w-full"></div>
            {scanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[280px] h-[280px] relative">
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-3 border-l-3 border-teal-400 rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-3 border-r-3 border-teal-400 rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-3 border-l-3 border-teal-400 rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-3 border-r-3 border-teal-400 rounded-br-lg"></div>
                  <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent scan-line"></div>
                </div>
              </div>
            )}
          </div>
          {scanning && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
              <div className="bg-teal-500/90 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="text-white text-sm font-medium">جاري المسح...</span>
              </div>
            </div>
          )}
        </div>
        <p className="text-gray-400 text-xs mt-8">وجّه الكاميرا نحو رمز QR الخاص بالراكب</p>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>

      {/* Bottom */}
      <div className="px-4 pb-8">
        <button onClick={() => navigate('/')} className="w-full border border-gray-600 text-gray-300 hover:text-white py-3 rounded-xl transition-colors cursor-pointer">
          إلغاء — Cancel
        </button>
      </div>

      {/* ═══ RECHARGE MODAL ═══ */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center p-4" onClick={() => !processing && closeModal()}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            {/* ── Success Result ── */}
            {result ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">تم الشحن بنجاح!</h2>
                <p className="text-sm text-gray-500 mb-4">Recharge réussie</p>
                <div className="bg-gray-50 rounded-xl p-4 text-right text-sm space-y-2 mb-6">
                  <div className="flex justify-between"><span className="text-gray-400">الراكب</span><span className="font-semibold">{result.userName}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">ينتهي في</span><span className="font-semibold">{result.endDate}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">رصيدك الجديد</span><span className="font-bold text-teal-600">{result.newBalance} pts</span></div>
                  {result.wasExtended && <p className="text-xs text-blue-500 text-center mt-1">📌 تم تمديد الاشتراك الحالي</p>}
                </div>
                <button onClick={closeModal} className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl cursor-pointer">
                  مسح رمز آخر
                </button>
              </div>
            ) : (
              /* ── Recharge Form ── */
              <div className="p-6">
                {/* Modal header */}
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-gray-900">شحن الاشتراك</h2>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">✕</button>
                </div>

                {/* Passenger info */}
                {!passenger ? (
                  <div className="flex justify-center py-8"><div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div></div>
                ) : (
                  <>
                    <div className="bg-gray-50 rounded-xl p-4 mb-4 flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-bold text-lg">
                        {(passenger.displayName || 'U')[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{passenger.displayName || 'مستخدم'}</p>
                        <p className="text-xs text-gray-500 truncate">{passenger.email || passenger.phone || ''}</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                        {isActive ? 'فعّال' : 'غير فعّال'}
                      </span>
                    </div>

                    {isActive && (
                      <div className="bg-blue-50 rounded-lg px-3 py-2 mb-4 text-xs text-blue-600 text-center">
                        ℹ️ اشتراك فعّال — سيتم تمديد المدة
                      </div>
                    )}

                    {/* Plans */}
                    <p className="text-sm font-semibold text-gray-700 mb-2">اختر الخطة</p>
                    <div className="space-y-2 mb-4">
                      {PLANS.map(p => {
                        const sel = selectedPlan?.id === p.id;
                        const afford = (agent?.wallet_balance ?? 0) >= p.cost;
                        return (
                          <button key={p.id} disabled={!afford} onClick={() => afford && setSelectedPlan(p)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-right transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              sel ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300'
                            }`}>
                            <span className="text-xl">{p.icon}</span>
                            <div className="flex-1">
                              <p className="font-bold text-gray-900 text-sm">{p.label}</p>
                              <p className="text-xs text-gray-400">{p.labelEn}</p>
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-gray-900">{p.price} DA</p>
                              <p className="text-xs text-gray-400">−{p.cost} pts</p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${sel ? 'border-teal-500' : 'border-gray-300'}`}>
                              {sel && <div className="w-2.5 h-2.5 rounded-full bg-teal-500"></div>}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Agent balance */}
                    <div className="flex justify-between bg-gray-100 rounded-xl px-4 py-2 mb-4 text-sm">
                      <span className="text-gray-500">رصيدك</span>
                      <span className="font-bold text-gray-900">{agent?.wallet_balance ?? 0} pts</span>
                    </div>

                    {/* Recharge button */}
                    <button onClick={handleRecharge} disabled={!selectedPlan || processing}
                      className="w-full bg-gradient-to-r from-teal-600 to-teal-500 disabled:from-gray-300 disabled:to-gray-300 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all cursor-pointer disabled:cursor-not-allowed">
                      {processing ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          جاري الشحن...
                        </span>
                      ) : selectedPlan ? `شحن ${selectedPlan.label} — ${selectedPlan.price} DA` : 'اختر خطة'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes scanLine { 0%{top:8px} 50%{top:calc(100% - 8px)} 100%{top:8px} }
        .scan-line { animation: scanLine 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
