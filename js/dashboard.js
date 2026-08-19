/* ============================================================
   MMV TRADERS ERP V2
   DASHBOARD SERVICE
   ------------------------------------------------------------
   Handles:
   - Today Sales
   - Today Purchase
   - Today Profit
   - Customer Outstanding
   - Supplier Outstanding
   - Stock Value
   - Low Stock
   - Customer Receipts
   - Supplier Payments
   - Monthly Sales
   - Monthly Purchase
   - Recent Transactions
   - Auto Refresh
   ============================================================ */

"use strict";


/* ============================================================
   CONFIG
   ============================================================ */

const DASHBOARD_REFRESH_MS =
    60000;


/* ============================================================
   STATE
   ============================================================ */

const dashboardState = {

    sales: [],

    purchases: [],

    salesItems: [],
purchaseItems: [],
    customers: [],

    suppliers: [],

    payments: [],

    inventory: [],

    lastUpdated: null

};


/* ============================================================
   HELPERS
   ============================================================ */

function dashboardEl(id) {

    return document.getElementById(id);

}


function dashboardNumber(value) {

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : 0;

}


function dashboardAmount(value) {

    return dashboardNumber(
        value
    ).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );

}


function dashboardDate(value) {

    if (!value) {

        return "";

    }


    try {

        const date =
            typeof value.toDate ===
            "function"
                ? value.toDate()
                : new Date(value);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "";

        }


        return date;

    }
    catch {

        return "";

    }

}


