/* ============================================================
   MMV TRADERS ERP V2
   REPORTS SERVICE
   Production Firebase + Firestore
   ============================================================ */

"use strict";

import {
    collection,
    getDocs,
    query,
    orderBy,
    limit
} from
"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
    db
} from "./firebase.js";


/* ============================================================
   COLLECTIONS
   ============================================================ */

const SALES =
    "sales";

const SALES_ITEMS =
    "salesItems";

const PURCHASES =
    "purchases";

const PURCHASE_ITEMS =
    "purchaseItems";

const CUSTOMERS =
    "customers";

const SUPPLIERS =
    "suppliers";

const PAYMENTS =
    "payments";

const INVENTORY =
    "inventory";


const MAX_RESULTS =
    1000;


/* ============================================================
   STATE
   ============================================================ */

const reportState = {

    sales: [],

    salesItems: [],

    purchases: [],

    purchaseItems: [],

    customers: [],

    suppliers: [],

    payments: [],

    inventory: [],

    filteredSales: [],

    filteredPurchases: [],

    fromDate: "",

    toDate: ""

};


/* ============================================================
   HELPERS
   ============================================================ */

function el(id) {

    return document.getElementById(id);

}


function clean(value) {

    return String(
        value ?? ""
    ).trim();

}


function numberValue(value) {

    const n =
        Number(value);

    return Number.isFinite(n)
        ? n
        : 0;

}


function formatAmount(value) {

    return numberValue(
        value
    ).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );

}


function formatDate(value) {

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


        return date
            .toISOString()
            .slice(
                0,
                10
            );

    }
    catch {

        return "";

    }

}


function setText(
    ids,
    text
) {

    if (!Array.isArray(ids)) {

        ids = [ids];

    }


    for (const id of ids) {

        const node =
            el(id);

        if (node) {

            node.textContent =
                text;

            return;

        }

    }

}


function escapeHTML(value) {

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
   DATE FILTER
   ============================================================ */

function isDateInRange(
    value,
    fromDate,
    toDate
) {

    const date =
        formatDate(
            value
        );


    if (!date) {

        return true;

    }


    if (
        fromDate &&
        date <
        fromDate
    ) {

        return false;

    }


    if (
        toDate &&
        date >
        toDate
    ) {

        return false;

    }


    return true;

}


/* ============================================================
   GENERIC FIRESTORE LOAD
   ============================================================ */

async function loadCollection(
    collectionName
) {

    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        collectionName
                    ),
                    limit(
                        MAX_RESULTS
                    )
                )
            );


        return snapshot.docs.map(
            item => ({

                id:
                    item.id,

                ...item.data()

            })
        );

    }
    catch(error) {

        console.error(
            `Unable to load ${collectionName}`,
            error
        );


        return [];

    }

}


/* ============================================================
   LOAD ALL REPORT DATA
   ============================================================ */

async function loadReportData() {

    try {

        const [

            sales,

            salesItems,

            purchases,

            purchaseItems,

            customers,

            suppliers,

            payments,

            inventory

        ] = await Promise.all([

            loadCollection(
                SALES
            ),

            loadCollection(
                SALES_ITEMS
            ),

            loadCollection(
                PURCHASES
            ),

            loadCollection(
                PURCHASE_ITEMS
            ),

            loadCollection(
                CUSTOMERS
            ),

            loadCollection(
                SUPPLIERS
            ),

            loadCollection(
                PAYMENTS
            ),

            loadCollection(
                INVENTORY
            )

        ]);


        reportState.sales =
            sales;

        reportState.salesItems =
            salesItems;

        reportState.purchases =
            purchases;

        reportState.purchaseItems =
            purchaseItems;

        reportState.customers =
            customers;

        reportState.suppliers =
            suppliers;

        reportState.payments =
            payments;

        reportState.inventory =
            inventory;


        applyReportFilter();


        return reportState;

    }
    catch(error) {

        console.error(
            "Report data loading error:",
            error
        );


        showMessage(
            getErrorMessage(error),
            "error"
        );


        return reportState;

    }

}


