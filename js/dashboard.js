/* ============================================================
   MMV TRADERS ERP V2
   FINAL DASHBOARD ENGINE
   ============================================================

   Direct Firebase Dashboard Loader

   Handles:
   - Today Sales
   - Today Purchase
   - Receivables
   - Payables
   - Stock Value
   - Low Stock
   - Customer Receipts
   - Supplier Payments
   - Monthly Sales
   - Monthly Purchase
   - Recent Activity
   - Business Alerts
   - Auto Refresh

   IMPORTANT:
   This file DOES NOT depend on reports.js
   Dashboard loads Firebase data directly.
============================================================ */

"use strict";


/* ============================================================
   FIREBASE IMPORTS
============================================================ */

import {

    collection,
    getDocs

} from
"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


import {

    onAuthStateChanged

} from
"https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";


import {

    db,
    auth

} from
"./firebase.js";


/* ============================================================
   CONFIG
============================================================ */

const DASHBOARD_REFRESH_MS =
    60000;


/* ============================================================
   STATE
============================================================ */

const dashboardState = {

    user: null,

    loading: false,

    loaded: false,

    sales: [],

    purchases: [],

    customers: [],

    suppliers: [],

    payments: [],

    products: [],

    inventory: [],

    notifications: [],

    lastUpdated: null

};


/* ============================================================
   DOM HELPER
============================================================ */

function dashboardEl(id) {

    return document.getElementById(
        id
    );

}


/* ============================================================
   SAFE NUMBER
============================================================ */

function dashboardNumber(value) {

    if (

        value === null ||

        value === undefined ||

        value === ""

    ) {

        return 0;

    }


    const number =
        Number(
            value
        );


    return Number.isFinite(
        number
    )

        ? number

        : 0;

}


/* ============================================================
   MONEY
============================================================ */

function dashboardAmount(value) {

    return dashboardNumber(
        value
    )
    .toLocaleString(

        "en-IN",

        {

            minimumFractionDigits: 2,

            maximumFractionDigits: 2

        }

    );

}


function dashboardMoney(value) {

    return (

        "₹" +

        dashboardAmount(
            value
        )

    );

}


/* ============================================================
   GET RECORD AMOUNT

   Supports multiple MMV ERP
   field naming formats.
============================================================ */

function getRecordAmount(item) {

    if (!item) {

        return 0;

    }


    const fields = [

        "grandTotal",

        "totalAmount",

        "netTotal",

        "total",

        "invoiceTotal",

        "amount",

        "totalValue",

        "value"

    ];


    for (

        const field
        of fields

    ) {

        const value =
            dashboardNumber(
                item[field]
            );


        if (value !== 0) {

            return value;

        }

    }


    return 0;

}


/* ============================================================
   DATE CONVERTER
============================================================ */

function dashboardDate(value) {

    if (!value) {

        return null;

    }


    try {

        if (

            typeof value.toDate ===
            "function"

        ) {

            const firestoreDate =
                value.toDate();


            if (

                firestoreDate instanceof
                Date &&

                !Number.isNaN(

                    firestoreDate.getTime()

                )

            ) {

                return firestoreDate;

            }

        }


        if (

            value instanceof Date

        ) {

            return Number.isNaN(

                value.getTime()

            )

                ? null

                : value;

        }


        if (

            typeof value ===
            "number"

        ) {

            const date =
                new Date(
                    value
                );


            return Number.isNaN(

                date.getTime()

            )

                ? null

                : date;

        }


        const text =
            String(
                value
            )
            .trim();


        if (!text) {

            return null;

        }


        const isoMatch =
            text.match(

                /^(\d{4})-(\d{2})-(\d{2})/

            );


        if (isoMatch) {

            const date =
                new Date(

                    Number(
                        isoMatch[1]
                    ),

                    Number(
                        isoMatch[2]
                    ) - 1,

                    Number(
                        isoMatch[3]
                    )

                );


            return Number.isNaN(

                date.getTime()

            )

                ? null

                : date;

        }


        const indianMatch =
            text.match(

                /^(\d{2})[\/-](\d{2})[\/-](\d{4})/

            );


        if (indianMatch) {

            const date =
                new Date(

                    Number(
                        indianMatch[3]
                    ),

                    Number(
                        indianMatch[2]
                    ) - 1,

                    Number(
                        indianMatch[1]
                    )

                );


            return Number.isNaN(

                date.getTime()

            )

                ? null

                : date;

        }


        const date =
            new Date(
                text
            );


        return Number.isNaN(

            date.getTime()

        )

            ? null

            : date;

    }

    catch(error) {

        return null;

    }

}


/* ============================================================
   GET RECORD DATE
============================================================ */

