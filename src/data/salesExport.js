import { isExchangeAdjustmentOrder, PAYMENT_METHOD_LABELS, summarizeDailyCloseout } from "./salesCloseout.js";

const amountOf = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const orderAmount = (order) => amountOf(order.total);
const refundAmount = (order) => Math.max(0, amountOf(order.refundDue));
const isVoided = (order) => Boolean(order.voidedAt);
const netAmount = (order) => isVoided(order)
  ? 0
  : orderAmount(order) - (order.replacementSourceReceiptId ? 0 : refundAmount(order));
const quantityOf = (item) => Math.max(0, item.qty === undefined || item.qty === null || item.qty === "" ? 1 : amountOf(item.qty));
const itemAmount = (item) => Math.abs(amountOf(item.price)) * quantityOf(item);

const groupOrders = (orders, keyOf) => {
  const groups = new Map();
  orders.filter((order) => !isVoided(order)).forEach((order) => {
    const key = keyOf(order) || "未提供";
    const group = groups.get(key) || { name: key, count: 0, quantity: 0, amount: 0, refund: 0, net: 0 };
    group.count += 1;
    group.quantity += amountOf(order.itemCount);
    group.amount += orderAmount(order);
    group.refund += refundAmount(order);
    group.net += netAmount(order);
    groups.set(key, group);
  });
  return [...groups.values()]
    .sort((first, second) => second.net - first.net || first.name.localeCompare(second.name, "zh-Hant"))
    .map((group) => [group.name, group.count, group.quantity, group.amount, group.refund, group.net]);
};

const buildProductRows = (orders) => {
  const groups = new Map();
  orders.filter((order) => !isVoided(order)).forEach((order) => {
    (Array.isArray(order.items) ? order.items : []).forEach((item) => {
      const key = [item.name || "未命名款式", item.size || "", item.length || ""].join("\u0000");
      const group = groups.get(key) || {
        name: item.name || "未命名款式",
        size: item.size || "",
        length: item.length || "",
        soldQuantity: 0,
        returnedQuantity: 0,
        salesAmount: 0,
        returnAmount: 0,
      };
      const quantity = quantityOf(item);
      const amount = itemAmount(item);
      if (item.exchangeReturn) {
        group.returnedQuantity += quantity;
        group.returnAmount += amount;
      } else {
        group.soldQuantity += quantity;
        group.salesAmount += amount;
      }
      groups.set(key, group);
    });
  });

  return [...groups.values()]
    .sort((first, second) => first.name.localeCompare(second.name, "zh-Hant")
      || first.size.localeCompare(second.size, "zh-Hant")
      || first.length.localeCompare(second.length, "zh-Hant"))
    .map((group) => [
      group.name,
      group.size,
      group.length,
      group.soldQuantity,
      group.returnedQuantity,
      group.salesAmount,
      group.returnAmount,
      group.salesAmount - group.returnAmount,
    ]);
};

