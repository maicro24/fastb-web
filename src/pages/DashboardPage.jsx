import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function DashboardPage({ agent }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-4 pt-12 pb-24 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Fast B</h1>
              <p className="text-teal-200 text-xs">Agent Portal</p>
            </div>
            <button onClick={handleLogout} className="text-teal-200 hover:text-white transition-colors p-2 cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
          <p className="text-teal-100">مرحباً، <span className="font-semibold text-white">{agent?.name || agent?.email || 'وكيل'}</span></p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-16 space-y-4 pb-8">
        {/* Wallet Card */}
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">رصيد المحفظة</p>
                <p className="text-xs text-gray-400">Wallet Balance</p>
              </div>
            </div>
            <div className="bg-teal-50 px-3 py-1 rounded-full">
              <span className="text-xs font-semibold text-teal-700">نقاط</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-gray-900">{agent?.wallet_balance ?? 0}</span>
            <span className="text-lg text-gray-400">pts</span>
          </div>
          <div className="mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, ((agent?.wallet_balance ?? 0) / 5000) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{agent?.total_activations ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">تفعيلات</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{agent?.status === 'active' ? 'نشط' : '—'}</p>
            <p className="text-xs text-gray-500 mt-1">الحالة</p>
          </div>
        </div>

        {/* Scan Button */}
        <button
          onClick={() => navigate('/scan')}
          className="w-full bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-2xl p-5 flex items-center justify-between shadow-lg shadow-teal-600/20 transition-all duration-200 group cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">مسح رمز QR</p>
              <p className="text-teal-200 text-sm">Scan passenger QR code</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-teal-200 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Pricing Reference */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">جدول الأسعار — Pricing</p>
          <div className="space-y-2">
            {[
              { label: '3 أشهر', price: '250 DA', cost: '200 pts', color: 'teal' },
              { label: '6 أشهر', price: '400 DA', cost: '350 pts', color: 'teal' },
              { label: '12 شهر', price: '550 DA', cost: '500 pts', color: 'orange' },
            ].map((t) => (
              <div key={t.label} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl">
                <span className="text-sm font-medium text-gray-700">{t.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-900">{t.price}</span>
                  <span className="text-xs text-gray-400">({t.cost})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