function getRecordDate(
    item,
    type = ""
) {

    if (!item) {

        return null;

    }


    let fields = [];


    if (

        type ===
        "sale"

    ) {

        fields = [

            "invoiceDate",

            "saleDate",

            "date",

            "createdAt",

            "updatedAt"

        ];

    }

    else if (

        type ===
        "purchase"

    ) {

        fields = [

            "purchaseDate",

            "invoiceDate",

            "billDate",

            "date",

            "createdAt",

            "updatedAt"

        ];

    }

    else if (

        type ===
        "payment"

    ) {

        fields = [

            "paymentDate",

            "date",

            "createdAt",

            "updatedAt"

        ];

    }

    else {

        fields = [

            "date",

            "createdAt",

            "updatedAt"

        ];

    }


    for (

        const field
        of fields

    ) {

        const date =
            dashboardDate(
                item[field]
            );


        if (date) {

            return date;

        }

    }


    return null;

}


/* ============================================================
   DATE KEY
============================================================ */

function dashboardDateKey(value) {

    const date =
        value instanceof Date

            ? value

            : dashboardDate(
                value
            );


    if (!date) {

        return "";

    }


    const year =
        date.getFullYear();


    const month =
        String(

            date.getMonth() + 1

        )
        .padStart(
            2,
            "0"
        );


    const day =
        String(

            date.getDate()

        )
        .padStart(
            2,
            "0"
        );


    return (

        year +

        "-" +

        month +

        "-" +

        day

    );

}


/* ============================================================
   MONTH KEY
============================================================ */

function dashboardMonthKey(value) {

    const date =
        value instanceof Date

            ? value

            : dashboardDate(
                value
            );


    if (!date) {

        return "";

    }


    return (

        date.getFullYear() +

        "-" +

        String(

            date.getMonth() + 1

        )
        .padStart(
            2,
            "0"
        )

    );

}


/* ============================================================
   TODAY
============================================================ */

function dashboardToday() {

    return dashboardDateKey(
        new Date()
    );

}


/* ============================================================
   CURRENT MONTH
============================================================ */

function dashboardCurrentMonth() {

    return dashboardMonthKey(
        new Date()
    );

}


/* ============================================================
   SAFE TEXT UPDATE
============================================================ */

function setDashboardText(
    ids,
    text
) {

    if (

        !Array.isArray(
            ids
        )

    ) {

        ids = [
            ids
        ];

    }


    ids.forEach(
        id => {

            const node =
                dashboardEl(
                    id
                );


            if (node) {

                node.textContent =
                    text;

            }

        }
    );

}


/* ============================================================
   ESCAPE HTML
============================================================ */

function escapeDashboardHTML(value) {

    return String(

        value ?? ""

    )

    .replace(
        /&/g,
        "&amp;"
    )

    .replace(
        /</g,
        "&lt;"
    )

    .replace(
        />/g,
        "&gt;"
    )

    .replace(
        /"/g,
        "&quot;"
    )

    .replace(
        /'/g,
        "&#039;"
    );

}


/* ============================================================
   FIREBASE COLLECTION LOADER
============================================================ */

async function getCollectionData(
    collectionName
) {

    try {

        const snapshot =
            await getDocs(

                collection(

                    db,

                    collectionName

                )

            );


        return snapshot.docs.map(

            documentSnapshot => (

                {

                    id:
                        documentSnapshot.id,

                    ...documentSnapshot.data()

                }

            )

        );

    }

    catch(error) {

        console.warn(

            `Dashboard collection load failed: ${collectionName}`,

            error

        );


        return [];

    }

}


/* ============================================================
   LOAD DASHBOARD DATA
============================================================ */