export const buildSalesExportSheets = (orders, { outletForOrder, scope = "" } = {}) => {
  const rows = Array.isArray(orders) ? orders : [];
  const activeOrders = rows.filter((order) => !isVoided(order));
  const dates = [...new Set(rows.map((order) => order.date).filter(Boolean))].sort();
  const totalAmount = activeOrders.reduce((sum, order) => sum + orderAmount(order), 0);
  const totalRefunds = activeOrders.reduce((sum, order) => sum + refundAmount(order), 0);
  const totalQuantity = activeOrders.reduce((sum, order) => sum + amountOf(order.itemCount), 0);
  const netRevenue = activeOrders.reduce((sum, order) => sum + netAmount(order), 0);
  const closeout = summarizeDailyCloseout(rows);
  const dateRange = dates.length === 0 ? "無交易" : dates.length === 1 ? dates[0] : `${dates[0]} 至 ${dates.at(-1)}`;

  return [
    {
      name: "閱讀指引",
      rows: [
        ["銷售紀錄分析報表", "說明"],
        ["匯出範圍", scope || "依匯出時套用的日期、門店、學校及搜尋條件"],
        ["訂單工作表", "每張單只佔一行；單據金額、退款及淨收入不會因商品行數重複。"],
        ["商品明細工作表", "每件商品佔一行；不包含單據總額欄，避免加總時重複計算。"],
        ["淨收入", "一般有效單據金額扣除退款；整單替換以新單全額計入，補退款差額不再重複扣減；已作廢單淨收入為 0。"],
        ["單據件數", "按訂單保存的件數欄位彙總；退換單可能同時計入退回及換入件數，分析商品數量請查看商品分析。"],
        ["商品分析", "按商品明細計算銷售及退回數量；舊單若沒有保存退回商品標記，退貨款式無法由單據退款反推。"],
        ["作廢記錄", "訂單工作表保留作廢單供稽核；總覽及分析表不把作廢單計入收入。"],
        ["個人資料", "報表不匯出客人姓名或電話。"],
      ],
      widths: [22, 100],
    },
    {
      name: "總覽",
      rows: [
        ["項目", "數值"],
        ["報表日期", dateRange],
        ["符合篩選條件的單數", rows.length],
        ["有效單數", activeOrders.length],
        ["已作廢單數", rows.length - activeOrders.length],
        ["有效單據金額", totalAmount],
        ["單據退款金額", totalRefunds],
        ["淨收入", netRevenue],
        ["有效單據件數", totalQuantity],
      ],
      widths: [30, 24],
    },
    {
      name: "收市對數",
      rows: [
        ["項目", "金額"],
        ["銷售額", closeout.salesAmount],
        ["退回貨品額（參考，不重複扣減）", closeout.returnedGoodsAmount],
        ["換貨補／退款差額", closeout.exchangeDifference],
        ["淨收入", closeout.netRevenue],
        ["實收款", closeout.totalReceived],
        ["退款實付", closeout.totalRefunded],
        [],
        ["支付方式", "實收", "退款實付", "淨額"],
        ...Object.entries(PAYMENT_METHOD_LABELS).map(([method, label]) => [
          label,
          closeout.channels[method].received,
          closeout.channels[method].refunded,
          closeout.channels[method].received - closeout.channels[method].refunded,
        ]),
      ],
      widths: [38, 18, 18, 18],
    },
    {
      name: "訂單",
      rows: [
        ["日期", "時間", "單號", "狀態", "學校", "門店", "開單員工", "單據件數", "單據金額", "單據退款", "淨收入", "來源單號", "作廢原因", "付款方式", "退款方式", "退換原因", "疑似重複已確認", "重複參照單號"],
        ...rows.map((order) => [
          order.date || "",
          order.time || "",
          order.id || "",
          isVoided(order) ? "已作廢" : order.untrackedExchange ? "無原單退換" : isExchangeAdjustmentOrder(order) ? "退換／更正單" : "有效",
          order.school || "",
          outletForOrder?.(order) || order.outletName || order.outlet_name || "",
          order.cashierName || "",
          amountOf(order.itemCount),
          orderAmount(order),
          refundAmount(order),
          netAmount(order),
          order.exchangeSourceReceiptId || "",
          order.voidReason || "",
          PAYMENT_METHOD_LABELS[order.paymentMethod] || PAYMENT_METHOD_LABELS.cash,
          PAYMENT_METHOD_LABELS[order.refundMethod] || "",
          order.adjustmentReason || "",
          order.duplicateConfirmed ? "是" : "",
          order.duplicateSourceReceiptId || "",
        ]),
      ],
      widths: [13, 12, 24, 15, 32, 16, 16, 12, 14, 14, 14, 24, 28, 14, 14, 32, 18, 24],
    },
    {
      name: "商品明細",
      rows: [
        ["日期", "單號", "訂單狀態", "學校", "門店", "開單員工", "款式", "尺碼", "長度", "數量", "單價", "商品小計", "退回標記"],
        ...rows.flatMap((order) => (Array.isArray(order.items) ? order.items : []).map((item) => [
          order.date || "",
          order.id || "",
          isVoided(order) ? "已作廢" : "有效",
          order.school || "",
          outletForOrder?.(order) || order.outletName || order.outlet_name || "",
          order.cashierName || "",
          item.name || "",
          item.size || "",
          item.length || "",
          quantityOf(item),
          amountOf(item.price),
          itemAmount(item),
          item.exchangeReturn ? "退回" : "無退回標記",
        ])),
      ],
      widths: [13, 24, 15, 32, 16, 16, 32, 14, 12, 10, 12, 14, 12],
    },
    ...[
      { name: "按學校", keyOf: (order) => order.school },
      { name: "按門店", keyOf: outletForOrder || ((order) => order.outletName || order.outlet_name) },
      { name: "按員工", keyOf: (order) => order.cashierName },
    ].map(({ name, keyOf }) => ({
      name,
      rows: [
        ["分類", "有效單數", "單據件數", "單據金額", "單據退款", "淨收入"],
        ...groupOrders(rows, keyOf),
      ],
      widths: [32, 14, 14, 16, 16, 16],
    })),
    {
      name: "商品分析",
      rows: [
        ["款式", "尺碼", "長度", "售出數量", "退回數量", "商品售出金額", "商品退回金額", "商品淨額"],
        ...buildProductRows(rows),
      ],
      widths: [32, 14, 12, 12, 12, 18, 18, 16],
    },
  ];
};

export const createSalesExportWorkbook = (xlsx, orders, options = {}) => {
  const workbook = xlsx.utils.book_new();
  buildSalesExportSheets(orders, options).forEach(({ name, rows, widths }) => {
    const worksheet = xlsx.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = widths.map((wch) => ({ wch }));
    if (rows.length > 1 && rows[0].length > 0) {
      worksheet["!autofilter"] = {
        ref: xlsx.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: rows[0].length - 1 } }),
      };
    }
    xlsx.utils.book_append_sheet(workbook, worksheet, name);
  });
  return workbook;
};
