import { useNavigate, useLocation } from 'react-router-dom';

export default function SuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const details = location.state || {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white flex items-center justify-center p-4">
      <div className="text-center max-w-sm w-full">
        {/* Animated Success Icon */}
        <div className="relative mb-8 inline-block">
          <svg className="w-28 h-28" viewBox="0 0 100 100">
            <circle
              className="success-circle"
              cx="50" cy="50" r="45"
              fill="none"
              stroke="#0D9488"
              strokeWidth="3"
            />
            <circle
              className="success-circle"
              cx="50" cy="50" r="40"
              fill="#0D9488"
              opacity="0.1"
              style={{ animationDelay: '0.1s' }}
            />
            <polyline
              className="success-check"
              points="30,52 44,65 70,38"
              fill="none"
              stroke="#0D9488"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">تم الشحن بنجاح!</h1>
        <p className="text-gray-500 mb-1">Recharge Successful</p>
        <p className="text-sm text-gray-400 mb-6">تم تفعيل اشتراك الراكب وخصم النقاط من رصيدك</p>

        {/* Details Card */}
        {(details.passengerName || details.plan) && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 mb-6 text-right">
            <div className="flex items-center justify-center gap-2 text-teal-600 mb-4">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
              <span className="font-semibold">تفاصيل العملية</span>
            </div>

            <div className="space-y-2 text-sm">
              {details.passengerName && (
                <div className="flex justify-between">
                  <span className="text-gray-400">الراكب</span>
                  <span className="font-semibold text-gray-900">{details.passengerName}</span>
                </div>
              )}
              {details.plan && (
                <div className="flex justify-between">
                  <span className="text-gray-400">الخطة</span>
                  <span className="font-semibold text-gray-900">{details.plan}</span>
                </div>
              )}
              {details.price && (
                <div className="flex justify-between">
                  <span className="text-gray-400">المبلغ</span>
                  <span className="font-bold text-teal-600">{details.price} DA</span>
                </div>
              )}
              {details.expirationDate && (
                <div className="flex justify-between">
                  <span className="text-gray-400">ينتهي في</span>
                  <span className="font-semibold text-gray-900">{details.expirationDate}</span>
                </div>
              )}
              {details.wasExtended && (
                <div className="bg-blue-50 rounded-lg px-3 py-2 mt-2 text-center">
                  <span className="text-xs text-blue-600 font-semibold">📌 تم تمديد الاشتراك الحالي (لم يبدأ من الصفر)</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => navigate('/scan')}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3.5 rounded-xl transition-colors shadow-md shadow-teal-600/20 cursor-pointer"
          >
            مسح رمز آخر — Scan Another
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3.5 rounded-xl transition-colors cursor-pointer"
          >
            العودة للرئيسية — Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
