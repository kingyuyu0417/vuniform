import { isExchangeAdjustmentOrder, PAYMENT_METHOD_LABELS, summarizeDailyCloseout } from "./salesCloseout.js";

const amountOf = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const orderAmount = (order) => amountOf(order.total);
const refundAmount = (order) => Math.max(0, amountOf(order.refundDue));
const isVoided = (order) => Boolean(order.voidedAt);
const netAmount = (order) => isVoided(order)
  ? 0
  : orderAmount(order) - (order.replacementSourceReceiptId ? 0 : refundAmount(order));
const quantityOf = (item) => Math.max(0, item.qty === undefined || item.qty === null || item.qty === "" ? 1 : amountOf(item.qty));
const itemAmount = (item) => Math.max(
  0,
  Math.abs(amountOf(item.price)) * quantityOf(item) - Math.max(0, amountOf(item.discountAmount)),
);

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

const buildDailySummaryProductRows = (orders) => buildProductRows(orders)
  .map(([name, size, length, soldQuantity, returnedQuantity]) => [
    name,
    size || "未提供",
    length || "",
    soldQuantity,
    returnedQuantity,
    soldQuantity - returnedQuantity,
  ])
  .sort((first, second) => second[3] - first[3]
    || first[0].localeCompare(second[0], "zh-Hant")
    || first[1].localeCompare(second[1], "zh-Hant")
    || first[2].localeCompare(second[2], "zh-Hant"));

