'use client';

import React, { useState, useMemo } from 'react';
import {
  Printer,
  Copy,
  MapPin,
  Phone,
  Truck,
  ExternalLink,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Search,
  Store,
  Layers,
  AlertTriangle,
  ClipboardList,
  Check,
  Building2,
  Sparkles,
} from 'lucide-react';
import { filsToDisplay } from '@/lib/money';
import {
  confirmBatchPickupFromManifestAction,
  confirmOrderDeliveryFromManifestAction,
  confirmSingleOrderPickupFromManifestAction,
  confirmAllOrdersDeliveryFromManifestAction,
} from '@/actions/delivery-batch';

interface Props {
  batch: {
    reference: string;
    secureToken?: string;
    createdAt: Date | string;
    status: string;
  };
  metrics: {
    ordersCount: number;
    uniqueShopsCount: number;
    ordersForPickupCount: number;
    totalCodFils: number;
  };
  pickupStops: Array<{
    shopKey: string;
    supplierName: string;
    locationLabel: string;
    contactPerson: string;
    contactPhone: string;
    address: string;
    city: string;
    googleMapsUrl: string;
    pickupInstructions?: string | null;
    orders: Array<{
      orderReference: string;
      customerName: string;
      customerPhone?: string;
      city?: string;
      orderId?: string;
      fulfillmentOrderId?: string;
      isPickedUp?: boolean;
      items: Array<{
        name: string;
        variantTitle?: string | null;
        quantity: number;
      }>;
    }>;
  }>;
  dropoffStops: Array<{
    orderId: string;
    orderReference: string;
    customerName: string;
    customerPhone: string;
    city: string;
    address: string;
    googleMapsUrl: string;
    codAmountFils: number;
    isPaid: boolean;
    status: string;
    fulfillmentStatus?: string | null;
    isDelivered?: boolean;
    deliveredAt?: string | null;
    suppliers: string[];
    isMultiStore: boolean;
    totalItemsCount: number;
    items: Array<{
      name: string;
      variantTitle?: string | null;
      quantity: number;
      supplierName: string;
    }>;
  }>;
  formattedWhatsAppText: string;
}

