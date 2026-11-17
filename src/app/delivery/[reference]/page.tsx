import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { requirePermission } from '@/lib/dal';
import { filsToDisplay } from '@/lib/money';
import DeliveryManifestClient from './DeliveryManifestClient';

export default async function DeliveryBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ reference }, { token }] = await Promise.all([params, searchParams]);

  const batch = await prisma.deliveryBatch.findUnique({
    where: { reference },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          deliveryJob: true,
          fulfillmentOrders: {
            include: {
              supplier: {
                include: {
                  locations: true,
                },
              },
              location: true,
              packages: {
                include: {
                  items: {
                    include: {
                      fulfillmentItem: true,
                    },
                  },
                },
              },
              items: true,
            },
          },
        },
      },
    },
  });

  if (!batch) {
    return notFound();
  }

  if (batch.secureToken) {
    if (!token || token !== batch.secureToken) return notFound();
  } else {
    // Older batches predate capability links and remain staff-only.
    await requirePermission('manage:orders');
  }

  // Shared delivery links expire after 60 days
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  if (batch.createdAt < sixtyDaysAgo) {
    return notFound();
  }

  // 1. تجميع محطات الاستلام حسب المحل / موقع المحل (Stop Aggregation)
  const pickupStopsMap = new Map<string, any>();
  let totalShopOrderCount = 0;
  let totalCodFils = 0;

  for (const order of batch.orders) {
    const isCodPending = order.paymentStatus === 'COD_PENDING' || order.paymentStatus === 'UNPAID';
    if (isCodPending) {
      totalCodFils += order.totalAmount;
    }

    if (order.fulfillmentOrders && order.fulfillmentOrders.length > 0) {
      for (const fo of order.fulfillmentOrders) {
        const stopKey = fo.locationId || fo.supplierId || `supplier-${fo.supplier?.id}`;
        const supplierName = fo.supplier?.name || 'محل رَواق';
        const locationLabel = fo.location?.label || 'المقر الرئيسي';
        const contactPerson = fo.supplier?.ownerName || fo.location?.contactPerson || supplierName;
        const contactPhone = fo.location?.contactPhone || fo.supplier?.phone || '';
        const address =
          fo.pickupAddressSnapshot ||
          fo.location?.addressDetails ||
          fo.supplier?.address ||
          `${fo.location?.city || 'عمان'}`;
        const city = fo.location?.city || 'عمان';

        const lat = fo.location?.latitude;
        const lng = fo.location?.longitude;
        const googleMapsUrl =
          fo.supplier?.mapLocationUrl ||
          fo.location?.mapLocationUrl ||
          (lat && lng
            ? `https://maps.google.com/?q=${lat},${lng}`
            : `https://maps.google.com/?q=${encodeURIComponent(`${address}, ${city}, الأردن`)}`);

        if (!pickupStopsMap.has(stopKey)) {
          pickupStopsMap.set(stopKey, {
            shopKey: stopKey,
            supplierName,
            locationLabel,
            contactPerson,
            contactPhone,
            address,
            city,
            googleMapsUrl,
            pickupInstructions: fo.location?.pickupInstructions,
            orders: [],
          });
        }

        const stop = pickupStopsMap.get(stopKey);

        const isPickedUp = fo.status === 'PICKED_UP' || fo.status === 'DELIVERED' || order.status === 'DELIVERED';

        const pickupOrder = {
          orderId: order.id,
          fulfillmentOrderId: fo.id,
          orderReference: order.reference,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          city: fo.location?.city || order.deliveryJob?.city || order.shippingZoneNameSnapshot || 'عمان',
          isPickedUp: isPickedUp || (fo.packages.length > 0 && fo.packages.every((pkg) => pkg.status === 'PICKED_UP' || pkg.status === 'DELIVERED')),
          items: [] as Array<{ name: string; variantTitle?: string | null; quantity: number }>,
        };
        const packageItems = fo.packages.flatMap((pkg) => pkg.items);
        const sourceItems = packageItems.length > 0
          ? packageItems.map((pi) => ({ item: pi.fulfillmentItem, quantity: pi.quantity }))
          : fo.items.map((item) => ({ item, quantity: item.quantity }));
        const itemQuantities = new Map<string, { name: string; variantTitle?: string | null; quantity: number }>();
        for (const { item, quantity } of sourceItems) {
          const name = item?.productTitle || 'منتج';
          const variantTitle = item?.variantTitle || null;
          const key = `${name}::${variantTitle || ''}`;
          const current = itemQuantities.get(key);
          itemQuantities.set(key, { name, variantTitle, quantity: (current?.quantity || 0) + quantity });
        }
        pickupOrder.items = Array.from(itemQuantities.values());
        stop.orders.push(pickupOrder);
        totalShopOrderCount += 1;
      }
    } else {
      // طلب ليس له تقسيم محلات بعد (طلب مباشر من المتجر)
      const stopKey = 'rawaq-central-hub';
      if (!pickupStopsMap.has(stopKey)) {
        pickupStopsMap.set(stopKey, {
          shopKey: stopKey,
          supplierName: 'مستودع رَواق المركزي',
          locationLabel: 'المقر الرئيسي',
          contactPerson: 'إدارة العمليات',
          contactPhone: '0790924636',
          address: 'عمان، الأردن',
          city: 'عمان',
          googleMapsUrl: 'https://maps.google.com/?q=Amman,Jordan',
          orders: [],
        });
      }
      totalShopOrderCount += 1;
      const isPickedUp = order.fulfillmentStatus === 'PICKED_UP' || order.status === 'DELIVERED';
      pickupStopsMap.get(stopKey).orders.push({
        orderId: order.id,
        orderReference: order.reference,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        city: order.deliveryJob?.city || order.shippingZoneNameSnapshot || 'عمان',
        isPickedUp,
        items: order.items.map((it) => ({
          name: it.name,
          variantTitle: it.size,
          quantity: it.quantity,
        })),
      });
    }
  }

  const pickupStops = Array.from(pickupStopsMap.values());

  // 2. تجميع محطات التسليم للعملاء مع تطهير العنوان وتحديد مصادر المحلات لمنع الخلط
  const dropoffStops = batch.orders.map((order) => {
    const isPaid = order.paymentStatus === 'PAID';
    const city = order.deliveryJob?.city || order.shippingZoneNameSnapshot || 'عمان';
    
    // تنظيف العنوان وتجريده من أي إقرارات أو شروط قانونية
    const rawAddress = order.deliveryJob?.addressDetails || order.notes || 'عمان';
    const cleanAddress = rawAddress
      .replace(/\[إقرار وموافقة إلكترونية موثقة\]:?[^\n]*/gi, '')
      .replace(/تم قبول الشروط والأحكام[^\n]*/gi, '')
      .replace(/العنوان:\s*/g, '')
      .trim() || 'عمان';

    const googleMapsUrl =
      order.deliveryJob?.mapLocationUrl ||
      `https://maps.google.com/?q=${encodeURIComponent(`${cleanAddress}, ${city}, الأردن`)}`;

    const isDelivered = order.status === 'DELIVERED' || order.fulfillmentStatus === 'DELIVERED';

    // جمع أسماء المحلات الموردة للطلب
    const supplierNamesSet = new Set<string>();
    if (order.fulfillmentOrders && order.fulfillmentOrders.length > 0) {
      for (const fo of order.fulfillmentOrders) {
        if (fo.supplier?.name) supplierNamesSet.add(fo.supplier.name);
      }
    }
    for (const it of order.items) {
      if (it.supplierNameSnapshot) supplierNamesSet.add(it.supplierNameSnapshot);
    }
    if (supplierNamesSet.size === 0) {
      supplierNamesSet.add('مستودع رَواق المركزي');
    }
    const suppliers = Array.from(supplierNamesSet);

    return {
      orderId: order.id,
      orderReference: order.reference,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      city,
      address: cleanAddress,
      googleMapsUrl,
      codAmountFils: isPaid ? 0 : order.totalAmount,
      isPaid,
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      isDelivered,
      deliveredAt: order.deliveryJob?.collectedAt ? order.deliveryJob.collectedAt.toISOString() : null,
      suppliers,
      isMultiStore: suppliers.length > 1,
      totalItemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      items: order.items.map((item) => ({
        name: item.name,
        variantTitle: item.size && item.size !== 'افتراضي' ? item.size : null,
        quantity: item.quantity,
        supplierName: item.supplierNameSnapshot || (suppliers.length === 1 ? suppliers[0] : 'المحل المورد'),
      })),
    };
  });

  // 3. بناء نص رسالة واتساب الشاملة لسائقي شركة التوصيل
  let baseUrl = (process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://rawaq.jo').replace(/\/+$/, '');
  try {
    const headerList = await headers();
    const host = headerList.get('x-forwarded-host') || headerList.get('host');
    const proto =
      headerList.get('x-forwarded-proto') ||
      (host && (host.startsWith('localhost') || host.startsWith('127.0.0.1')) ? 'http' : 'https');
    if (host) baseUrl = `${proto}://${host}`;
  } catch {}
  const manifestUrl = `${baseUrl}/delivery/${batch.reference}${batch.secureToken ? `?token=${encodeURIComponent(batch.secureToken)}` : ''}`;

  let formattedWhatsAppText =
    `📋 *كشف توصيل واستلام إرسالية رَواق (RAWAQ)*\n` +
    `رقم الإرسالية: *${batch.reference}*\n` +
    `📦 عدد الطلبات: ${batch.orders.length} طلبات\n` +
    `🏪 المحلات المطلوب زيارتها: *${pickupStops.length} محلات*\n` +
    `🧾 مهام الاستلام من المحلات: ${totalShopOrderCount}\n` +
    `💰 إجمالي مبالغ التحصيل COD: *${filsToDisplay(totalCodFils)}*\n` +
    `🔗 رابط الكشف المباشر والخرائط: ${manifestUrl}\n\n` +
    `═══════════════════════\n` +
    `📍 *المرحلة الأولى: محطات الاستلام من المحلات*\n` +
    `*(تنبيه: افصل منتجات كل زبون في كيس مستقل واكتب رقم الطلب واسم الزبون لمنع الخلط)*\n`;

  pickupStops.forEach((stop, idx) => {
    formattedWhatsAppText +=
      `\n*${idx + 1}. ${stop.supplierName} (${stop.locationLabel})*\n` +
      `👤 المسؤول: ${stop.contactPerson}\n` +
      `📞 هاتف: ${stop.contactPhone || '—'}\n` +
      `📌 العنوان: ${stop.address}\n` +
      `🗺️ الخريطة: ${stop.googleMapsUrl}\n` +
      `🧾 الطلبات المطلوب استلامها (${stop.orders.length} طلبات):\n`;
    stop.orders.forEach((order: any) => {
      formattedWhatsAppText += `  • طلب #${order.orderReference} — الزبونة: ${order.customerName}\n`;
      for (const item of order.items) {
        formattedWhatsAppText += `    - ${item.name}${item.variantTitle ? ` (${item.variantTitle})` : ''} × ${item.quantity}\n`;
      }
    });
  });

  formattedWhatsAppText +=
    `\n═══════════════════════\n` +
    `🚚 *المرحلة الثانية: محطات التسليم للزبونات والتحصيل*\n`;

  dropoffStops.forEach((drop, idx) => {
    const multiTag = drop.isMultiStore
      ? ` ⚠️ [مجمّع من ${drop.suppliers.length} محلات: ${drop.suppliers.join(' + ')}]`
      : ` [المصدر: ${drop.suppliers[0]}]`;
    formattedWhatsAppText +=
      `\n*${idx + 1}. طلب #${drop.orderReference} — ${drop.customerName}*${multiTag}\n` +
      `📞 هاتف: ${drop.customerPhone}\n` +
      `📍 العنوان: ${drop.city} - ${drop.address}\n` +
      `💰 التحصيل المطلوب: *${drop.isPaid ? '0.00 د.أ (مدفوع)' : filsToDisplay(drop.codAmountFils)}*\n` +
      `🛍️ الأصناف المطلوب تسليمها:\n`;
    drop.items.forEach((item: any) => {
      formattedWhatsAppText += `  • ${item.name}${item.variantTitle ? ` (${item.variantTitle})` : ''} × ${item.quantity} (من: ${item.supplierName})\n`;
    });
  });

  formattedWhatsAppText += `\n✨ بالتوفيق في التوصيل - فريق رَواق اللوجستي`;

  return (
    <DeliveryManifestClient
      batch={{
        reference: batch.reference,
        secureToken: batch.secureToken || undefined,
        createdAt: batch.createdAt,
        status: batch.status,
      }}
      metrics={{
        ordersCount: batch.orders.length,
        uniqueShopsCount: pickupStops.length,
        ordersForPickupCount: totalShopOrderCount,
        totalCodFils,
      }}
      pickupStops={pickupStops}
      dropoffStops={dropoffStops}
      formattedWhatsAppText={formattedWhatsAppText}
    />
  );
}