const buildRatioAnalysis = (orders, { genderForItem, activeOrders, netRevenue, closeout }) => {
  const genderGroups = {
    boys: { sold: 0, returned: 0, amount: 0 },
    girls: { sold: 0, returned: 0, amount: 0 },
    unisex: { sold: 0, returned: 0, amount: 0 },
    unknown: { sold: 0, returned: 0, amount: 0 },
  };
  let soldQuantity = 0;
  let returnedQuantity = 0;
  let soldAmount = 0;

  activeOrders.forEach((order) => {
    (Array.isArray(order.items) ? order.items : []).forEach((item) => {
      const quantity = quantityOf(item);
      const amount = itemAmount(item);
      const resolvedGender = genderForItem?.(order, item) || item.gender || "";
      const gender = Object.hasOwn(genderGroups, resolvedGender) ? resolvedGender : "unknown";
      const group = genderGroups[gender];
      if (item.exchangeReturn) {
        returnedQuantity += quantity;
        group.returned += quantity;
      } else {
        soldQuantity += quantity;
        soldAmount += amount;
        group.sold += quantity;
        group.amount += amount;
      }
    });
  });

  const allGenderClassifiedQuantity = genderGroups.boys.sold + genderGroups.girls.sold;
  const totalReceived = closeout.totalReceived;
  const totalRefunded = closeout.totalRefunded;
  const percent = (value, total) => total > 0 ? value / total : null;
  const genders = [
    ["boys", "男生"],
    ["girls", "女生"],
    ["unisex", "男女生"],
    ["unknown", "未分類"],
  ];
  const genderRows = genders.map(([key, label]) => {
    const group = genderGroups[key];
    return [
      label,
      group.sold,
      percent(group.sold, soldQuantity),
      key === "boys" || key === "girls" ? percent(group.sold, allGenderClassifiedQuantity) : null,
      group.amount,
      percent(group.amount, soldAmount),
      group.returned,
    ];
  });
  const paymentRows = Object.entries(PAYMENT_METHOD_LABELS).map(([method, label]) => {
    const channel = closeout.channels[method];
    return [
      label,
      channel.received,
      percent(channel.received, totalReceived),
      channel.refunded,
      percent(channel.refunded, totalRefunded),
    ];
  });
  const averageRevenue = activeOrders.length > 0 ? netRevenue / activeOrders.length : null;
  const averageSoldQuantity = activeOrders.length > 0 ? soldQuantity / activeOrders.length : null;
  const returnRate = percent(returnedQuantity, soldQuantity + returnedQuantity);
  const topProducts = buildDailySummaryProductRows(orders).filter((row) => row[3] > 0).slice(0, 3);
  const conclusions = [];

  if (averageRevenue !== null) conclusions.push(["平均每單淨收入", averageRevenue]);
  if (averageSoldQuantity !== null) conclusions.push(["每有效訂單平均售出件數", averageSoldQuantity]);
  if (topProducts.length > 0) {
    const [name, size, length, quantity] = topProducts[0];
    conclusions.push(["最多售出款式／尺碼", `${name} · ${length ? `${length}/` : ""}${size}：${quantity} 件`]);
  }
  if (allGenderClassifiedQuantity > 0) {
    conclusions.push([
      "男／女商品件數比例",
      `男生 ${genderGroups.boys.sold} 件（${(percent(genderGroups.boys.sold, allGenderClassifiedQuantity) * 100).toFixed(1)}%）；女生 ${genderGroups.girls.sold} 件（${(percent(genderGroups.girls.sold, allGenderClassifiedQuantity) * 100).toFixed(1)}%）`,
    ]);
  } else {
    conclusions.push(["男／女商品件數比例", "沒有足夠已分類男生／女生商品資料；男女生及未分類商品不納入此比例。"]);
  }
  if (totalReceived > 0) {
    const topPayment = paymentRows.reduce((best, row) => row[1] > best[1] ? row : best);
    conclusions.push(["主要收款方式", `${topPayment[0]}：${(topPayment[2] * 100).toFixed(1)}% 實收`]);
  }
  if (returnRate !== null) {
    conclusions.push(["商品退回件數比例", `${(returnRate * 100).toFixed(1)}%（退回件數 ÷ 售出及退回件數）`]);
  }

  const percentageCells = [
    [9, 1],
    ...[12, 13, 14, 15].flatMap((row) => [[row, 2], [row, 5]]),
    [12, 3],
    [13, 3],
    ...[18, 19, 20].flatMap((row) => [[row, 2], [row, 4]]),
    [21, 2],
    [21, 4],
  ];
  const moneyCells = [
    [3, 1],
    [5, 1],
    ...[12, 13, 14, 15].map((row) => [row, 4]),
    ...[18, 19, 20, 21].flatMap((row) => [[row, 1], [row, 3]]),
  ];

  return {
    rows: [
      ["比例及營運分析"],
      ["口徑說明", "男女比例按商品目錄分類，並非客人性別；商品售出額按商品單價及數量計算，與單據淨收入可能不同。"],
      ["營運指標", "數值", "計算口徑"],
      ["當日淨收入", netRevenue, "有效單據收入，按報表淨收入口徑計算"],
      ["有效訂單數", activeOrders.length, "不包括已作廢單"],
      ["平均每單淨收入", averageRevenue, "當日淨收入 ÷ 有效訂單數"],
      ["售出商品件數", soldQuantity, "按有效單商品明細數量，不包括退回商品"],
      ["退回商品件數", returnedQuantity, "只計有標記的退回商品明細"],
      ["每有效訂單平均售出件數", averageSoldQuantity, "售出商品件數 ÷ 有效訂單數"],
      ["退回件數佔商品流量比例", returnRate, "退回件數 ÷（售出件數 + 退回件數）"],
      [],
      ["商品分類", "售出件數", "佔全部售出件數", "佔男／女分類件數", "商品售出額", "佔商品售出額", "退回件數"],
      ...genderRows,
      [],
      ["收款方式", "實收", "佔實收比例", "退款實付", "佔退款實付比例"],
      ...paymentRows,
      ["總計", totalReceived, percent(totalReceived, totalReceived), totalRefunded, percent(totalRefunded, totalRefunded)],
      [],
      ["當日數據結論", "結果"],
      ...conclusions,
    ],
    percentageCells,
    moneyCells,
  };
};