/* ============================================================
   FILTER
   ============================================================ */

function applyReportFilter() {

    reportState.filteredSales =
        reportState.sales.filter(
            sale =>
                isDateInRange(
                    sale.invoiceDate ||
                    sale.createdAt,
                    reportState.fromDate,
                    reportState.toDate
                )
        );


    reportState.filteredPurchases =
        reportState.purchases.filter(
            purchase =>
                isDateInRange(
                    purchase.invoiceDate ||
                    purchase.createdAt,
                    reportState.fromDate,
                    reportState.toDate
                )
        );


    renderAllReports();

}


/* ============================================================
   SET DATE FILTER
   ============================================================ */

function setReportDateRange(
    fromDate,
    toDate
) {

    reportState.fromDate =
        clean(
            fromDate
        );

    reportState.toDate =
        clean(
            toDate
        );


    setText(
        [
            "reportDateRange"
        ],
        reportState.fromDate ||
        reportState.toDate
            ? `${reportState.fromDate || "Start"} → ${reportState.toDate || "Today"}`
            : "All time"
    );


    applyReportFilter();

}


/* ============================================================
   READ DATE INPUTS
   ============================================================ */

function applyDateInputs() {

    const fromDate =
        el(
            "reportFromDate"
        )?.value || "";


    const toDate =
        el(
            "reportToDate"
        )?.value || "";


    if (
        fromDate &&
        toDate &&
        fromDate >
        toDate
    ) {

        showMessage(
            "From date cannot be greater than To date.",
            "error"
        );

        return;

    }


    setReportDateRange(
        fromDate,
        toDate
    );

}


/* ============================================================
   SALES REPORT
   ============================================================ */

function calculateSalesReport() {

    const sales =
        reportState.filteredSales;


    const invoiceCount =
        sales.length;


    const taxable =
        sales.reduce(
            (
                total,
                sale
            ) =>
                total +
                numberValue(
                    sale.taxableAmount
                ),
            0
        );


    const gst =
        sales.reduce(
            (
                total,
                sale
            ) =>
                total +
                numberValue(
                    sale.gstAmount
                ),
            0
        );


    const grossSales =
        sales.reduce(
            (
                total,
                sale
            ) =>
                total +
                numberValue(
                    sale.totalAmount
                ),
            0
        );


    const received =
        sales.reduce(
            (
                total,
                sale
            ) =>
                total +
                numberValue(
                    sale.paymentAmount
                ),
            0
        );


    const outstanding =
        sales.reduce(
            (
                total,
                sale
            ) =>
                total +
                numberValue(
                    sale.outstanding
                ),
            0
        );


    return {

        invoiceCount,

        taxable,

        gst,

        grossSales,

        received,

        outstanding

    };

}


/* ============================================================
   PURCHASE REPORT
   ============================================================ */

function calculatePurchaseReport() {

    const purchases =
        reportState.filteredPurchases;


    const invoiceCount =
        purchases.length;


    const taxable =
        purchases.reduce(
            (
                total,
                purchase
            ) =>
                total +
                numberValue(
                    purchase.taxableAmount
                ),
            0
        );


    const gst =
        purchases.reduce(
            (
                total,
                purchase
            ) =>
                total +
                numberValue(
                    purchase.gstAmount
                ),
            0
        );


    const grossPurchases =
        purchases.reduce(
            (
                total,
                purchase
            ) =>
                total +
                numberValue(
                    purchase.totalAmount
                ),
            0
        );


    return {

        invoiceCount,

        taxable,

        gst,

        grossPurchases

    };

}


/* ============================================================
   PROFIT REPORT
   ============================================================ */