async function loadDashboardData(
    force = false
) {

    if (

        dashboardState.loading

    ) {

        return dashboardState;

    }


    if (

        !auth.currentUser &&

        !dashboardState.user

    ) {

        console.warn(

            "Dashboard: Firebase user not authenticated yet."

        );


        return dashboardState;

    }


    if (

        dashboardState.loaded &&

        !force

    ) {

        renderDashboard();

        return dashboardState;

    }


    dashboardState.loading =
        true;


    try {

        const [

            sales,

            purchases,

            customers,

            suppliers,

            payments,

            products,

            inventory,

            notifications

        ] = await Promise.all([

            getCollectionData(
                "sales"
            ),

            getCollectionData(
                "purchases"
            ),

            getCollectionData(
                "customers"
            ),

            getCollectionData(
                "suppliers"
            ),

            getCollectionData(
                "payments"
            ),

            getCollectionData(
                "products"
            ),

            getCollectionData(
                "inventory"
            ),

            getCollectionData(
                "notifications"
            )

        ]);


        dashboardState.sales =
            sales;


        dashboardState.purchases =
            purchases;


        dashboardState.customers =
            customers;


        dashboardState.suppliers =
            suppliers;


        dashboardState.payments =
            payments;


        dashboardState.products =
            products;


        dashboardState.inventory =

            inventory.length

                ? inventory

                : products;


        dashboardState.notifications =
            notifications;


        dashboardState.loaded =
            true;


        dashboardState.lastUpdated =
            new Date();


        window.MMVDashboardData = {

            sales,

            purchases,

            customers,

            suppliers,

            payments,

            products,

            inventory:

                dashboardState.inventory,

            notifications,

            loadedAt:
                dashboardState
                .lastUpdated
                .toISOString()

        };


        renderDashboard();


        console.info(

            "MMV Dashboard data loaded:",

            {

                sales:
                    sales.length,

                purchases:
                    purchases.length,

                customers:
                    customers.length,

                suppliers:
                    suppliers.length,

                payments:
                    payments.length,

                products:
                    products.length,

                inventory:
                    inventory.length

            }

        );


        return dashboardState;

    }

    catch(error) {

        console.error(

            "Dashboard loading error:",

            error

        );


        showDashboardMessage(

            error.message ||

            "Unable to load dashboard.",

            "error"

        );


        return dashboardState;

    }

    finally {

        dashboardState.loading =
            false;

    }

}


/* ============================================================
   TODAY SALES
============================================================ */

function calculateTodaySales() {

    const today =
        dashboardToday();


    return dashboardState.sales

        .filter(
            sale => {

                const date =
                    getRecordDate(

                        sale,

                        "sale"

                    );


                return (

                    dashboardDateKey(
                        date
                    ) === today

                );

            }
        )

        .reduce(

            (
                total,
                sale
            ) =>

                total +

                getRecordAmount(
                    sale
                ),

            0

        );

}


/* ============================================================
   TODAY PURCHASE
============================================================ */

function calculateTodayPurchase() {

    const today =
        dashboardToday();


    return dashboardState.purchases

        .filter(
            purchase => {

                const date =
                    getRecordDate(

                        purchase,

                        "purchase"

                    );


                return (

                    dashboardDateKey(
                        date
                    ) === today

                );

            }
        )

        .reduce(

            (
                total,
                purchase
            ) =>

                total +

                getRecordAmount(
                    purchase
                ),

            0

        );

}


/* ============================================================
   RECEIVABLES
============================================================ */

function calculateCustomerOutstanding() {

    const customerOutstanding =
        dashboardState.customers

        .reduce(

            (
                total,
                customer
            ) =>

                total +

                dashboardNumber(

                    customer.outstanding ??

                    customer.balance ??

                    customer.receivable ??

                    customer.dueAmount ??

                    0

                ),

            0

        );


    if (

        customerOutstanding > 0

    ) {

        return customerOutstanding;

    }


    const totalSales =
        dashboardState.sales

        .reduce(

            (
                total,
                sale
            ) =>

                total +

                getRecordAmount(
                    sale
                ),

            0

        );


    const customerReceipts =
        dashboardState.payments

        .filter(

            payment =>

                getPaymentKind(
                    payment
                ) === "received"

        )

        .reduce(

            (
                total,
                payment
            ) =>

                total +

                getRecordAmount(
                    payment
                ),

            0

        );


    return Math.max(

        0,

        totalSales -

        customerReceipts

    );

}


/* ============================================================
   PAYABLES
============================================================ */

function calculateSupplierOutstanding() {

    const supplierOutstanding =
        dashboardState.suppliers

        .reduce(

            (
                total,
                supplier
            ) =>

                total +

                dashboardNumber(

                    supplier.outstanding ??

                    supplier.balance ??

                    supplier.payable ??

                    supplier.dueAmount ??

                    0

                ),

            0

        );


    if (

        supplierOutstanding > 0

    ) {

        return supplierOutstanding;

    }


    const totalPurchase =
        dashboardState.purchases

        .reduce(

            (
                total,
                purchase
            ) =>

                total +

                getRecordAmount(
                    purchase
                ),

            0

        );


    const supplierPayments =
        dashboardState.payments

        .filter(

            payment =>

                getPaymentKind(
                    payment
                ) === "paid"

        )

        .reduce(

            (
                total,
                payment
            ) =>

                total +

                getRecordAmount(
                    payment
                ),

            0

        );


    return Math.max(

        0,

        totalPurchase -

        supplierPayments

    );

}


/* ============================================================
   STOCK QUANTITY
============================================================ */

function getStockQuantity(item) {

    return dashboardNumber(

        item.quantity ??

        item.stockQty ??

        item.currentStock ??

        item.availableStock ??

        item.qty ??

        0

    );

}


/* ============================================================
   PURCHASE RATE
============================================================ */