export const buildSalesExportSheets = (orders, {
  outletForOrder,
  genderForItem,
  scope = "",
  reportDateRange = "",
} = {}) => {
  const rows = Array.isArray(orders) ? orders : [];
  const activeOrders = rows.filter((order) => !isVoided(order));
  const dates = [...new Set(rows.map((order) => order.date).filter(Boolean))].sort();
  const totalAmount = activeOrders.reduce((sum, order) => sum + orderAmount(order), 0);
  const totalRefunds = activeOrders.reduce((sum, order) => sum + refundAmount(order), 0);
  const totalQuantity = activeOrders.reduce((sum, order) => sum + amountOf(order.itemCount), 0);
  const netRevenue = activeOrders.reduce((sum, order) => sum + netAmount(order), 0);
  const closeout = summarizeDailyCloseout(rows);
  const dateRange = reportDateRange || (dates.length === 0 ? "無交易" : dates.length === 1 ? dates[0] : `${dates[0]} 至 ${dates.at(-1)}`);
  const ratioAnalysis = buildRatioAnalysis(rows, { genderForItem, activeOrders, netRevenue, closeout });

  return [
    {
      name: "摘要",
      rows: [
        ["銷售摘要"],
        ["報表日期", dateRange],
        ["匯出範圍", scope || "依匯出時套用的日期、門店、學校及搜尋條件"],
        ["當日總收入（已扣單據退款）", netRevenue],
        ["銷售額", totalAmount],
        ["單據退款金額", totalRefunds],
        ["有效單數", activeOrders.length],
        ["已作廢單數", rows.length - activeOrders.length],
        [],
        ["款式", "尺碼", "長度", "售出件數", "退回件數", "淨售件數"],
        ...buildDailySummaryProductRows(rows),
      ],
      widths: [36, 16, 14, 14, 14, 14],
      autoFilterStartRow: 9,
    },
    {
      name: "比例分析",
      rows: ratioAnalysis.rows,
      widths: [34, 20, 20, 20, 20, 20, 14],
      percentageCells: ratioAnalysis.percentageCells,
      moneyCells: ratioAnalysis.moneyCells,
      skipAutoFilter: true,
    },
    {
      name: "閱讀指引",
      rows: [
        ["銷售紀錄分析報表", "說明"],
        ["匯出範圍", scope || "依匯出時套用的日期、門店、學校及搜尋條件"],
        ["摘要工作表", "先查看當日總收入，再按款式、尺碼查看售出、退回及淨售件數；作廢單不計入收入或商品數量。"],
        ["比例分析工作表", "提供平均每單收入及件數、商品分類比例、商品退回件數比例、收款方式比例和按當日資料整理的結論。"],
        ["男女商品比例", "按商品目錄的男生／女生分類，不代表購買者性別；男女生及未能分類的商品會分開顯示。"],
        ["商品分類資料", "訂單明細未保存成交時的商品分類；報表按匯出時的商品目錄配對，目錄分類修改可能影響舊單結果，未能配對會列為未分類。"],
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
        ["日期", "單號", "訂單狀態", "學校", "門店", "開單員工", "款式", "尺碼", "長度", "數量", "單價", "兩件優惠總價", "優惠減免", "商品小計", "退回標記"],
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
          item.twoPiecePrice ?? "",
          Math.max(0, amountOf(item.discountAmount)),
          itemAmount(item),
          item.exchangeReturn ? "退回" : "無退回標記",
        ])),
      ],
      widths: [13, 24, 15, 32, 16, 16, 32, 14, 12, 10, 12, 16, 12, 14, 12],
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
  buildSalesExportSheets(orders, options).forEach(({
    name,
    rows,
    widths,
    autoFilterStartRow = 0,
    percentageCells = [],
    moneyCells = [],
    skipAutoFilter = false,
  }) => {
    const worksheet = xlsx.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = widths.map((wch) => ({ wch }));
    percentageCells.forEach(([row, column]) => {
      const cell = worksheet[xlsx.utils.encode_cell({ r: row, c: column })];
      if (cell && typeof cell.v === "number") cell.z = "0.0%";
    });
    moneyCells.forEach(([row, column]) => {
      const cell = worksheet[xlsx.utils.encode_cell({ r: row, c: column })];
      if (cell && typeof cell.v === "number") cell.z = "$#,##0.00";
    });
    if (!skipAutoFilter && rows.length > autoFilterStartRow + 1 && rows[autoFilterStartRow]?.length > 0) {
      worksheet["!autofilter"] = {
        ref: xlsx.utils.encode_range({
          s: { r: autoFilterStartRow, c: 0 },
          e: { r: rows.length - 1, c: rows[autoFilterStartRow].length - 1 },
        }),
      };
    }
    xlsx.utils.book_append_sheet(workbook, worksheet, name);
  });
  return workbook;
};
