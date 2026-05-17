import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, get, update, runTransaction } from 'firebase/database';
import { db } from '../firebase';

// ── New Pricing (matching mobile app + 50 DA agent profit) ──
const PLANS = [
  { id: 'tier_3m',  days: 90,  months: 3,  label: '3 أشهر',  labelEn: '3 Months',  price: 200, cost: 200, icon: '📚', badge: null },
  { id: 'tier_6m',  days: 180, months: 6,  label: '6 أشهر',  labelEn: '6 Months',  price: 350, cost: 350, icon: '⏱️', badge: '💎 الأكثر شعبية' },
  { id: 'tier_12m', days: 365, months: 12, label: '12 شهر',  labelEn: '12 Months', price: 600, cost: 600, icon: '⭐', badge: '🔥 أفضل سعر', isBest: true },
];

export default function ActivatePage({ agent }) {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [passenger, setPassenger] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');

  // ── Step A: Validate UID & Fetch Passenger ──
  useEffect(() => {
    const fetchPassenger = async () => {
      try {
        const snap = await get(ref(db, `users/${uid}`));
        if (snap.exists()) {
          setPassenger(snap.val());
        } else {
          setError('Utilisateur introuvable — المستخدم غير موجود');
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setError('خطأ في تحميل البيانات — Data load error');
      } finally {
        setLoading(false);
      }
    };
    fetchPassenger();
  }, [uid]);

  // ── Smart Recharge Handler ──
  const handleRecharge = async () => {
    if (!selectedPlan) return;
    if ((agent?.wallet_balance ?? 0) < selectedPlan.cost) {
      setError('رصيدك غير كافٍ — Insufficient balance');
      return;
    }

    setActivating(true);
    setError('');

    try {
      // ── Step B: Smart Date Calculation ──
      const now = new Date();
      let startDate;

      // Check if there's an existing active subscription
      const existingExpTs = passenger?.subscription?.expirationTimestamp;
      if (existingExpTs && existingExpTs > now.getTime()) {
        // Subscription still active → APPEND days to existing end date
        startDate = new Date(existingExpTs);
      } else {
        // Expired or no subscription → start from TODAY
        startDate = now;
      }

      const expirationDate = new Date(startDate);
      expirationDate.setDate(expirationDate.getDate() + selectedPlan.days);

      // ── Deduct points from agent (atomic transaction) ──
      // runTransaction on the wallet_balance field ensures atomicity.
      // If the balance is insufficient at the moment of write, we abort.
      const agentBalanceRef = ref(db, `agents/${agent.uid}/wallet_balance`);
      const txResult = await runTransaction(agentBalanceRef, (currentBalance) => {
        if (currentBalance === null || currentBalance < selectedPlan.cost) {
          return; // Abort — insufficient funds
        }
        return currentBalance - selectedPlan.cost;
      });

      // Check if transaction was aborted (insufficient funds at DB level)
      if (!txResult.committed) {
        setError('رصيدك غير كافٍ — Insufficient balance (verified)');
        setActivating(false);
        return;
      }

      // ── Step C: Update user subscription in RTDB ──
      await update(ref(db, `users/${uid}`), {
        isPro: true,
        'subscription/isPaid': true,
        'subscription/subscriptionStartDate': now.toISOString(),
        'subscription/subscriptionEndDate': expirationDate.toISOString(),
        'subscription/expirationDate': expirationDate.toISOString(),
        'subscription/expirationTimestamp': expirationDate.getTime(),
        'subscription/tierDays': selectedPlan.days,
        'subscription/amountPaid': selectedPlan.price,
        'subscription/rechargeAmount': selectedPlan.price,
        'subscription/lastRechargeDate': now.toISOString(),
        'subscription/paymentMethod': 'agent',
        'subscription/agentId': agent.uid,
        'subscription/lastRechargeBy': agent.uid,
        'subscription/paidAt': now.toISOString(),
      });

      // ── Update agent activation count (atomic) ──
      const agentCountRef = ref(db, `agents/${agent.uid}/total_activations`);
      await runTransaction(agentCountRef, (current) => {
        return (current || 0) + 1;
      });

      // ── NO manual setAgent() here ──
      // The real-time onValue listener in App.jsx will automatically
      // detect the wallet_balance and total_activations changes in
      // Firebase and update the agent state. This is the ONLY source
      // of truth — no local state desyncs possible.

      // Navigate to success with details
      navigate('/success', {
        state: {
          passengerName: passenger?.displayName || 'مستخدم',
          plan: selectedPlan.label,
          price: selectedPlan.price,
          expirationDate: expirationDate.toLocaleDateString('ar-DZ', {
            year: 'numeric', month: 'long', day: 'numeric',
          }),
          wasExtended: existingExpTs && existingExpTs > now.getTime(),
        },
      });
    } catch (err) {
      console.error('Recharge error:', err);
      setError(`فشل التفعيل — ${err.message || 'Activation failed. Try again.'}`);
    } finally {
      setActivating(false);
    }
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // ── Current subscription status ──
  const existingExp = passenger?.subscription?.expirationTimestamp;
  const isCurrentlyActive = existingExp && existingExp > Date.now();
  const existingExpDate = existingExp
    ? new Date(existingExp).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">شحن الاشتراك</h1>
            <p className="text-xs text-gray-500">Recharge Subscription</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Passenger Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-teal-50 flex items-center justify-center">
              <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{passenger?.displayName || 'مستخدم'}</p>
              <p className="text-sm text-gray-500 truncate">{passenger?.email || passenger?.phone || ''}</p>
            </div>
            <div className="bg-green-50 px-3 py-1 rounded-full">
              <span className="text-xs font-semibold text-green-600">تم المسح ✓</span>
            </div>
          </div>

          {/* Current subscription status */}
          {isCurrentlyActive && (
            <div className="mt-3 bg-blue-50 rounded-xl px-4 py-2 flex items-center gap-2">
              <span className="text-blue-500">ℹ️</span>
              <span className="text-xs text-blue-700">
                اشتراك فعّال حتى {existingExpDate} — سيتم تمديد المدة
              </span>
            </div>
          )}
        </div>

        {/* Plan Selection */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">اختر الخطة — Choose Plan</p>
          <div className="space-y-3">
            {PLANS.map((plan) => {
              const isSelected = selectedPlan?.id === plan.id;
              const canAfford = (agent?.wallet_balance ?? 0) >= plan.cost;
              return (
                <button
                  key={plan.id}
                  onClick={() => canAfford && setSelectedPlan(plan)}
                  disabled={!canAfford}
                  className={`w-full text-right rounded-2xl p-4 transition-all duration-200 relative overflow-hidden cursor-pointer ${
                    plan.isBest
                      ? isSelected
                        ? 'border-2 border-yellow-400 bg-yellow-50 shadow-md shadow-yellow-100 ring-2 ring-yellow-300'
                        : canAfford
                        ? 'border-2 border-yellow-300 bg-white hover:border-yellow-400 hover:shadow-sm'
                        : 'border-2 border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      : isSelected
                      ? 'border-2 border-teal-500 bg-teal-50 shadow-md shadow-teal-100'
                      : canAfford
                      ? 'border-2 border-gray-200 bg-white hover:border-teal-300 hover:shadow-sm'
                      : 'border-2 border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  {plan.badge && (
                    <span className={`absolute top-2 left-2 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      plan.isBest ? 'bg-yellow-500' : 'bg-orange-500'
                    }`}>
                      {plan.badge}
                    </span>
                  )}
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{plan.icon}</span>
                    <div className="flex-1">
                      <p className={`font-bold ${plan.isBest ? 'text-yellow-700' : 'text-gray-900'}`}>{plan.label}</p>
                      <p className="text-xs text-gray-500">{plan.labelEn}</p>
                    </div>
                    <div className="text-left">
                      <p className={`text-lg font-bold ${plan.isBest ? 'text-yellow-600' : 'text-gray-900'}`}>
                        {plan.price} DA
                      </p>
                      <p className="text-xs text-gray-400">−{plan.cost} pts</p>
                    </div>
                    {/* Radio */}
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isSelected
                        ? plan.isBest ? 'border-yellow-500' : 'border-teal-500'
                        : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        <div className={`w-3 h-3 rounded-full ${plan.isBest ? 'bg-yellow-500' : 'bg-teal-500'}`}></div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Balance reminder */}
        <div className="flex items-center justify-between bg-gray-100 rounded-xl px-4 py-3">
          <span className="text-sm text-gray-600">رصيدك الحالي</span>
          <span className="font-bold text-gray-900">{agent?.wallet_balance ?? 0} pts</span>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl text-center">{error}</div>
        )}

        {/* Recharge Button */}
        <button
          onClick={handleRecharge}
          disabled={!selectedPlan || activating}
          className={`w-full font-bold py-4 rounded-2xl shadow-lg transition-all duration-200 cursor-pointer disabled:cursor-not-allowed ${
            selectedPlan?.isBest
              ? 'bg-gradient-to-r from-yellow-500 to-yellow-400 text-yellow-900 shadow-yellow-500/20 disabled:from-gray-300 disabled:to-gray-300 disabled:text-white disabled:shadow-none'
              : 'bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-teal-600/20 disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none'
          }`}
        >
          {activating ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>جاري الشحن...</span>
            </div>
          ) : selectedPlan ? (
            `شحن ${selectedPlan.label} — ${selectedPlan.price} DA`
          ) : (
            'اختر خطة أولاً'
          )}
        </button>
      </div>
    </div>
  );
}