function calculateProfitReport() {

    const items =
        reportState.salesItems.filter(
            item =>
                isDateInRange(
                    item.createdAt,
                    reportState.fromDate,
                    reportState.toDate
                )
        );


    const revenue =
        items.reduce(
            (
                total,
                item
            ) =>
                total +
                numberValue(
                    item.taxableAmount
                ),
            0
        );


    const cost =
        items.reduce(
            (
                total,
                item
            ) =>
                total +
                numberValue(
                    item.costAmount
                ),
            0
        );


    const profit =
        items.reduce(
            (
                total,
                item
            ) =>
                total +
                numberValue(
                    item.profit
                ),
            0
        );


    const margin =
        revenue > 0
            ? (
                profit /
                revenue
            ) *
            100
            : 0;


    return {

        revenue,

        cost,

        profit,

        margin

    };

}


/* ============================================================
   GST REPORT
   ============================================================ */

function calculateGSTReport() {

    const sales =
        calculateSalesReport();


    const purchases =
        calculatePurchaseReport();


    const outputGST =
        sales.gst;


    const inputGST =
        purchases.gst;


    const netGST =
        outputGST -
        inputGST;


    return {

        outputGST,

        inputGST,

        netGST

    };

}


/* ============================================================
   PAYMENT REPORT
   ============================================================ */

function calculatePaymentReport() {

    const payments =
        reportState.payments.filter(
            payment =>
                isDateInRange(
                    payment.paymentDate ||
                    payment.createdAt,
                    reportState.fromDate,
                    reportState.toDate
                )
        );


    const customerReceipts =
        payments
            .filter(
                payment =>
                    payment.type ===
                    "CUSTOMER"
            )
            .reduce(
                (
                    total,
                    payment
                ) =>
                    total +
                    numberValue(
                        payment.amount
                    ),
                0
            );


    const supplierPayments =
        payments
            .filter(
                payment =>
                    payment.type ===
                    "SUPPLIER"
            )
            .reduce(
                (
                    total,
                    payment
                ) =>
                    total +
                    numberValue(
                        payment.amount
                    ),
                0
            );


    return {

        totalPayments:
            payments.length,

        customerReceipts,

        supplierPayments

    };

}


/* ============================================================
   OUTSTANDING REPORT
   ============================================================ */

function calculateOutstandingReport() {

    const customerOutstanding =
        reportState.customers.reduce(
            (
                total,
                customer
            ) =>
                total +
                numberValue(
                    customer.outstanding
                ),
            0
        );


    const supplierOutstanding =
        reportState.suppliers.reduce(
            (
                total,
                supplier
            ) =>
                total +
                numberValue(
                    supplier.outstanding ??
                    supplier.payable
                ),
            0
        );


    return {

        customerOutstanding,

        supplierOutstanding

    };

}


/* ============================================================
   STOCK REPORT
   ============================================================ */

function calculateStockReport() {

    const stock =
        reportState.inventory;


    const totalItems =
        stock.length;


    const totalQuantity =
        stock.reduce(
            (
                total,
                item
            ) =>
                total +
                numberValue(
                    item.quantity
                ),
            0
        );


    const stockValue =
        stock.reduce(
            (
                total,
                item
            ) =>
                total +
                numberValue(
                    item.stockValue ??
                    (
                        numberValue(
                            item.quantity
                        ) *
                        numberValue(
                            item.purchaseRate
                        )
                    )
                ),
            0
        );


    const lowStock =
        stock.filter(
            item => {

                const quantity =
                    numberValue(
                        item.quantity
                    );


                const minimum =
                    numberValue(
                        item.minimumStock ??
                        item.minStock ??
                        0
                    );


                return (
                    minimum > 0 &&
                    quantity <= minimum
                );

            }
        ).length;


    return {

        totalItems,

        totalQuantity,

        stockValue,

        lowStock

    };

}


/* ============================================================
   RENDER DASHBOARD CARDS
   ============================================================ */