function getPurchaseRate(item) {

    return dashboardNumber(

        item.purchaseRate ??

        item.costPrice ??

        item.purchasePrice ??

        item.cost ??

        item.rate ??

        0

    );

}


/* ============================================================
   STOCK VALUE
============================================================ */

function calculateStockValue() {

    const source =

        dashboardState.inventory.length

            ? dashboardState.inventory

            : dashboardState.products;


    return source.reduce(

        (
            total,
            item
        ) => {

            const existingValue =
                dashboardNumber(

                    item.stockValue ??

                    item.inventoryValue ??

                    item.value ??

                    0

                );


            if (

                existingValue > 0

            ) {

                return (

                    total +

                    existingValue

                );

            }


            return (

                total +

                (

                    getStockQuantity(
                        item
                    )

                    *

                    getPurchaseRate(
                        item
                    )

                )

            );

        },

        0

    );

}


/* ============================================================
   LOW STOCK COUNT
============================================================ */

function calculateLowStockCount() {

    const source =

        dashboardState.inventory.length

            ? dashboardState.inventory

            : dashboardState.products;


    return source

        .filter(
            item => {

                const quantity =
                    getStockQuantity(
                        item
                    );


                const minimum =
                    dashboardNumber(

                        item.minimumStock ??

                        item.minStock ??

                        item.reorderLevel ??

                        item.minimumQuantity ??

                        0

                    );


                return (

                    minimum > 0 &&

                    quantity <= minimum

                );

            }
        )

        .length;

}


/* ============================================================
   PAYMENT TYPE
============================================================ */

function getPaymentKind(payment) {

    const text = [

        payment?.type,

        payment?.paymentType,

        payment?.category,

        payment?.direction,

        payment?.partyType,

        payment?.referenceType

    ]

    .filter(Boolean)

    .join(" ")

    .toLowerCase();


    if (

        text.includes(
            "customer"
        ) ||

        text.includes(
            "receive"
        ) ||

        text.includes(
            "receipt"
        ) ||

        text.includes(
            "collection"
        )

    ) {

        return "received";

    }


    if (

        text.includes(
            "supplier"
        ) ||

        text.includes(
            "paid"
        ) ||

        text.includes(
            "purchase"
        ) ||

        text.includes(
            "payment"
        )

    ) {

        return "paid";

    }


    return "";

}


/* ============================================================
   TODAY RECEIPTS
============================================================ */

function calculateTodayReceipts() {

    const today =
        dashboardToday();


    return dashboardState.payments

        .filter(
            payment => {

                const kind =
                    getPaymentKind(
                        payment
                    );


                const date =
                    getRecordDate(

                        payment,

                        "payment"

                    );


                return (

                    kind ===
                    "received"

                    &&

                    dashboardDateKey(
                        date
                    ) === today

                );

            }
        )

        .reduce(

            (
                total,
                payment
            ) =>

                total +

                getRecordAmount(
                    payment
                ),

            0

        );

}


/* ============================================================
   TODAY SUPPLIER PAYMENTS
============================================================ */

function calculateTodaySupplierPayments() {

    const today =
        dashboardToday();


    return dashboardState.payments

        .filter(
            payment => {

                const kind =
                    getPaymentKind(
                        payment
                    );


                const date =
                    getRecordDate(

                        payment,

                        "payment"

                    );


                return (

                    kind ===
                    "paid"

                    &&

                    dashboardDateKey(
                        date
                    ) === today

                );

            }
        )

        .reduce(

            (
                total,
                payment
            ) =>

                total +

                getRecordAmount(
                    payment
                ),

            0

        );

}


/* ============================================================
   TODAY INVOICE COUNT
============================================================ */

function calculateTodayInvoiceCount() {

    const today =
        dashboardToday();


    return dashboardState.sales

        .filter(
            sale =>

                dashboardDateKey(

                    getRecordDate(

                        sale,

                        "sale"

                    )

                ) === today

        )

        .length;

}


/* ============================================================
   TODAY PURCHASE COUNT
============================================================ */

function calculateTodayPurchaseCount() {

    const today =
        dashboardToday();


    return dashboardState.purchases

        .filter(
            purchase =>

                dashboardDateKey(

                    getRecordDate(

                        purchase,

                        "purchase"

                    )

                ) === today

        )

        .length;

}


/* ============================================================
   MONTHLY SALES
============================================================ */

function calculateMonthlySales() {

    const month =
        dashboardCurrentMonth();


    return dashboardState.sales

        .filter(
            sale =>

                dashboardMonthKey(

                    getRecordDate(

                        sale,

                        "sale"

                    )

                ) === month

        )

        .reduce(

            (
                total,
                sale
            ) =>

                total +

                getRecordAmount(
                    sale
                ),

            0

        );

}