export default function DeliveryManifestClient({
  batch,
  metrics,
  pickupStops,
  dropoffStops,
  formattedWhatsAppText,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PICKUP' | 'DROPOFF' | 'MATRIX'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState<'ALL' | 'PENDING' | 'DELIVERED'>('ALL');

  const [localBatchStatus, setLocalBatchStatus] = useState(batch.status);
  const [isConfirmingPickup, setIsConfirmingPickup] = useState(false);

  // حالة استلام طلبات المحلات
  const [localPickedUpOrders, setLocalPickedUpOrders] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const stop of pickupStops) {
      for (const p of stop.orders) {
        if (p.isPickedUp) {
          const key = p.fulfillmentOrderId || p.orderId;
          if (key) initial[key] = true;
        }
      }
    }
    return initial;
  });

  const [isConfirmingSinglePickup, setIsConfirmingSinglePickup] = useState<Record<string, boolean>>({});
  const [isConfirmingAllDeliveries, setIsConfirmingAllDeliveries] = useState(false);

  // حالة تسليم الطلبات للزبائن
  const [localDeliveredOrders, setLocalDeliveredOrders] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const d of dropoffStops) {
      if (d.isDelivered || d.status === 'DELIVERED') {
        initial[d.orderId] = true;
      }
    }
    return initial;
  });

  const [isConfirmingDelivery, setIsConfirmingDelivery] = useState<Record<string, boolean>>({});

  // فحص يدوي لعناصر الطلب من قِبل السائق لمنع الخلط
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const toggleItemCheck = (orderId: string, itemIdx: number) => {
    const key = `${orderId}-${itemIdx}`;
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyWhatsApp = () => {
    navigator.clipboard.writeText(formattedWhatsAppText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // تأكيد استلام طلب عميل فردي من المحل
  const handleConfirmSingleOrderPickup = async (
    orderId: string,
    orderRef: string,
    fulfillmentOrderId?: string
  ) => {
    const customerName =
      pickupStops.flatMap((stop) => stop.orders).find((order) => order.orderId === orderId)?.customerName || 'العميل';
    if (!confirm(`هل استلمت طلب #${orderRef} الخاص بالزبونة (${customerName}) من المحل؟`)) {
      return;
    }

    const confirmKey = fulfillmentOrderId || orderId;
    try {
      setIsConfirmingSinglePickup((prev) => ({ ...prev, [confirmKey]: true }));
      const res = await confirmSingleOrderPickupFromManifestAction(
        batch.reference,
        orderId,
        fulfillmentOrderId,
        batch.secureToken
      );
      if (res.success) {
        setLocalPickedUpOrders((prev) => ({
          ...prev,
          [confirmKey]: true,
        }));
        alert(`تم تأكيد استلام طلب #${orderRef} بنجاح! ✓`);
      } else {
        alert(res.error || 'تعذر تأكيد استلام هذا الطلب.');
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تأكيد استلام الطلب');
    } finally {
      setIsConfirmingSinglePickup((prev) => ({ ...prev, [confirmKey]: false }));
    }
  };

  // تأكيد استلام كافة الطلبات من المحلات وبدء رحلة التوصيل
  const handleConfirmPickup = async () => {
    if (
      !confirm(
        'هل قمت باستلام كافة الطلبات وتفقدها من المحلات بنجاح وتريد تأكيد بدء مسار التوصيل للزبائن؟'
      )
    ) {
      return;
    }

    try {
      setIsConfirmingPickup(true);
      const res = await confirmBatchPickupFromManifestAction(batch.reference, batch.secureToken);
      if (res.success) {
        setLocalBatchStatus('IN_DELIVERY');
        setLocalPickedUpOrders((prev) => {
          const updated = { ...prev };
          for (const stop of pickupStops) {
            for (const p of stop.orders) {
              const key = p.fulfillmentOrderId || p.orderId;
              if (key) updated[key] = true;
            }
          }
          return updated;
        });
        alert('تم تأكيد الاستلام بنجاح! تم تحديث حالة الإرسالية إلى (جارٍ التوصيل للزبائن). 🚚');
      } else {
        alert(res.error || 'تعذر تأكيد الاستلام.');
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setIsConfirmingPickup(false);
    }
  };

  // تأكيد تسليم طلب لعميل
  const handleConfirmOrderDelivery = async (
    orderId: string,
    orderRef: string,
    customerName: string,
    codAmount: number,
    isPaid: boolean
  ) => {
    const confirmPrompt = isPaid
      ? `هل تم تسليم طلب #${orderRef} للزبونة (${customerName}) بنجاح؟\n(الطلب مدفوع مسبقاً: 0 د.أ)`
      : `هل تم تسليم طلب #${orderRef} للزبونة (${customerName}) وتحصيل مبلغ (${filsToDisplay(codAmount)}) نقداً؟`;

    if (!confirm(confirmPrompt)) {
      return;
    }

    try {
      setIsConfirmingDelivery((prev) => ({ ...prev, [orderId]: true }));
      const res = await confirmOrderDeliveryFromManifestAction(
        batch.reference,
        orderId,
        undefined,
        batch.secureToken
      );
      if (res.success) {
        setLocalDeliveredOrders((prev) => ({ ...prev, [orderId]: true }));
        alert(`تم تأكيد تسليم طلب #${orderRef} للزبونة (${customerName}) بنجاح! ✓`);
      } else {
        alert(res.error || 'تعذر تأكيد التسليم.');
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تأكيد التسليم');
    } finally {
      setIsConfirmingDelivery((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  // تسليم جماعي لكافة الطلبات
  const handleConfirmAllDeliveries = async () => {
    const undelivered = dropoffStops.filter((d) => !localDeliveredOrders[d.orderId]);
    if (undelivered.length === 0) {
      alert('كافة الطلبات مسلّمة بالفعل.');
      return;
    }

    const totalRemainingCod = undelivered
      .filter((d) => !d.isPaid)
      .reduce((sum, d) => sum + d.codAmountFils, 0);

    const msg = `هل أنت متأكد من تأكيد تسليم كافة الطلبات المتبقية (${undelivered.length} طلب) وتحصيل مبلغ إجمالي قدره (${filsToDisplay(totalRemainingCod)}) نقداً؟`;

    if (!confirm(msg)) {
      return;
    }

    try {
      setIsConfirmingAllDeliveries(true);
      const res = await confirmAllOrdersDeliveryFromManifestAction(
        batch.reference,
        batch.secureToken
      );
      if (res.success) {
        setLocalDeliveredOrders((prev) => {
          const updated = { ...prev };
          for (const d of dropoffStops) {
            updated[d.orderId] = true;
          }
          return updated;
        });
        setLocalBatchStatus('COMPLETED');
        alert(`تم بنجاح تأكيد تسليم كافة طلبات الإرسالية (${res.deliveredCount} طلب) وإتمام الكشف بالكامل! ✓`);
      } else {
        alert(res.error || 'تعذر تأكيد تسليم جميع الطلبات.');
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setIsConfirmingAllDeliveries(false);
    }
  };

  const formattedDate = new Date(batch.createdAt).toLocaleDateString('ar-JO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // تصفية محطات التسليم بحسب البحث والحالة
  const filteredDropoffs = useMemo(() => {
    return dropoffStops.filter((d) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        d.customerName.toLowerCase().includes(q) ||
        d.orderReference.toLowerCase().includes(q) ||
        d.customerPhone.includes(q) ||
        d.city.toLowerCase().includes(q) ||
        d.address.toLowerCase().includes(q) ||
        d.items.some((it) => it.name.toLowerCase().includes(q));

      const isDelivered = Boolean(localDeliveredOrders[d.orderId]);
      if (deliveryFilter === 'PENDING') return matchesSearch && !isDelivered;
      if (deliveryFilter === 'DELIVERED') return matchesSearch && isDelivered;
      return matchesSearch;
    });
  }, [dropoffStops, searchQuery, deliveryFilter, localDeliveredOrders]);

  const deliveredCount = dropoffStops.filter((d) => localDeliveredOrders[d.orderId]).length;
  const pendingCount = dropoffStops.length - deliveredCount;

  return (
    <div className="min-h-screen bg-stone-100/70 py-4 sm:py-8 px-3 sm:px-6 font-sans text-stone-900" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">

        {/* Top Control Bar */}
        <header className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl shadow-xs border border-stone-200 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#2d3623] text-amber-300 flex items-center justify-center shrink-0 shadow-xs">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
                  كشف مسار التوصيل الميداني
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                  معتمد لشركة التوصيل
                </span>
              </div>
              <p className="text-xs text-stone-500 font-mono">
                {batch.reference} • منصة رَواق
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyWhatsApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white transition shadow-xs cursor-pointer active:scale-95"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'تم النسخ!' : 'نسخ كشف واتساب'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 transition cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة الكشف</span>
            </button>
          </div>
        </header>

        {/* Main Batch Manifest Card */}
        <div className="bg-white rounded-3xl shadow-xs border border-stone-200 overflow-hidden print:shadow-none print:border-none print:m-0">
          
          {/* Header Banner */}
          <div className="bg-[#2d3623] text-white p-6 sm:p-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl font-black tracking-tight text-white">رَواق</span>
                <span className="text-[11px] font-bold text-amber-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                  إرسالية التوصيل المجمّعة
                </span>
              </div>
              <p className="text-xs text-stone-300 mt-1.5 leading-relaxed max-w-md">
                استلام طلبات الزبائن من المحلات وتوصيلها بدقة بالاعتماد على رقم الطلب واسم الزبونة ومحتويات الطلب.
              </p>
            </div>

            <div className="text-left font-mono">
              <span className="text-[11px] text-stone-300 block">رقم الإرسالية</span>
              <span className="text-xl font-black text-amber-300">{batch.reference}</span>
              <span className="text-[11px] text-stone-300 block mt-0.5">{formattedDate}</span>
            </div>
          </div>

          {/* 4-Metric Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-stone-200 border-b border-stone-200 bg-stone-50/50 text-center">
            <div className="p-4">
              <span className="text-xs text-stone-500 font-medium block mb-1">إجمالي طلبات الزبائن</span>
              <span className="text-xl font-black text-stone-900">{metrics.ordersCount} طلبات</span>
            </div>
            <div className="p-4">
              <span className="text-xs text-stone-500 font-medium block mb-1">محطات الاستلام (المحلات)</span>
              <span className="text-xl font-black text-stone-900">{metrics.uniqueShopsCount} محلات</span>
            </div>
            <div className="p-4">
              <span className="text-xs text-stone-500 font-medium block mb-1">الطلبات المسلمة</span>
              <span className="text-xl font-black text-emerald-800">
                {deliveredCount} / {dropoffStops.length}
              </span>
            </div>
            <div className="p-4 bg-amber-50/60">
              <span className="text-xs font-bold text-amber-900 block mb-1">إجمالي التحصيل النقدي (COD)</span>
              <span className="text-xl font-black text-stone-900 font-mono" dir="ltr">
                {filsToDisplay(metrics.totalCodFils)}
              </span>
            </div>
          </div>

          {/* Navigation Filter Tabs */}
          <div className="p-3 sm:p-4 bg-white border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 print:hidden">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'ALL'
                    ? 'bg-[#2d3623] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                عرض المسار الكامل
              </button>
              <button
                onClick={() => setActiveTab('PICKUP')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'PICKUP'
                    ? 'bg-[#2d3623] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>1. استلام المحلات ({pickupStops.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('DROPOFF')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'DROPOFF'
                    ? 'bg-[#2d3623] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>2. تسليم الزبائن ({dropoffStops.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('MATRIX')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'MATRIX'
                    ? 'bg-amber-600 text-white shadow-xs font-black'
                    : 'bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>3. جدول فرز الطلبات لمنع الخلط ✨</span>
              </button>
            </div>

            <div className="text-xs text-stone-500 font-medium">
              التحقق عبر: <span className="font-bold text-stone-800">رقم الطلب + اسم الزبونة + الأصناف</span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════ */}
          {/* SECTION 1: PICKUP STOPS FROM SHOPS                   */}
          {/* ══════════════════════════════════════════════════════ */}
          {(activeTab === 'ALL' || activeTab === 'PICKUP') && (
            <section className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[#2d3623] text-white text-xs font-black flex items-center justify-center">
                      1
                    </span>
                    <h2 className="text-base font-extrabold text-stone-900">
                      محطات الاستلام من المحلات والموردين
                    </h2>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    قم بزيارة المحلات الموضحة واستلام طلبات الزبائن وتفقدها لكل زبونة على حدة.
                  </p>
                </div>
                <span className="text-xs font-bold text-stone-800 bg-stone-100 border border-stone-200 px-3 py-1 rounded-xl">
                  {pickupStops.length} محلات مطلوبة
                </span>
              </div>

              {/* Master Pickup Confirmation Action */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div className="space-y-1 max-w-lg">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs sm:text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>تعليمات تنظيمية هامة لمنع خلط الطلبات:</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    عند استلام الطلب من المحل، افصل منتجات كل زبونة في كيس مخصص واكتب عليه مباشرة <strong>رقم الطلب واسم الزبونة</strong>.
                  </p>
                </div>

                {localBatchStatus === 'IN_DELIVERY' ? (
                  <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 px-3.5 py-2 rounded-xl text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>تم تأكيد الاستلام من المحلات — رحلة التوصيل جارية ✓</span>
                  </div>
                ) : localBatchStatus === 'COMPLETED' ? (
                  <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 px-3.5 py-2 rounded-xl text-xs font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>تم اكتمال الإرسالية بالكامل بنجاح ✓</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isConfirmingPickup}
                    onClick={handleConfirmPickup}
                    className="bg-[#2d3623] hover:bg-[#3F4832] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs active:scale-95"
                  >
                    {isConfirmingPickup ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جارٍ التأكيد...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-amber-300" />
                        <span>تأكيد استلام كافة الطلبات وبدء التوصيل 🚚</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Shops Cards */}
              <div className="space-y-4">
                {pickupStops.map((stop, index) => (
                  <article
                    key={stop.shopKey}
                    className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 space-y-4 shadow-2xs"
                  >
                    {/* Shop Header */}
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-[#2d3623] text-amber-300 text-xs font-black flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <h3 className="font-black text-sm sm:text-base text-stone-900">
                            {stop.supplierName}
                          </h3>
                          {stop.contactPerson && (
                            <span className="text-xs text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md font-medium">
                              المسؤول: {stop.contactPerson}
                            </span>
                          )}
                          <span className="text-xs text-stone-400 font-mono">
                            ({stop.locationLabel})
                          </span>
                        </div>
                        <div className="text-xs text-stone-600 mt-1 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>{stop.address} — {stop.city}</span>
                        </div>
                      </div>

                      {/* Phone & Map actions */}
                      <div className="flex items-center gap-2 print:hidden">
                        {stop.contactPhone && (
                          <a
                            href={`tel:${stop.contactPhone}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-stone-800 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl transition"
                          >
                            <Phone className="w-3.5 h-3.5 text-stone-600" />
                            <span dir="ltr">{stop.contactPhone}</span>
                          </a>
                        )}
                        <a
                          href={stop.googleMapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>فتح الخريطة 🗺️</span>
                        </a>
                      </div>
                    </div>

                    {stop.pickupInstructions && (
                      <div className="p-2.5 bg-stone-50 rounded-xl text-xs text-stone-700 border border-stone-200">
                        <strong>ملاحظات المحل:</strong> {stop.pickupInstructions}
                      </div>
                    )}

                    {/* Customer Orders to Pick Up From This Shop */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                        <span>الطلبات المطلوب استلامها من هذا المحل ({stop.orders.length} طلبات):</span>
                        <span className="text-stone-400 font-normal text-[11px]">
                          طابق كل طلب باسم الزبونة والمنتجات المطلوبة
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {stop.orders.map((order) => {
                          const orderKey = order.fulfillmentOrderId || order.orderId || '';
                          const isPickedUp = Boolean(
                            (orderKey && localPickedUpOrders[orderKey]) ||
                            order.isPickedUp ||
                            (order.orderId && localDeliveredOrders[order.orderId])
                          );
                          const isConfirming = orderKey ? Boolean(isConfirmingSinglePickup[orderKey]) : false;

                          return (
                            <div
                              key={`${order.orderId}-${order.fulfillmentOrderId || 'central'}`}
                              className={`p-3.5 rounded-2xl border text-xs transition flex flex-col justify-between gap-2.5 ${
                                isPickedUp
                                  ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                                  : 'bg-stone-50 border-stone-200 text-stone-800'
                              }`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-stone-200/60 pb-2">
                                <div>
                                  <span className="block text-[10px] text-stone-400 font-bold uppercase">الزبونة</span>
                                  <strong className="text-sm font-black text-stone-900">{order.customerName}</strong>
                                  {order.city && (
                                    <span className="block text-[11px] text-stone-500">{order.city}</span>
                                  )}
                                </div>
                                <span className="rounded-xl bg-white px-2.5 py-1 font-mono font-black text-stone-900 border border-stone-200 shadow-2xs">
                                  طلب <bdi dir="ltr">#{order.orderReference}</bdi>
                                </span>
                              </div>

                              {/* Items List from this Shop */}
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-stone-500 block">الأصناف من هذا المحل:</span>
                                <ul className="space-y-1">
                                  {order.items.map((item, itemIndex) => (
                                    <li
                                      key={`${item.name}-${item.variantTitle || ''}-${itemIndex}`}
                                      className="flex items-center justify-between gap-2 bg-white/70 px-2 py-1 rounded-lg border border-stone-200/50"
                                    >
                                      <span className="min-w-0 font-semibold text-stone-800 truncate">
                                        {item.name}
                                        {item.variantTitle && (
                                          <span className="text-[11px] font-normal text-stone-500"> ({item.variantTitle})</span>
                                        )}
                                      </span>
                                      <span className="shrink-0 rounded-md bg-[#2d3623] text-amber-300 px-2 py-0.5 font-mono font-bold text-[11px]">
                                        × {item.quantity}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Pickup Action */}
                              <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between print:hidden">
                                <span className="text-[10px] text-stone-500">
                                  {isPickedUp ? 'تم الاستلام والتأكيد ✓' : 'بانتظار الاستلام من المحل'}
                                </span>

                                {isPickedUp ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-xl">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>مستلم ✓</span>
                                  </span>
                                ) : order.orderId ? (
                                  <button
                                    type="button"
                                    disabled={isConfirming}
                                    onClick={() =>
                                      handleConfirmSingleOrderPickup(
                                        order.orderId!,
                                        order.orderReference,
                                        order.fulfillmentOrderId
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2d3623] hover:bg-[#3F4832] text-white text-[11px] font-bold transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-xs"
                                  >
                                    {isConfirming ? (
                                      <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span>جارٍ التأكيد...</span>
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                                        <span>تأكيد استلام هذا الطلب</span>
                                      </>
                                    )}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* SECTION 2: DROPOFF DESTINATIONS (CUSTOMER DELIVERIES) */}
          {/* ══════════════════════════════════════════════════════ */}
          {(activeTab === 'ALL' || activeTab === 'DROPOFF') && (
            <section className="p-4 sm:p-6 space-y-4 border-t border-stone-200">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[#2d3623] text-white text-xs font-black flex items-center justify-center">
                      2
                    </span>
                    <h2 className="text-base font-extrabold text-stone-900">
                      محطات التسليم للزبونات والتحصيل النقدي
                    </h2>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    سلّمي الطلب للعنوان الموضح وتأكدي من مطابقة كافة الأصناف قبل التحصيل.
                  </p>
                </div>
                <span className="text-xs font-bold text-stone-800 bg-stone-100 border border-stone-200 px-3 py-1 rounded-xl">
                  {dropoffStops.length} طلبات تسليم
                </span>
              </div>

              {/* Search and Filters Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-200 print:hidden">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="بحث باسم الزبونة، رقم الطلب، أو المدينة..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 pr-9 pl-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-600">
                  <button
                    onClick={() => setDeliveryFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      deliveryFilter === 'ALL'
                        ? 'bg-stone-900 text-white'
                        : 'bg-white border border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    الكل ({dropoffStops.length})
                  </button>
                  <button
                    onClick={() => setDeliveryFilter('PENDING')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      deliveryFilter === 'PENDING'
                        ? 'bg-amber-800 text-white'
                        : 'bg-white border border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    بانتظار التسليم ({pendingCount})
                  </button>
                  <button
                    onClick={() => setDeliveryFilter('DELIVERED')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      deliveryFilter === 'DELIVERED'
                        ? 'bg-emerald-800 text-white'
                        : 'bg-white border border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    تم التسليم ({deliveredCount})
                  </button>
                </div>
              </div>

              {/* Master Delivery Action for All Orders */}
              <div className="bg-emerald-50/80 border border-emerald-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-sm text-emerald-950 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-emerald-700" />
                    <span>تأكيد تسليم كافة الطلبات المتبقية دفعة واحدة</span>
                  </h3>
                  <p className="text-xs text-emerald-800">
                    يمكن للسائق تأكيد تسليم كافة طلبات الإرسالية دفعة واحدة بعد إتمام الجولة وتحصيل المبالغ.
                  </p>
                </div>

                {localBatchStatus === 'COMPLETED' || dropoffStops.every((d) => localDeliveredOrders[d.orderId]) ? (
                  <div className="inline-flex items-center gap-1.5 bg-white text-emerald-800 border border-emerald-300 px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>تم تسليم كافة الطلبات بالكامل ✓</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isConfirmingAllDeliveries}
                    onClick={handleConfirmAllDeliveries}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs active:scale-95"
                  >
                    {isConfirmingAllDeliveries ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جارٍ تأكيد تسليم الجميع...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                        <span>تأكيد تسليم جميع الطلبات دفعة واحدة ✓</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Dropoff Orders Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDropoffs.map((dropoff) => {
                  const isDelivered = Boolean(localDeliveredOrders[dropoff.orderId]);
                  return (
                    <article
                      key={dropoff.orderId}
                      className={`p-4 sm:p-5 rounded-3xl border transition space-y-3.5 shadow-2xs ${
                        isDelivered
                          ? 'border-emerald-300 bg-emerald-50/20'
                          : 'border-stone-200 bg-white'
                      }`}
                    >
                      {/* Customer Name, Order Ref, COD */}
                      <div className="flex items-start justify-between border-b border-stone-100 pb-3 gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-xl bg-stone-900 px-2.5 py-1 text-xs font-mono font-black text-amber-300">
                              طلب <bdi dir="ltr">#{dropoff.orderReference}</bdi>
                            </span>
                            {isDelivered && (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                                تم التسليم ✓
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-black text-stone-900 mt-1">
                            {dropoff.customerName}
                          </h3>
                        </div>

                        {/* COD Amount */}
                        <div className="text-left font-mono">
                          <span className="text-[10px] text-stone-400 block font-sans">المبلغ المطلوب</span>
                          <span
                            className={`text-base font-black block ${
                              dropoff.isPaid
                                ? 'text-stone-400 line-through'
                                : isDelivered
                                ? 'text-emerald-700'
                                : 'text-[#2d3623]'
                            }`}
                            dir="ltr"
                          >
                            {dropoff.isPaid
                              ? '0.00 د.أ (مدفوع)'
                              : isDelivered
                              ? `تم تحصيل: ${filsToDisplay(dropoff.codAmountFils)}`
                              : filsToDisplay(dropoff.codAmountFils)}
                          </span>
                        </div>
                      </div>

                      {/* Phone, Address, Navigation Links */}
                      <div className="space-y-2 text-xs text-stone-600 bg-stone-50 p-3 rounded-2xl border border-stone-200/60">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-mono">
                            <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <a
                              href={`tel:${dropoff.customerPhone}`}
                              className="font-bold text-stone-900 hover:underline"
                              dir="ltr"
                            >
                              {dropoff.customerPhone}
                            </a>
                          </div>

                          <div className="flex items-center gap-2 print:hidden">
                            <a
                              href={`tel:${dropoff.customerPhone}`}
                              className="px-2.5 py-1 rounded-lg bg-stone-200/80 hover:bg-stone-300 text-stone-800 font-bold text-[11px] transition"
                            >
                              اتصال
                            </a>
                            <a
                              href={`https://wa.me/${dropoff.customerPhone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-[#25D366] text-white font-bold text-[11px] transition"
                            >
                              واتساب
                            </a>
                          </div>
                        </div>

                        <div className="flex items-start justify-between gap-2 pt-1 border-t border-stone-200/50">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">
                              {dropoff.city} — {dropoff.address}
                            </span>
                          </div>
                          <a
                            href={dropoff.googleMapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline bg-white px-2 py-0.5 rounded-lg border border-stone-200 print:hidden"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>خريطة</span>
                          </a>
                        </div>
                      </div>

                      {/* Multi-Store Warning Badge */}
                      {dropoff.isMultiStore && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-1">
                          <div className="flex items-center gap-1 font-bold text-amber-900">
                            <Layers className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>طلب مجمّع من ({dropoff.suppliers.length}) محلات مختلفة:</span>
                          </div>
                          <div className="flex flex-wrap gap-1 text-[11px]">
                            {dropoff.suppliers.map((s, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-white rounded-md border border-amber-300 font-semibold text-amber-900"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] text-amber-800">
                            * تأكدي من جمع كافة القطع ({dropoff.totalItemsCount} قطع) في كيس واحد للزبونة قبل التسليم.
                          </p>
                        </div>
                      )}

                      {/* Item Checklist with Store Origin */}
                      <div className="rounded-2xl bg-white border border-stone-200 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                          <span>محتويات الطلب للتسليم ({dropoff.totalItemsCount} قطع):</span>
                          <span className="text-[10px] text-stone-400 font-normal">
                            حددي القطع للتأكد من عدم نسيانها
                          </span>
                        </div>
                        <ul className="space-y-1.5 text-xs text-stone-800 divide-y divide-stone-100">
                          {dropoff.items.map((item, itemIndex) => {
                            const isChecked = Boolean(checkedItems[`${dropoff.orderId}-${itemIndex}`]);
                            return (
                              <li
                                key={`${item.name}-${item.variantTitle || ''}-${itemIndex}`}
                                className="pt-1.5 flex items-start justify-between gap-2"
                              >
                                <label className="flex items-start gap-2 cursor-pointer flex-1">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleItemCheck(dropoff.orderId, itemIndex)}
                                    className="mt-0.5 rounded border-stone-300 text-stone-900 focus:ring-stone-500 cursor-pointer print:hidden"
                                  />
                                  <div className="min-w-0">
                                    <span className={`font-semibold block ${isChecked ? 'line-through text-stone-400' : 'text-stone-900'}`}>
                                      {item.name}
                                    </span>
                                    {item.variantTitle && (
                                      <span className="text-[11px] text-stone-500 block">
                                        الخيار: {item.variantTitle}
                                      </span>
                                    )}
                                    <span className="inline-block text-[10px] font-medium text-stone-500 bg-stone-100 px-1.5 py-0.2 rounded mt-0.5">
                                      المصدر: {item.supplierName}
                                    </span>
                                  </div>
                                </label>
                                <span className="shrink-0 font-mono font-black text-xs bg-stone-100 px-2 py-0.5 rounded-md">
                                  × {item.quantity}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      {/* Confirm Delivery Button */}
                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between print:hidden">
                        <span className="text-[10px] text-stone-400">
                          {isDelivered ? 'تم توثيق التسليم والتحصيل' : 'تأكيد التسليم الميداني'}
                        </span>

                        {isDelivered ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>تم التسليم بنجاح ✓</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isConfirmingDelivery[dropoff.orderId]}
                            onClick={() =>
                              handleConfirmOrderDelivery(
                                dropoff.orderId,
                                dropoff.orderReference,
                                dropoff.customerName,
                                dropoff.codAmountFils,
                                dropoff.isPaid
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2d3623] hover:bg-[#3F4832] text-white font-bold text-xs transition disabled:opacity-50 cursor-pointer shadow-xs active:scale-95"
                          >
                            {isConfirmingDelivery[dropoff.orderId] ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>جارٍ التأكيد...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                                <span>تأكيد التسليم والتحصيل ✓</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* SECTION 3: MULTI-ORDER VERIFICATION MATRIX           */}
          {/* ══════════════════════════════════════════════════════ */}
          {(activeTab === 'ALL' || activeTab === 'MATRIX') && (
            <section className="p-4 sm:p-6 space-y-4 border-t border-stone-200">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-600 text-white text-xs font-black flex items-center justify-center">
                      3
                    </span>
                    <h2 className="text-base font-extrabold text-stone-900">
                      جدول فرز ومطابقة كافة الطلبات (منع الخلط اللوجستي)
                    </h2>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    كشف شامل لجميع الـ ({dropoffStops.length}) طلبات والمحلات الموردة لكل طلب، لمطابقة الأكياس قبل التسليم.
                  </p>
                </div>
                <span className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl">
                  {dropoffStops.length} زبائن / طلبات مستقلة
                </span>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
                <table className="w-full text-right text-xs divide-y divide-stone-200">
                  <thead className="bg-stone-50 font-bold text-stone-600">
                    <tr>
                      <th className="py-3 px-3">رقم الطلب</th>
                      <th className="py-3 px-3">اسم الزبونة</th>
                      <th className="py-3 px-3">المدينة والمنطقة</th>
                      <th className="py-3 px-3">المحلات الموردة</th>
                      <th className="py-3 px-3 text-center">عدد الأصناف</th>
                      <th className="py-3 px-3 text-left">مبلغ التحصيل (COD)</th>
                      <th className="py-3 px-3 text-center">حالة التسليم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {dropoffStops.map((drop, idx) => {
                      const isDelivered = Boolean(localDeliveredOrders[drop.orderId]);
                      return (
                        <tr
                          key={drop.orderId}
                          className={`hover:bg-stone-50/50 transition ${
                            isDelivered ? 'bg-emerald-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-3 font-mono font-bold text-stone-900 whitespace-nowrap">
                            #{drop.orderReference}
                          </td>
                          <td className="py-3 px-3 font-black text-stone-900 whitespace-nowrap">
                            {drop.customerName}
                          </td>
                          <td className="py-3 px-3 text-stone-600 max-w-[180px] truncate">
                            {drop.city} — {drop.address}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1">
                              {drop.suppliers.map((sup, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-800 border border-stone-200"
                                >
                                  {sup}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold">
                            {drop.totalItemsCount} قطعة
                          </td>
                          <td className="py-3 px-3 text-left font-mono font-black" dir="ltr">
                            {drop.isPaid ? '0.00 د.أ (مدفوع)' : filsToDisplay(drop.codAmountFils)}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {isDelivered ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>تم التسليم</span>
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                بانتظار التسليم
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="p-4 bg-stone-50 border-t border-stone-200 text-center text-xs text-stone-500">
            منظومة رَواق اللوجستية لإدارة وتوزيع الطلبات © {new Date().getFullYear()}
          </footer>
        </div>
      </div>
    </div>
  );
}