function renderSummaryCards() {

    const sales =
        calculateSalesReport();


    const purchases =
        calculatePurchaseReport();


    const profit =
        calculateProfitReport();


    const outstanding =
        calculateOutstandingReport();


    const stock =
        calculateStockReport();


    const payments =
        calculatePaymentReport();


    setText(
        [
            "reportSales",
            "totalReportSales"
        ],
        "₹" +
        formatAmount(
            sales.grossSales
        )
    );


    setText(
        [
            "reportPurchases",
            "totalReportPurchases"
        ],
        "₹" +
        formatAmount(
            purchases.grossPurchases
        )
    );


    setText(
        [
            "reportProfit",
            "totalReportProfit"
        ],
        "₹" +
        formatAmount(
            profit.profit
        )
    );


    setText(
        [
            "reportCustomerOutstanding",
            "customerOutstanding"
        ],
        "₹" +
        formatAmount(
            outstanding.customerOutstanding
        )
    );


    setText(
        [
            "reportSupplierOutstanding",
            "supplierOutstanding"
        ],
        "₹" +
        formatAmount(
            outstanding.supplierOutstanding
        )
    );


    setText(
        [
            "reportStockValue",
            "stockValue"
        ],
        "₹" +
        formatAmount(
            stock.stockValue
        )
    );


    setText(
        [
            "reportReceipts",
            "customerReceipts"
        ],
        "₹" +
        formatAmount(
            payments.customerReceipts
        )
    );


    setText(
        [
            "reportSupplierPayments",
            "supplierPayments"
        ],
        "₹" +
        formatAmount(
            payments.supplierPayments
        )
    );


    setText(
        [
            "reportSalesCount"
        ],
        sales.invoiceCount
    );


    setText(
        [
            "reportPurchaseCount"
        ],
        purchases.invoiceCount
    );


    setText(
        [
            "reportProfitMargin"
        ],
        formatAmount(
            profit.margin
        ) +
        "%"
    );


    setText(
        [
            "reportLowStock"
        ],
        stock.lowStock
    );

}


/* ============================================================
   SALES TABLE
   ============================================================ */

function renderSalesReport() {

    const table =
        el(
            "salesReportTable"
        );


    if (!table) {

        return;

    }


    const sales =
        reportState.filteredSales;


    if (
        sales.length ===
        0
    ) {

        table.innerHTML = `

            <tr>

                <td colspan="100%">

                    No sales found for selected period.

                </td>

            </tr>

        `;

        return;

    }


    table.innerHTML =
        sales
            .map(
                sale => `

                    <tr>

                        <td>
                            ${escapeHTML(
                                sale.invoiceNumber
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                sale.customerName ||
                                "Walk-in Customer"
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                sale.invoiceDate ||
                                sale.createdAt
                            )}
                        </td>

                        <td>
                            ₹${formatAmount(
                                sale.taxableAmount
                            )}
                        </td>

                        <td>
                            ₹${formatAmount(
                                sale.gstAmount
                            )}
                        </td>

                        <td>
                            ₹${formatAmount(
                                sale.totalAmount
                            )}
                        </td>

                        <td>
                            ₹${formatAmount(
                                sale.outstanding
                            )}
                        </td>

                    </tr>

                `
            )
            .join("");

}


/* ============================================================
   PURCHASE TABLE
   ============================================================ */

function renderPurchaseReport() {

    const table =
        el(
            "purchaseReportTable"
        );


    if (!table) {

        return;

    }


    const purchases =
        reportState.filteredPurchases;


    if (
        purchases.length ===
        0
    ) {

        table.innerHTML = `

            <tr>

                <td colspan="100%">

                    No purchases found for selected period.

                </td>

            </tr>

        `;

        return;

    }


    table.innerHTML =
        purchases
            .map(
                purchase => `

                    <tr>

                        <td>
                            ${escapeHTML(
                                purchase.invoiceNumber
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                purchase.supplierName ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                purchase.invoiceDate ||
                                purchase.createdAt
                            )}
                        </td>

                        <td>
                            ₹${formatAmount(
                                purchase.taxableAmount
                            )}
                        </td>

                        <td>
                            ₹${formatAmount(
                                purchase.gstAmount
                            )}
                        </td>

                        <td>
                            ₹${formatAmount(
                                purchase.totalAmount
                            )}
                        </td>

                    </tr>

                `
            )
            .join("");

}