/* ============================================================
   MONTHLY PURCHASE
============================================================ */

function calculateMonthlyPurchase() {

    const month =
        dashboardCurrentMonth();


    return dashboardState.purchases

        .filter(
            purchase =>

                dashboardMonthKey(

                    getRecordDate(

                        purchase,

                        "purchase"

                    )

                ) === month

        )

        .reduce(

            (
                total,
                purchase
            ) =>

                total +

                getRecordAmount(
                    purchase
                ),

            0

        );

}


/* ============================================================
   MONTHLY PROFIT
============================================================ */

function calculateMonthlyProfit() {

    return (

        calculateMonthlySales()

        -

        calculateMonthlyPurchase()

    );

}


/* ============================================================
   TODAY PROFIT
============================================================ */

function calculateTodayProfit() {

    return (

        calculateTodaySales()

        -

        calculateTodayPurchase()

    );

}


/* ============================================================
   SALES TREND
============================================================ */

function calculateSalesTrend() {

    const today =
        new Date();


    const previousDate =
        new Date(
            today
        );


    previousDate.setDate(

        previousDate.getDate() - 1

    );


    const todayKey =
        dashboardDateKey(
            today
        );


    const previousKey =
        dashboardDateKey(
            previousDate
        );


    const todaySales =
        dashboardState.sales

        .filter(
            sale =>

                dashboardDateKey(

                    getRecordDate(

                        sale,

                        "sale"

                    )

                ) === todayKey

        )

        .reduce(

            (
                total,
                sale
            ) =>

                total +

                getRecordAmount(
                    sale
                ),

            0

        );


    const previousSales =
        dashboardState.sales

        .filter(
            sale =>

                dashboardDateKey(

                    getRecordDate(

                        sale,

                        "sale"

                    )

                ) === previousKey

        )

        .reduce(

            (
                total,
                sale
            ) =>

                total +

                getRecordAmount(
                    sale
                ),

            0

        );


    if (

        previousSales <= 0

    ) {

        return null;

    }


    return (

        (

            (

                todaySales -

                previousSales

            )

            /

            previousSales

        )

        *

        100

    );

}


/* ============================================================
   RENDER KPI CARDS
============================================================ */

function renderDashboardCards() {

    const todaySales =
        calculateTodaySales();


    const todayPurchase =
        calculateTodayPurchase();


    const receivables =
        calculateCustomerOutstanding();


    const payables =
        calculateSupplierOutstanding();


    const stockValue =
        calculateStockValue();


    const todayProfit =
        calculateTodayProfit();


    const lowStock =
        calculateLowStockCount();


    const trend =
        calculateSalesTrend();


    setDashboardText(

        [

            "todaySales",

            "dashboardTodaySales"

        ],

        dashboardMoney(
            todaySales
        )

    );


    setDashboardText(

        [

            "todayPurchase",

            "dashboardTodayPurchase"

        ],

        dashboardMoney(
            todayPurchase
        )

    );


    setDashboardText(

        [

            "totalReceivables",

            "customerOutstanding",

            "dashboardCustomerOutstanding"

        ],

        dashboardMoney(
            receivables
        )

    );


    setDashboardText(

        [

            "totalPayables",

            "supplierOutstanding",

            "dashboardSupplierOutstanding"

        ],

        dashboardMoney(
            payables
        )

    );


    setDashboardText(

        [

            "stockValue",

            "dashboardStockValue"

        ],

        dashboardMoney(
            stockValue
        )

    );


    setDashboardText(

        [

            "todayProfit",

            "dashboardTodayProfit"

        ],

        dashboardMoney(
            todayProfit
        )

    );


    setDashboardText(

        [

            "lowStockCount",

            "dashboardLowStock"

        ],

        String(
            lowStock
        )

    );


    setDashboardText(

        [

            "todayReceipts",

            "dashboardTodayReceipts"

        ],

        dashboardMoney(

            calculateTodayReceipts()

        )

    );


    setDashboardText(

        [

            "todaySupplierPayments",

            "dashboardTodaySupplierPayments"

        ],

        dashboardMoney(

            calculateTodaySupplierPayments()

        )

    );


    setDashboardText(

        [

            "todayInvoiceCount",

            "dashboardInvoiceCount"

        ],

        String(

            calculateTodayInvoiceCount()

        )

    );


    setDashboardText(

        [

            "todayPurchaseCount",

            "dashboardPurchaseCount"

        ],

        String(

            calculateTodayPurchaseCount()

        )

    );


    setDashboardText(

        [

            "monthlySales",

            "dashboardMonthlySales"

        ],

        dashboardMoney(

            calculateMonthlySales()

        )

    );


    setDashboardText(

        [

            "monthlyPurchase",

            "dashboardMonthlyPurchase"

        ],

        dashboardMoney(

            calculateMonthlyPurchase()

        )

    );


    setDashboardText(

        [

            "monthlyProfit",

            "dashboardMonthlyProfit"

        ],

        dashboardMoney(

            calculateMonthlyProfit()

        )

    );


    const salesTrend =
        dashboardEl(
            "salesTrend"
        );


    if (salesTrend) {

        if (

            trend === null

        ) {

            salesTrend.textContent =
                "—";

            salesTrend.className =
                "trend-up";

        }

        else if (

            trend >= 0

        ) {

            salesTrend.textContent =

                "↑ " +

                trend.toFixed(1) +

                "%";


            salesTrend.className =
                "trend-up";

        }

        else {

            salesTrend.textContent =

                "↓ " +

                Math.abs(
                    trend
                )
                .toFixed(1) +

                "%";


            salesTrend.className =
                "trend-down";

        }

    }

}