function dashboardDateKey(value) {

    const date =
        dashboardDate(
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
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}`;

}


function dashboardToday() {

    const now =
        new Date();


    return dashboardDateKey(
        now
    );

}


function dashboardMonthKey(value) {

    const date =
        dashboardDate(
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
        ).padStart(
            2,
            "0"
        )
    );

}


function dashboardCurrentMonth() {

    return dashboardMonthKey(
        new Date()
    );

}


function setDashboardText(
    ids,
    text
) {

    if (!Array.isArray(ids)) {

        ids = [ids];

    }


    for (
        const id of ids
    ) {

        const node =
            dashboardEl(
                id
            );


        if (node) {

            node.textContent =
                text;

            return;

        }

    }

}


function escapeDashboardHTML(
    value
) {

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
   TODAY SALES
   ============================================================ */

function calculateTodaySales() {

    const today =
        dashboardToday();


    return dashboardState.sales
        .filter(
            sale =>
                dashboardDateKey(
                    sale.invoiceDate ||
                    sale.createdAt
                ) === today
        )
        .reduce(
            (
                total,
                sale
            ) =>
                total +
                dashboardNumber(
                    sale.totalAmount
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
            purchase =>
                dashboardDateKey(
                    purchase.invoiceDate ||
                    purchase.createdAt
                ) === today
        )
        .reduce(
            (
                total,
                purchase
            ) =>
                total +
                dashboardNumber(
                    purchase.totalAmount
                ),
            0
        );

}


/* ============================================================
   TODAY PROFIT
   ============================================================ */

function calculateTodayProfit() {

    const today =
        dashboardToday();


    return dashboardState.salesItems
        .filter(
            item =>
                dashboardDateKey(
                    item.createdAt
                ) === today
        )
        .reduce(
            (
                total,
                item
            ) =>
                total +
                dashboardNumber(
                    item.profit
                ),
            0
        );

}


/* ============================================================
   CUSTOMER OUTSTANDING
   ============================================================ */

function calculateCustomerOutstanding() {

    return dashboardState.customers
        .reduce(
            (
                total,
                customer
            ) =>
                total +
                dashboardNumber(
                    customer.outstanding
                ),
            0
        );

}


/* ============================================================
   SUPPLIER OUTSTANDING
   ============================================================ */

function calculateSupplierOutstanding() {

    return dashboardState.suppliers
        .reduce(
            (
                total,
                supplier
            ) =>
                total +
                dashboardNumber(
                    supplier.outstanding ??
                    supplier.payable
                ),
            0
        );

}


/* ============================================================
   STOCK VALUE
   ============================================================ */

function calculateStockValue() {

    return dashboardState.inventory
        .reduce(
            (
                total,
                item
            ) => {

                const stockValue =
                    dashboardNumber(
                        item.stockValue
                    );


                if (
                    stockValue > 0
                ) {

                    return (
                        total +
                        stockValue
                    );

                }


                return (
                    total +
                    (
                        dashboardNumber(
                            item.quantity
                        ) *
                        dashboardNumber(
                            item.purchaseRate
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

    return dashboardState.inventory
        .filter(
            item => {

                const quantity =
                    dashboardNumber(
                        item.quantity
                    );


                const minimum =
                    dashboardNumber(
                        item.minimumStock ??
                        item.minStock ??
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
   CUSTOMER RECEIPTS TODAY
   ============================================================ */

function calculateTodayReceipts() {

    const today =
        dashboardToday();


    return dashboardState.payments
        .filter(
            payment =>
                payment.type ===
                "CUSTOMER" &&
                dashboardDateKey(
                    payment.paymentDate ||
                    payment.createdAt
                ) === today
        )
        .reduce(
            (
                total,
                payment
            ) =>
                total +
                dashboardNumber(
                    payment.amount
                ),
            0
        );

}


/* ============================================================
   SUPPLIER PAYMENTS TODAY
   ============================================================ */

function calculateTodaySupplierPayments() {

    const today =
        dashboardToday();


    return dashboardState.payments
        .filter(
            payment =>
                payment.type ===
                "SUPPLIER" &&
                dashboardDateKey(
                    payment.paymentDate ||
                    payment.createdAt
                ) === today
        )
        .reduce(
            (
                total,
                payment
            ) =>
                total +
                dashboardNumber(
                    payment.amount
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
                    sale.invoiceDate ||
                    sale.createdAt
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
                    purchase.invoiceDate ||
                    purchase.createdAt
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
                    sale.invoiceDate ||
                    sale.createdAt
                ) === month
        )
        .reduce(
            (
                total,
                sale
            ) =>
                total +
                dashboardNumber(
                    sale.totalAmount
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
                    purchase.invoiceDate ||
                    purchase.createdAt
                ) === month
        )
        .reduce(
            (
                total,
                purchase
            ) =>
                total +
                dashboardNumber(
                    purchase.totalAmount
                ),
            0
        );

}


/* ============================================================
   MONTHLY PROFIT
   ============================================================ */

function calculateMonthlyProfit() {

    const month =
        dashboardCurrentMonth();


    return dashboardState.salesItems
        .filter(
            item =>
                dashboardMonthKey(
                    item.createdAt
                ) === month
        )
        .reduce(
            (
                total,
                item
            ) =>
                total +
                dashboardNumber(
                    item.profit
                ),
            0
        );

}


/* ============================================================
   RENDER MAIN CARDS
   ============================================================ */

function renderDashboardCards() {

    const todaySales =
        calculateTodaySales();


    const todayPurchase =
        calculateTodayPurchase();


    const todayProfit =
        calculateTodayProfit();


    const customerOutstanding =
        calculateCustomerOutstanding();


    const supplierOutstanding =
        calculateSupplierOutstanding();


    const stockValue =
        calculateStockValue();


    const lowStock =
        calculateLowStockCount();


    const todayReceipts =
        calculateTodayReceipts();


    const todaySupplierPayments =
        calculateTodaySupplierPayments();


    const invoiceCount =
        calculateTodayInvoiceCount();


    const purchaseCount =
        calculateTodayPurchaseCount();


    const monthlySales =
        calculateMonthlySales();


    const monthlyPurchase =
        calculateMonthlyPurchase();


    const monthlyProfit =
        calculateMonthlyProfit();


    setDashboardText(
        [
            "todaySales",
            "dashboardTodaySales"
        ],
        "₹" +
        dashboardAmount(
            todaySales
        )
    );


    setDashboardText(
        [
            "todayPurchase",
            "dashboardTodayPurchase"
        ],
        "₹" +
        dashboardAmount(
            todayPurchase
        )
    );


    setDashboardText(
        [
            "todayProfit",
            "dashboardTodayProfit"
        ],
        "₹" +
        dashboardAmount(
            todayProfit
        )
    );


    setDashboardText(
        [
            "customerOutstanding",
            "dashboardCustomerOutstanding"
        ],
        "₹" +
        dashboardAmount(
            customerOutstanding
        )
    );


    setDashboardText(
        [
            "supplierOutstanding",
            "dashboardSupplierOutstanding"
        ],
        "₹" +
        dashboardAmount(
            supplierOutstanding
        )
    );


    setDashboardText(
        [
            "stockValue",
            "dashboardStockValue"
        ],
        "₹" +
        dashboardAmount(
            stockValue
        )
    );


    setDashboardText(
        [
            "lowStockCount",
            "dashboardLowStock"
        ],
        lowStock
    );


    setDashboardText(
        [
            "todayReceipts",
            "dashboardTodayReceipts"
        ],
        "₹" +
        dashboardAmount(
            todayReceipts
        )
    );


    setDashboardText(
        [
            "todaySupplierPayments",
            "dashboardTodaySupplierPayments"
        ],
        "₹" +
        dashboardAmount(
            todaySupplierPayments
        )
    );


    setDashboardText(
        [
            "todayInvoiceCount",
            "dashboardInvoiceCount"
        ],
        invoiceCount
    );


    setDashboardText(
        [
            "todayPurchaseCount",
            "dashboardPurchaseCount"
        ],
        purchaseCount
    );


    setDashboardText(
        [
            "monthlySales",
            "dashboardMonthlySales"
        ],
        "₹" +
        dashboardAmount(
            monthlySales
        )
    );


    setDashboardText(
        [
            "monthlyPurchase",
            "dashboardMonthlyPurchase"
        ],
        "₹" +
        dashboardAmount(
            monthlyPurchase
        )
    );


    setDashboardText(
        [
            "monthlyProfit",
            "dashboardMonthlyProfit"
        ],
        "₹" +
        dashboardAmount(
            monthlyProfit
        )
    );

}


/* ============================================================
   RECENT SALES
   ============================================================ */

function renderRecentSales() {

    const container =
        dashboardEl(
            "recentSales"
        );


    if (!container) {

        return;

    }


    const sales =
        [
            ...dashboardState.sales
        ]
        .sort(
            (
                a,
                b
            ) => {

                const dateA =
                    dashboardDate(
                        a.createdAt
                    )?.getTime() ||
                    0;


                const dateB =
                    dashboardDate(
                        b.createdAt
                    )?.getTime() ||
                    0;


                return dateB -
                    dateA;

            }
        )
        .slice(
            0,
            8
        );


    if (
        sales.length ===
        0
    ) {

        container.innerHTML = `

            <div class="empty-state">

                <strong>
                    No recent sales
                </strong>

                <span>
                    Sales invoices will appear here.
                </span>

            </div>

        `;

        return;

    }


    container.innerHTML =
        sales
            .map(
                sale => `

                    <div
                        class="dashboard-activity-row"
                    >

                        <div>

                            <strong>
                                ${escapeDashboardHTML(
                                    sale.invoiceNumber
                                )}
                            </strong>

                            <small>
                                ${escapeDashboardHTML(
                                    sale.customerName ||
                                    "Walk-in Customer"
                                )}
                            </small>

                        </div>

                        <strong>
                            ₹${dashboardAmount(
                                sale.totalAmount
                            )}
                        </strong>

                    </div>

                `
            )
            .join("");

}


/* ============================================================
   RECENT PURCHASES
   ============================================================ */

function renderRecentPurchases() {

    const container =
        dashboardEl(
            "recentPurchases"
        );


    if (!container) {

        return;

    }


    const purchases =
        [
            ...dashboardState.purchases
        ]
        .sort(
            (
                a,
                b
            ) => {

                const dateA =
                    dashboardDate(
                        a.createdAt
                    )?.getTime() ||
                    0;


                const dateB =
                    dashboardDate(
                        b.createdAt
                    )?.getTime() ||
                    0;


                return dateB -
                    dateA;

            }
        )
        .slice(
            0,
            8
        );


    if (
        purchases.length ===
        0
    ) {

        container.innerHTML = `

            <div class="empty-state">

                <strong>
                    No recent purchases
                </strong>

                <span>
                    Purchase invoices will appear here.
                </span>

            </div>

        `;

        return;

    }


    container.innerHTML =
        purchases
            .map(
                purchase => `

                    <div
                        class="dashboard-activity-row"
                    >

                        <div>

                            <strong>
                                ${escapeDashboardHTML(
                                    purchase.invoiceNumber
                                )}
                            </strong>

                            <small>
                                ${escapeDashboardHTML(
                                    purchase.supplierName ||
                                    "-"
                                )}
                            </small>

                        </div>

                        <strong>
                            ₹${dashboardAmount(
                                purchase.totalAmount
                            )}
                        </strong>

                    </div>

                `
            )
            .join("");

}


/* ============================================================
   LOW STOCK
   ============================================================ */

function renderLowStock() {

    const container =
        dashboardEl(
            "lowStockList"
        );


    if (!container) {

        return;

    }


    const items =
        dashboardState.inventory
            .filter(
                item => {

                    const quantity =
                        dashboardNumber(
                            item.quantity
                        );


                    const minimum =
                        dashboardNumber(
                            item.minimumStock ??
                            item.minStock ??
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
                    dashboardNumber(
                        a.quantity
                    ) -
                    dashboardNumber(
                        b.quantity
                    )
            )
            .slice(
                0,
                10
            );


    if (
        items.length ===
        0
    ) {

        container.innerHTML = `

            <div class="empty-state">

                <strong>
                    Stock level looks good
                </strong>

                <span>
                    No low-stock items right now.
                </span>

            </div>

        `;

        return;

    }


    container.innerHTML =
        items
            .map(
                item => `

                    <div
                        class="dashboard-stock-row"
                    >

                        <div>

                            <strong>
                                ${escapeDashboardHTML(
                                    item.materialName ||
                                    item.name ||
                                    "-"
                                )}
                            </strong>

                            <small>
                                Min:
                                ${dashboardAmount(
                                    item.minimumStock ??
                                    item.minStock
                                )}
                            </small>

                        </div>

                        <strong>
                            ${dashboardAmount(
                                item.quantity
                            )}
                        </strong>

                    </div>

                `
            )
            .join("");

}


/* ============================================================
   MONTHLY TREND
   ============================================================ */

function calculateMonthlyTrend() {

    const result = [];


    const now =
        new Date();


    for (
        let index = 5;
        index >= 0;
        index--
    ) {

        const date =
            new Date(
                now.getFullYear(),
                now.getMonth() -
                index,
                1
            );


        const key =
            dashboardMonthKey(
                date
            );


        const label =
            date.toLocaleDateString(
                "en-IN",
                {
                    month:
                        "short"
                }
            );


        const sales =
            dashboardState.sales
                .filter(
                    sale =>
                        dashboardMonthKey(
                            sale.invoiceDate ||
                            sale.createdAt
                        ) === key
                )
                .reduce(
                    (
                        total,
                        sale
                    ) =>
                        total +
                        dashboardNumber(
                            sale.totalAmount
                        ),
                    0
                );


        const purchases =
            dashboardState.purchases
                .filter(
                    purchase =>
                        dashboardMonthKey(
                            purchase.invoiceDate ||
                            purchase.createdAt
                        ) === key
                )
                .reduce(
                    (
                        total,
                        purchase
                    ) =>
                        total +
                        dashboardNumber(
                            purchase.totalAmount
                        ),
                    0
                );


        result.push({

            key,

            label,

            sales,

            purchases

        });

    }


    return result;

}


/* ============================================================
   RENDER MONTHLY TREND
   ============================================================ */

function renderMonthlyTrend() {

    const container =
        dashboardEl(
            "monthlyTrend"
        );


    if (!container) {

        return;

    }


    const trend =
        calculateMonthlyTrend();


    const maxValue =
        Math.max(
            ...trend.map(
                item =>
                    Math.max(
                        item.sales,
                        item.purchases
                    )
            ),
            1
        );


    container.innerHTML =
        trend
            .map(
                item => {

                    const salesPercent =
                        (
                            item.sales /
                            maxValue
                        ) *
                        100;


                    const purchasePercent =
                        (
                            item.purchases /
                            maxValue
                        ) *
                        100;


                    return `

                        <div
                            class="dashboard-trend-row"
                        >

                            <div
                                class="dashboard-trend-label"
                            >
                                ${escapeDashboardHTML(
                                    item.label
                                )}
                            </div>


                            <div
                                class="dashboard-trend-bars"
                            >

                                <div
                                    class="dashboard-bar sales-bar"
                                    style="width:${salesPercent}%"
                                    title="Sales ₹${dashboardAmount(
                                        item.sales
                                    )}"
                                ></div>


                                <div
                                    class="dashboard-bar purchase-bar"
                                    style="width:${purchasePercent}%"
                                    title="Purchase ₹${dashboardAmount(
                                        item.purchases
                                    )}"
                                ></div>

                            </div>


                            <div
                                class="dashboard-trend-value"
                            >
                                ₹${dashboardAmount(
                                    item.sales
                                )}
                            </div>

                        </div>

                    `;

                }
            )
            .join("");

}


/* ============================================================
   DASHBOARD SNAPSHOT
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
   RENDER ALL
   ============================================================ */

function renderDashboard() {

    renderDashboardCards();

    renderRecentSales();

    renderRecentPurchases();

    renderLowStock();

    renderMonthlyTrend();


    dashboardState.lastUpdated =
        new Date();


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
   LOAD DASHBOARD DATA
   ============================================================ */

async function loadDashboardData() {

    try {

        let loaded = false;

        /*
         * ========================================================
         * LOAD FROM MMV REPORTS SERVICE
         * ========================================================
         */

        if (
            window.MMVReports &&
            typeof window.MMVReports.getReportSnapshot === "function"
        ) {

            try {

                const snapshot =
                    window.MMVReports.getReportSnapshot();

                if (snapshot) {

                    if (Array.isArray(snapshot.sales)) {
                        dashboardState.sales =
                            snapshot.sales;
                    }

                    if (Array.isArray(snapshot.salesItems)) {
                        dashboardState.salesItems =
                            snapshot.salesItems;
                    }

                    if (Array.isArray(snapshot.purchases)) {
                        dashboardState.purchases =
                            snapshot.purchases;
                    }

                    if (Array.isArray(snapshot.purchaseItems)) {
                        dashboardState.purchaseItems =
                            snapshot.purchaseItems;
                    }

                    if (Array.isArray(snapshot.customers)) {
                        dashboardState.customers =
                            snapshot.customers;
                    }

                    if (Array.isArray(snapshot.suppliers)) {
                        dashboardState.suppliers =
                            snapshot.suppliers;
                    }

                    if (Array.isArray(snapshot.payments)) {
                        dashboardState.payments =
                            snapshot.payments;
                    }

                    if (Array.isArray(snapshot.inventory)) {
                        dashboardState.inventory =
                            snapshot.inventory;
                    }

                    loaded = true;
                }

            }
            catch (reportError) {

                console.warn(
                    "MMV Reports snapshot load warning:",
                    reportError
                );

            }

        }


        /*
         * ========================================================
         * FALLBACK
         * ========================================================
         *
         * Some versions of reports.js may expose
         * loadReportData globally.
         */

        if (
            !loaded &&
            typeof window.loadReportData === "function"
        ) {

            try {

                const data =
                    await window.loadReportData();

                if (data) {

                    if (Array.isArray(data.sales)) {
                        dashboardState.sales =
                            data.sales;
                    }

                    if (Array.isArray(data.salesItems)) {
                        dashboardState.salesItems =
                            data.salesItems;
                    }

                    if (Array.isArray(data.purchases)) {
                        dashboardState.purchases =
                            data.purchases;
                    }

                    if (Array.isArray(data.purchaseItems)) {
                        dashboardState.purchaseItems =
                            data.purchaseItems;
                    }

                    if (Array.isArray(data.customers)) {
                        dashboardState.customers =
                            data.customers;
                    }

                    if (Array.isArray(data.suppliers)) {
                        dashboardState.suppliers =
                            data.suppliers;
                    }

                    if (Array.isArray(data.payments)) {
                        dashboardState.payments =
                            data.payments;
                    }

                    if (Array.isArray(data.inventory)) {
                        dashboardState.inventory =
                            data.inventory;
                    }

                }

            }
            catch (fallbackError) {

                console.warn(
                    "Dashboard report fallback warning:",
                    fallbackError
                );

            }

        }


        /*
         * ========================================================
         * RENDER DASHBOARD
         * ========================================================
         */

        renderDashboard();


        dashboardState.lastUpdated =
            new Date();


        /*
         * ========================================================
         * DEBUG INFORMATION
         * ========================================================
         */

        console.info(
            "MMV Dashboard loaded:",
            {
                sales:
                    dashboardState.sales.length,

                salesItems:
                    dashboardState.salesItems.length,

                purchases:
                    dashboardState.purchases.length,

                purchaseItems:
                    dashboardState.purchaseItems.length,

                customers:
                    dashboardState.customers.length,

                suppliers:
                    dashboardState.suppliers.length,

                payments:
                    dashboardState.payments.length,

                inventory:
                    dashboardState.inventory.length
            }
        );


        return dashboardState;

    }
    catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );


        /*
         * Don't destroy existing data
         * when refresh fails.
         */

        renderDashboard();


        showDashboardMessage(
            error.message ||
            "Unable to load dashboard.",
            "error"
        );


        return dashboardState;

    }

}
/* ============================================================
   REFRESH
   ============================================================ */

async function refreshDashboard() {

    await loadDashboardData();

}


/* ============================================================
   AUTO REFRESH
   ============================================================ */

let dashboardRefreshTimer =
    null;


function startDashboardAutoRefresh() {

    if (
        dashboardRefreshTimer
    ) {

        clearInterval(
            dashboardRefreshTimer
        );

    }


    dashboardRefreshTimer =
        setInterval(
            () => {

                refreshDashboard();

            },
            DASHBOARD_REFRESH_MS
        );

}


/* ============================================================
   STOP REFRESH
   ============================================================ */

function stopDashboardAutoRefresh() {

    if (
        dashboardRefreshTimer
    ) {

        clearInterval(
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

    const buttons =
        document.querySelectorAll(
            "[data-dashboard-refresh]"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                async () => {

                    button.disabled =
                        true;


                    const originalText =
                        button.textContent;


                    button.textContent =
                        "Refreshing...";


                    try {

                        await refreshDashboard();

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
    else {

        box.style.background =
            "#eef5ff";

        box.style.color =
            "#174a91";

    }


    clearTimeout(
        box._timer
    );


    box._timer =
        setTimeout(
            () => {

                box.remove();

            },
            3500
        );

}


/* ============================================================
   DOM READY
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        /*
         * Initial load.
         */

        await loadDashboardData();


        /*
         * Manual refresh.
         */

        bindDashboardRefresh();


        /*
         * Automatic refresh.
         */

        startDashboardAutoRefresh();

    }
);


/* ============================================================
   GLOBAL API
   ============================================================ */

window.MMVDashboard = {

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

    calculateMonthlyTrend,

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
    "%cMMV Dashboard V2%c ready",
    "font-weight:800;color:#0a3d91;",
    "color:inherit;"
);