/* ============================================================
   PROFIT TABLE
   ============================================================ */

function renderProfitReport() {

    const table =
        el(
            "profitReportTable"
        );


    if (!table) {

        return;

    }


    const items =
        reportState.salesItems.filter(
            item =>
                isDateInRange(
                    item.createdAt,
                    reportState.fromDate,
                    reportState.toDate
                )
        );


    if (
        items.length ===
        0
    ) {

        table.innerHTML = `

            <tr>

                <td colspan="100%">

                    No profit data found.

                </td>

            </tr>

        `;

        return;

    }


    table.innerHTML =
        items
            .map(
                item => `

                    <tr>

                        <td>
                            ${escapeHTML(
                                item.invoiceNumber
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                item.materialName
                            )}
                        </td>

                        <td>
                            ${formatAmount(
                                item.quantity
                            )}
                        </td>

                        <td>
                            ₹${formatAmount(
                                item.rate
                            )}
                        </td>

                        <td>
                            ₹${formatAmount(
                                item.costRate
                            )}
                        </td>

                        <td>
                            ₹${formatAmount(
                                item.profit
                            )}
                        </td>

                    </tr>

                `
            )
            .join("");

}


/* ============================================================
   OUTSTANDING TABLE
   ============================================================ */

function renderOutstandingReport() {

    const table =
        el(
            "outstandingReportTable"
        );


    if (!table) {

        return;

    }


    const customerRows =
        reportState.customers
            .filter(
                customer =>
                    numberValue(
                        customer.outstanding
                    ) > 0
            )
            .map(
                customer => `

                    <tr>

                        <td>
                            Customer
                        </td>

                        <td>
                            ${escapeHTML(
                                customer.customerName ||
                                customer.name ||
                                "-"
                            )}
                        </td>

                        <td>
                            ₹${formatAmount(
                                customer.outstanding
                            )}
                        </td>

                    </tr>

                `
            );


    const supplierRows =
        reportState.suppliers
            .filter(
                supplier =>
                    numberValue(
                        supplier.outstanding ??
                        supplier.payable
                    ) > 0
            )
            .map(
                supplier => `

                    <tr>

                        <td>
                            Supplier
                        </td>

                        <td>
                            ${escapeHTML(
                                supplier.supplierName ||
                                "-"
                            )}
                        </td>

                        <td>
                            ₹${formatAmount(
                                supplier.outstanding ??
                                supplier.payable
                            )}
                        </td>

                    </tr>

                `
            );


    const rows =
        [
            ...customerRows,
            ...supplierRows
        ];


    table.innerHTML =
        rows.length
            ? rows.join("")
            : `

                <tr>

                    <td colspan="100%">

                        No outstanding balance.

                    </td>

                </tr>

            `;

}


/* ============================================================
   GST REPORT
   ============================================================ */

function renderGSTReport() {

    const gst =
        calculateGSTReport();


    setText(
        [
            "outputGST",
            "salesGSTReport"
        ],
        "₹" +
        formatAmount(
            gst.outputGST
        )
    );


    setText(
        [
            "inputGST",
            "purchaseGSTReport"
        ],
        "₹" +
        formatAmount(
            gst.inputGST
        )
    );


    setText(
        [
            "netGST",
            "netGSTReport"
        ],
        "₹" +
        formatAmount(
            gst.netGST
        )
    );

}


/* ============================================================
   INVENTORY REPORT
   ============================================================ */