/* ============================================================
   RECENT ACTIVITY
============================================================ */

function getActivityTimestamp(
    item,
    type
) {

    const date =
        getRecordDate(
            item,
            type
        );


    return date

        ? date.getTime()

        : 0;

}


function renderRecentActivity() {

    const container =
        dashboardEl(
            "recentActivity"
        );


    if (!container) {

        return;

    }


    const activities = [];


    dashboardState.sales.forEach(

        sale => {

            activities.push({

                type:
                    "sale",

                icon:
                    "↗",

                title:

                    sale.invoiceNumber ??

                    sale.invoiceNo ??

                    "Sales Invoice",

                name:

                    sale.customerName ??

                    sale.customer ??

                    "Walk-in Customer",

                amount:

                    getRecordAmount(
                        sale
                    ),

                date:

                    getRecordDate(

                        sale,

                        "sale"

                    )

            });

        }

    );


    dashboardState.purchases.forEach(

        purchase => {

            activities.push({

                type:
                    "purchase",

                icon:
                    "↙",

                title:

                    purchase.purchaseNumber ??

                    purchase.invoiceNumber ??

                    purchase.billNumber ??

                    "Purchase",

                name:

                    purchase.supplierName ??

                    purchase.supplier ??

                    "Supplier",

                amount:

                    getRecordAmount(
                        purchase
                    ),

                date:

                    getRecordDate(

                        purchase,

                        "purchase"

                    )

            });

        }

    );


    activities.sort(

        (
            a,
            b
        ) =>

            (

                b.date?.getTime?.() ||

                0

            )

            -

            (

                a.date?.getTime?.() ||

                0

            )

    );


    const latest =
        activities.slice(
            0,
            10
        );


    if (

        latest.length === 0

    ) {

        container.innerHTML = `

            <div class="empty-state">
                No recent activity available.
            </div>

        `;

        return;

    }


    container.innerHTML =

        latest

        .map(

            item => {

                const dateText =
                    item.date

                        ? item.date
                            .toLocaleString(

                                "en-IN",

                                {

                                    day:
                                        "2-digit",

                                    month:
                                        "short",

                                    hour:
                                        "2-digit",

                                    minute:
                                        "2-digit"

                                }

                            )

                        : "Recently";


                return `

                    <div class="activity-item">

                        <div class="activity-dot">
                            ${escapeDashboardHTML(
                                item.icon
                            )}
                        </div>

                        <div class="activity-content">

                            <div class="activity-title">
                                ${escapeDashboardHTML(
                                    item.title
                                )}
                            </div>

                            <div class="activity-meta">
                                ${escapeDashboardHTML(
                                    item.name
                                )}
                                ·
                                ${escapeDashboardHTML(
                                    dateText
                                )}
                            </div>

                        </div>

                        <div class="activity-amount">

                            ${dashboardMoney(
                                item.amount
                            )}

                        </div>

                    </div>

                `;

            }

        )

        .join("");

}


/* ============================================================
   LOW STOCK ALERTS
============================================================ */

function getLowStockItems() {

    const source =

        dashboardState.inventory.length

            ? dashboardState.inventory

            : dashboardState.products;


    return source

        .filter(
            item => {

                const quantity =
                    getStockQuantity(
                        item
                    );


                const minimum =
                    dashboardNumber(

                        item.minimumStock ??

                        item.minStock ??

                        item.reorderLevel ??

                        item.minimumQuantity ??

                        0

                    );


                return (

                    minimum > 0 &&

                    quantity <= minimum

                );

            }
        )

        .sort(

            (
                a,
                b
            ) =>

                getStockQuantity(
                    a
                )

                -

                getStockQuantity(
                    b
                )

        );

}