function renderInventoryReport() {

    const table =
        el(
            "inventoryReportTable"
        );


    if (!table) {

        return;

    }


    const inventory =
        reportState.inventory;


    if (
        inventory.length ===
        0
    ) {

        table.innerHTML = `

            <tr>

                <td colspan="100%">

                    No inventory records found.

                </td>

            </tr>

        `;

        return;

    }


    table.innerHTML =
        inventory
            .map(
                item => {

                    const quantity =
                        numberValue(
                            item.quantity
                        );


                    const minimum =
                        numberValue(
                            item.minimumStock ??
                            item.minStock
                        );


                    const lowStock =
                        minimum > 0 &&
                        quantity <= minimum;


                    return `

                        <tr>

                            <td>
                                ${escapeHTML(
                                    item.materialCode ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    item.materialName ||
                                    item.name ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${formatAmount(
                                    quantity
                                )}
                            </td>

                            <td>
                                ${formatAmount(
                                    item.purchaseRate
                                )}
                            </td>

                            <td>
                                ₹${formatAmount(
                                    item.stockValue
                                )}
                            </td>

                            <td>

                                ${
                                    lowStock
                                        ? "LOW STOCK"
                                        : "OK"
                                }

                            </td>

                        </tr>

                    `;

                }
            )
            .join("");

}


/* ============================================================
   PAYMENT REPORT TABLE
   ============================================================ */

function renderPaymentReport() {

    const table =
        el(
            "paymentReportTable"
        );


    if (!table) {

        return;

    }


    const payments =
        reportState.payments.filter(
            payment =>
                isDateInRange(
                    payment.paymentDate ||
                    payment.createdAt,
                    reportState.fromDate,
                    reportState.toDate
                )
        );


    if (
        payments.length ===
        0
    ) {

        table.innerHTML = `

            <tr>

                <td colspan="100%">

                    No payment records found.

                </td>

            </tr>

        `;

        return;

    }


    table.innerHTML =
        payments
            .map(
                payment => `

                    <tr>

                        <td>
                            ${escapeHTML(
                                payment.paymentNumber
                            )}
                        </td>

                        <td>
                            ${
                                payment.type ===
                                "SUPPLIER"
                                    ? "Supplier Payment"
                                    : "Customer Receipt"
                            }
                        </td>

                        <td>
                            ${escapeHTML(
                                payment.customerName ||
                                payment.supplierName ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                payment.paymentDate ||
                                payment.createdAt
                            )}
                        </td>

                        <td>
                            ₹${formatAmount(
                                payment.amount
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                payment.paymentMode ||
                                "-"
                            )}
                        </td>

                    </tr>

                `
            )
            .join("");

}


/* ============================================================
   RENDER EVERYTHING
   ============================================================ */

function renderAllReports() {

    renderSummaryCards();

    renderSalesReport();

    renderPurchaseReport();

    renderProfitReport();

    renderOutstandingReport();

    renderGSTReport();

    renderInventoryReport();

    renderPaymentReport();

}


/* ============================================================
   GET REPORT DATA
   ============================================================ */

function getReportSnapshot() {

    return {

        dateRange: {

            from:
                reportState.fromDate,

            to:
                reportState.toDate

        },

        sales:
            calculateSalesReport(),

        purchases:
            calculatePurchaseReport(),

        profit:
            calculateProfitReport(),

        gst:
            calculateGSTReport(),

        payments:
            calculatePaymentReport(),

        outstanding:
            calculateOutstandingReport(),

        stock:
            calculateStockReport()

    };

}


/* ============================================================
   CSV EXPORT
   ============================================================ */

function downloadCSV(
    filename,
    rows
) {

    if (
        !Array.isArray(rows) ||
        rows.length === 0
    ) {

        showMessage(
            "No data available for export.",
            "error"
        );

        return;

    }


    const csv =
        rows
            .map(
                row =>
                    row
                        .map(
                            value => {

                                const text =
                                    String(
                                        value ??
                                        ""
                                    );


                                return (
                                    '"' +
                                    text
                                        .replace(
                                            /"/g,
                                            '""'
                                        ) +
                                    '"'
                                );

                            }
                        )
                        .join(",")
            )
            .join("\n");


    const blob =
        new Blob(
            [
                csv
            ],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;

    link.download =
        filename;


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    URL.revokeObjectURL(
        url
    );

}


/* ============================================================
   EXPORT SALES
   ============================================================ */

function exportSalesReport() {

    const rows = [

        [
            "Invoice",
            "Customer",
            "Date",
            "Taxable",
            "GST",
            "Total",
            "Outstanding"
        ]

    ];


    reportState.filteredSales
        .forEach(
            sale => {

                rows.push([

                    sale.invoiceNumber,

                    sale.customerName ||
                    "Walk-in Customer",

                    formatDate(
                        sale.invoiceDate ||
                        sale.createdAt
                    ),

                    sale.taxableAmount,

                    sale.gstAmount,

                    sale.totalAmount,

                    sale.outstanding

                ]);

            }
        );


    downloadCSV(
        "MMV-Sales-Report.csv",
        rows
    );

}


/* ============================================================
   EXPORT PURCHASE
   ============================================================ */

function exportPurchaseReport() {

    const rows = [

        [
            "Invoice",
            "Supplier",
            "Date",
            "Taxable",
            "GST",
            "Total"
        ]

    ];


    reportState.filteredPurchases
        .forEach(
            purchase => {

                rows.push([

                    purchase.invoiceNumber,

                    purchase.supplierName,

                    formatDate(
                        purchase.invoiceDate ||
                        purchase.createdAt
                    ),

                    purchase.taxableAmount,

                    purchase.gstAmount,

                    purchase.totalAmount

                ]);

            }
        );


    downloadCSV(
        "MMV-Purchase-Report.csv",
        rows
    );

}


/* ============================================================
   EXPORT PROFIT
   ============================================================ */

function exportProfitReport() {

    const rows = [

        [
            "Invoice",
            "Material",
            "Quantity",
            "Selling Rate",
            "Cost Rate",
            "Profit"
        ]

    ];


    reportState.salesItems
        .filter(
            item =>
                isDateInRange(
                    item.createdAt,
                    reportState.fromDate,
                    reportState.toDate
                )
        )
        .forEach(
            item => {

                rows.push([

                    item.invoiceNumber,

                    item.materialName,

                    item.quantity,

                    item.rate,

                    item.costRate,

                    item.profit

                ]);

            }
        );


    downloadCSV(
        "MMV-Profit-Report.csv",
        rows
    );

}


/* ============================================================
   EXPORT OUTSTANDING
   ============================================================ */

function exportOutstandingReport() {

    const rows = [

        [
            "Type",
            "Party",
            "Outstanding"
        ]

    ];


    reportState.customers
        .filter(
            customer =>
                numberValue(
                    customer.outstanding
                ) > 0
        )
        .forEach(
            customer => {

                rows.push([

                    "Customer",

                    customer.customerName ||
                    customer.name ||
                    "",

                    customer.outstanding

                ]);

            }
        );


    reportState.suppliers
        .filter(
            supplier =>
                numberValue(
                    supplier.outstanding ??
                    supplier.payable
                ) > 0
        )
        .forEach(
            supplier => {

                rows.push([

                    "Supplier",

                    supplier.supplierName ||
                    "",

                    supplier.outstanding ??
                    supplier.payable

                ]);

            }
        );


    downloadCSV(
        "MMV-Outstanding-Report.csv",
        rows
    );

}


/* ============================================================
   QUICK DATE FILTERS
   ============================================================ */

function setTodayReport() {

    const today =
        new Date()
            .toISOString()
            .slice(
                0,
                10
            );


    setValue(
        "reportFromDate",
        today
    );


    setValue(
        "reportToDate",
        today
    );


    setReportDateRange(
        today,
        today
    );

}


function setCurrentMonthReport() {

    const now =
        new Date();


    const from =
        new Date(
            now.getFullYear(),
            now.getMonth(),
            1
        )
        .toISOString()
        .slice(
            0,
            10
        );


    const to =
        now
            .toISOString()
            .slice(
                0,
                10
            );


    setValue(
        "reportFromDate",
        from
    );


    setValue(
        "reportToDate",
        to
    );


    setReportDateRange(
        from,
        to
    );

}


function setCurrentYearReport() {

    const year =
        new Date()
            .getFullYear();


    const from =
        `${year}-01-01`;


    const to =
        new Date()
            .toISOString()
            .slice(
                0,
                10
            );


    setValue(
        "reportFromDate",
        from
    );


    setValue(
        "reportToDate",
        to
    );


    setReportDateRange(
        from,
        to
    );

}


function clearReportFilter() {

    setValue(
        "reportFromDate",
        ""
    );


    setValue(
        "reportToDate",
        ""
    );


    setReportDateRange(
        "",
        ""
    );

}


/* ============================================================
   MESSAGE
   ============================================================ */

function showMessage(
    message,
    type = "info"
) {

    let box =
        el(
            "mmvReportsMessage"
        );


    if (!box) {

        box =
            document.createElement(
                "div"
            );


        box.id =
            "mmvReportsMessage";


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
        "success"
    ) {

        box.style.background =
            "#eaf8f0";

        box.style.color =
            "#147a48";

    }
    else if (
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
   ERROR
   ============================================================ */

function getErrorMessage(
    error
) {

    if (!error) {

        return "Something went wrong.";

    }


    const code =
        String(
            error.code ||
            ""
        );


    if (
        code.includes(
            "permission-denied"
        )
    ) {

        return "You do not have permission to view this report.";

    }


    if (
        code.includes(
            "unavailable"
        )
    ) {

        return "Firebase is temporarily unavailable.";

    }


    return (
        error.message ||
        "Unable to load report."
    );

}


/* ============================================================
   DOM READY
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        /*
         * Initial report load.
         */

        await loadReportData();


        /*
         * Date buttons.
         */

        const applyButton =
            el(
                "applyReportFilter"
            );


        if (applyButton) {

            applyButton.addEventListener(
                "click",
                applyDateInputs
            );

        }


        const todayButton =
            el(
                "todayReport"
            );


        if (todayButton) {

            todayButton.addEventListener(
                "click",
                setTodayReport
            );

        }


        const monthButton =
            el(
                "monthReport"
            );


        if (monthButton) {

            monthButton.addEventListener(
                "click",
                setCurrentMonthReport
            );

        }


        const yearButton =
            el(
                "yearReport"
            );


        if (yearButton) {

            yearButton.addEventListener(
                "click",
                setCurrentYearReport
            );

        }


        const clearButton =
            el(
                "clearReportFilter"
            );


        if (clearButton) {

            clearButton.addEventListener(
                "click",
                clearReportFilter
            );

        }

    }
);


/* ============================================================
   GLOBAL API
   ============================================================ */

window.MMVReports = {

    loadReportData,

    applyReportFilter,

    setReportDateRange,

    calculateSalesReport,

    calculatePurchaseReport,

    calculateProfitReport,

    calculateGSTReport,

    calculatePaymentReport,

    calculateOutstandingReport,

    calculateStockReport,

    getReportSnapshot,

    renderAllReports,

    exportSalesReport,

    exportPurchaseReport,

    exportProfitReport,

    exportOutstandingReport,

    setTodayReport,

    setCurrentMonthReport,

    setCurrentYearReport,

    clearReportFilter

};


window.loadReportData =
    loadReportData;

window.applyReportFilter =
    applyReportFilter;

window.setReportDateRange =
    setReportDateRange;

window.getReportSnapshot =
    getReportSnapshot;

window.renderAllReports =
    renderAllReports;

window.exportSalesReport =
    exportSalesReport;

window.exportPurchaseReport =
    exportPurchaseReport;

window.exportProfitReport =
    exportProfitReport;

window.exportOutstandingReport =
    exportOutstandingReport;

window.setTodayReport =
    setTodayReport;

window.setCurrentMonthReport =
    setCurrentMonthReport;

window.setCurrentYearReport =
    setCurrentYearReport;

window.clearReportFilter =
    clearReportFilter;


console.info(
    "%cMMV Reports V2%c ready",
    "font-weight:800;color:#0a3d91;",
    "color:inherit;"
);