/* ============================================================
   BUSINESS ALERTS
============================================================ */

function renderDashboardAlerts() {

    const container =
        dashboardEl(
            "dashboardAlerts"
        );


    if (!container) {

        return;

    }


    const alerts = [];


    const lowStockItems =
        getLowStockItems();


    lowStockItems

        .slice(
            0,
            3
        )

        .forEach(
            item => {

                const name =

                    item.productName ??

                    item.materialName ??

                    item.itemName ??

                    item.name ??

                    "Product";


                alerts.push({

                    title:
                        "Low Stock",

                    message:

                        `${name} has only ` +

                        `${getStockQuantity(item)} ` +

                        `units available.`

                });

            }

        );


    const receivables =
        calculateCustomerOutstanding();


    if (

        receivables > 0

    ) {

        alerts.push({

            title:
                "Customer Receivables",

            message:

                `${dashboardMoney(receivables)} ` +

                `is currently outstanding.`

        });

    }


    const payables =
        calculateSupplierOutstanding();


    if (

        payables > 0

    ) {

        alerts.push({

            title:
                "Supplier Payables",

            message:

                `${dashboardMoney(payables)} ` +

                `is pending to suppliers.`

        });

    }


    if (

        alerts.length === 0

    ) {

        container.innerHTML = `

            <div class="empty-state">
                No critical alerts.
            </div>

        `;

        return;

    }


    container.innerHTML =

        alerts

        .slice(
            0,
            4
        )

        .map(

            alert => `

                <div class="alert-item">

                    <div class="alert-icon">
                        !
                    </div>

                    <div>

                        <div class="alert-title">

                            ${escapeDashboardHTML(
                                alert.title
                            )}

                        </div>

                        <div class="alert-text">

                            ${escapeDashboardHTML(
                                alert.message
                            )}

                        </div>

                    </div>

                </div>

            `

        )

        .join("");

}


/* ============================================================
   NOTIFICATION BADGE
============================================================ */

function updateNotificationBadge() {

    const badge =
        dashboardEl(
            "notificationBadge"
        );


    if (!badge) {

        return;

    }


    const unread =
        dashboardState.notifications

        .filter(
            item =>

                !item.read

        )

        .length;


    if (

        unread > 0

    ) {

        badge.style.display =
            "flex";


        badge.textContent =

            unread > 99

                ? "99+"

                : String(
                    unread
                );

    }

    else {

        badge.style.display =
            "none";

    }

}


/* ============================================================
   LAST UPDATED
============================================================ */

function updateLastUpdated() {

    if (

        !dashboardState.lastUpdated

    ) {

        return;

    }


    setDashboardText(

        [

            "dashboardLastUpdated",

            "lastDashboardUpdate"

        ],

        dashboardState.lastUpdated
        .toLocaleTimeString(

            "en-IN",

            {

                hour:
                    "2-digit",

                minute:
                    "2-digit"

            }

        )

    );

}


/* ============================================================
   RENDER ALL
============================================================ */

function renderDashboard() {

    renderDashboardCards();

    renderRecentActivity();

    renderDashboardAlerts();

    updateNotificationBadge();

    updateLastUpdated();

}


/* ============================================================
   SNAPSHOT
============================================================ */

function getDashboardSnapshot() {

    return {

        todaySales:
            calculateTodaySales(),

        todayPurchase:
            calculateTodayPurchase(),

        todayProfit:
            calculateTodayProfit(),

        customerOutstanding:
            calculateCustomerOutstanding(),

        supplierOutstanding:
            calculateSupplierOutstanding(),

        stockValue:
            calculateStockValue(),

        lowStock:
            calculateLowStockCount(),

        todayReceipts:
            calculateTodayReceipts(),

        todaySupplierPayments:
            calculateTodaySupplierPayments(),

        todayInvoiceCount:
            calculateTodayInvoiceCount(),

        todayPurchaseCount:
            calculateTodayPurchaseCount(),

        monthlySales:
            calculateMonthlySales(),

        monthlyPurchase:
            calculateMonthlyPurchase(),

        monthlyProfit:
            calculateMonthlyProfit(),

        lastUpdated:
            dashboardState.lastUpdated

    };

}


/* ============================================================
   REFRESH
============================================================ */

async function refreshDashboard() {

    return loadDashboardData(
        true
    );

}


/* ============================================================
   AUTO REFRESH
============================================================ */

let dashboardRefreshTimer =
    null;


function startDashboardAutoRefresh() {

    stopDashboardAutoRefresh();


    dashboardRefreshTimer =
        window.setInterval(

            () => {

                refreshDashboard()
                .catch(

                    error =>

                        console.warn(

                            "Dashboard auto refresh failed:",

                            error

                        )

                );

            },

            DASHBOARD_REFRESH_MS

        );

}


function stopDashboardAutoRefresh() {

    if (

        dashboardRefreshTimer

    ) {

        window.clearInterval(
            dashboardRefreshTimer
        );


        dashboardRefreshTimer =
            null;

    }

}


/* ============================================================
   MANUAL REFRESH BUTTON
============================================================ */

function bindDashboardRefresh() {

    document

    .querySelectorAll(
        "[data-dashboard-refresh]"
    )

    .forEach(
        button => {

            if (

                button.dataset
                .dashboardRefreshBound ===
                "true"

            ) {

                return;

            }


            button.dataset
                .dashboardRefreshBound =
                "true";


            button.addEventListener(

                "click",

                async () => {

                    const originalText =
                        button.textContent;


                    button.disabled =
                        true;


                    button.textContent =
                        "Refreshing...";


                    try {

                        await refreshDashboard();


                        showDashboardMessage(

                            "Dashboard updated.",

                            "success"

                        );

                    }

                    catch(error) {

                        showDashboardMessage(

                            error.message ||

                            "Unable to refresh dashboard.",

                            "error"

                        );

                    }

                    finally {

                        button.disabled =
                            false;


                        button.textContent =
                            originalText;

                    }

                }

            );

        }

    );

}


/* ============================================================
   MESSAGE
============================================================ */

function showDashboardMessage(
    message,
    type = "info"
) {

    let box =
        dashboardEl(
            "mmvDashboardMessage"
        );


    if (!box) {

        box =
            document.createElement(
                "div"
            );


        box.id =
            "mmvDashboardMessage";


        Object.assign(

            box.style,

            {

                position:
                    "fixed",

                right:
                    "18px",

                bottom:
                    "18px",

                zIndex:
                    "99999",

                maxWidth:
                    "390px",

                padding:
                    "14px 17px",

                borderRadius:
                    "12px",

                fontSize:
                    "13px",

                fontWeight:
                    "700",

                boxShadow:
                    "0 14px 35px rgba(0,0,0,.16)"

            }

        );


        document.body.appendChild(
            box
        );

    }


    box.textContent =
        message;


    if (

        type ===
        "error"

    ) {

        box.style.background =
            "#fff0f0";

        box.style.color =
            "#b42318";

    }

    else if (

        type ===
        "success"

    ) {

        box.style.background =
            "#ecfdf3";

        box.style.color =
            "#027a48";

    }

    else {

        box.style.background =
            "#eef5ff";

        box.style.color =
            "#174a91";

    }


    window.clearTimeout(
        box._timer
    );


    box._timer =
        window.setTimeout(

            () => {

                box.remove();

            },

            3500

        );

}


/* ============================================================
   AUTH STATE
============================================================ */

onAuthStateChanged(

    auth,

    async user => {

        dashboardState.user =
            user || null;


        if (!user) {

            dashboardState.loaded =
                false;


            console.warn(

                "Dashboard: User not authenticated."

            );


            return;

        }


        try {

            await loadDashboardData(
                true
            );

        }

        catch(error) {

            console.error(

                "Dashboard initial load failed:",

                error

            );

        }

    }

);


/* ============================================================
   PAGE VISIBLE REFRESH
============================================================ */

document.addEventListener(

    "visibilitychange",

    () => {

        if (

            document.visibilityState ===
            "visible" &&

            auth.currentUser

        ) {

            refreshDashboard()
            .catch(

                error =>

                    console.warn(

                        "Dashboard visibility refresh failed:",

                        error

                    )

            );

        }

    }

);


/* ============================================================
   DOM READY
============================================================ */

document.addEventListener(

    "DOMContentLoaded",

    () => {

        bindDashboardRefresh();

        startDashboardAutoRefresh();

    }

);


/* ============================================================
   GLOBAL API
============================================================ */

window.MMVDashboard = {

    state:
        dashboardState,

    loadDashboardData,

    refreshDashboard,

    renderDashboard,

    getDashboardSnapshot,

    calculateTodaySales,

    calculateTodayPurchase,

    calculateTodayProfit,

    calculateCustomerOutstanding,

    calculateSupplierOutstanding,

    calculateStockValue,

    calculateLowStockCount,

    calculateTodayReceipts,

    calculateTodaySupplierPayments,

    calculateMonthlySales,

    calculateMonthlyPurchase,

    calculateMonthlyProfit,

    startDashboardAutoRefresh,

    stopDashboardAutoRefresh

};


window.loadDashboardData =
    loadDashboardData;


window.refreshDashboard =
    refreshDashboard;


window.renderDashboard =
    renderDashboard;


console.info(
    "%cMMV Dashboard Final Firebase Engine ready",
    "font-weight:800;color:#0a3d91;"
);
