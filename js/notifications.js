/* ============================================================
   MMV TRADERS ERP V2
   NOTIFICATIONS SERVICE
   ------------------------------------------------------------
   Handles:
   - Low Stock Alerts
   - Customer Outstanding Alerts
   - Supplier Payable Alerts
   - Recent Payment Alerts
   - Today's Business Summary
   - Notification Badge
   - Notification Panel
   - Read / Unread State
   ============================================================ */

"use strict";


/* ============================================================
   CONFIGURATION
   ============================================================ */

const NOTIFICATION_CONFIG = {

    lowStock: true,

    customerOutstanding: true,

    supplierPayable: true,

    recentPayment: true,

    dailySummary: true,

    maxItems: 50,

    recentPaymentHours: 24

};


/* ============================================================
   STATE
   ============================================================ */

const notificationState = {

    notifications: [],

    unreadCount: 0,

    lastGeneratedAt: null,

    initialized: false

};


/* ============================================================
   HELPERS
   ============================================================ */

function notificationEl(id) {

    return document.getElementById(id);

}


function notificationNumber(value) {

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : 0;

}


function notificationAmount(value) {

    return notificationNumber(
        value
    ).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );

}


function notificationDate(value) {

    if (!value) {

        return null;

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

            return null;

        }


        return date;

    }
    catch {

        return null;

    }

}


function notificationDateKey(value) {

    const date =
        notificationDate(
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


function notificationToday() {

    return notificationDateKey(
        new Date()
    );

}


function escapeNotificationHTML(
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
   UNIQUE ID
   ============================================================ */

function createNotificationId(
    type,
    referenceId
) {

    return [
        type,
        referenceId ||
        Date.now()
    ].join(
        "_"
    );

}


/* ============================================================
   ADD NOTIFICATION
   ============================================================ */

function addNotification(
    notification
) {

    if (
        !notification ||
        !notification.type
    ) {

        return;

    }


    const id =
        notification.id ||
        createNotificationId(
            notification.type,
            notification.referenceId
        );


    const exists =
        notificationState
            .notifications
            .some(
                item =>
                    item.id === id
            );


    if (exists) {

        return;

    }


    notificationState
        .notifications
        .push({

            id,

            type:
                notification.type,

            title:
                notification.title ||
                "Notification",

            message:
                notification.message ||
                "",

            severity:
                notification.severity ||
                "info",

            referenceId:
                notification.referenceId ||
                null,

            referenceType:
                notification.referenceType ||
                null,

            createdAt:
                notification.createdAt ||
                new Date(),

            read:
                Boolean(
                    notification.read
                )

        });

}


/* ============================================================
   LOW STOCK NOTIFICATIONS
   ============================================================ */

function generateLowStockNotifications() {

    if (
        !NOTIFICATION_CONFIG.lowStock
    ) {

        return;

    }


    const inventory =
        window.MMVDashboard
            ? window.MMVDashboard
            : null;


    /*
     * Dashboard service maintains
     * the latest inventory in its
     * internal state.
     */

    const items =
        window.MMVDashboard
            ? (
                window.MMVDashboard
                    .getDashboardSnapshot
                    ? null
                    : null
            )
            : null;


    /*
     * Prefer direct dashboard state
     * when available.
     */

    const dashboardData =
        window.MMVReports
            ? window.MMVReports
            : null;


    let inventoryData = [];


    /*
     * MMVReports state is intentionally
     * not exposed directly. Therefore
     * use dashboard low-stock UI data
     * only when direct inventory API
     * is unavailable.
     *
     * If inventory.js exposes
     * getInventoryData(), use it.
     */

    if (
        window.MMVInventory &&
        typeof
        window.MMVInventory
            .getInventoryData ===
        "function"
    ) {

        inventoryData =
            window.MMVInventory
                .getInventoryData() ||
            [];

    }


    /*
     * Alternative API.
     */

    if (
        inventoryData.length === 0 &&
        window.MMVInventory &&
        Array.isArray(
            window.MMVInventory
                .inventoryCache
        )
    ) {

        inventoryData =
            window.MMVInventory
                .inventoryCache;

    }


    /*
     * If no inventory API exists,
     * simply skip this section.
     */

    if (
        inventoryData.length === 0
    ) {

        return;

    }


    inventoryData
        .filter(
            item => {

                const quantity =
                    notificationNumber(
                        item.quantity
                    );


                const minimum =
                    notificationNumber(
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
        .slice(
            0,
            NOTIFICATION_CONFIG.maxItems
        )
        .forEach(
            item => {

                const name =
                    item.materialName ||
                    item.name ||
                    "Item";


                const quantity =
                    notificationNumber(
                        item.quantity
                    );


                const minimum =
                    notificationNumber(
                        item.minimumStock ??
                        item.minStock
                    );


                addNotification({

                    id:
                        createNotificationId(
                            "LOW_STOCK",
                            item.id
                        ),

                    type:
                        "LOW_STOCK",

                    title:
                        "Low Stock Alert",

                    message:
                        `${name} stock is ${notificationAmount(
                            quantity
                        )}. Minimum level is ${notificationAmount(
                            minimum
                        )}.`,

                    severity:
                        "warning",

                    referenceId:
                        item.id,

                    referenceType:
                        "inventory"

                });

            }
        );

}


/* ============================================================
   CUSTOMER OUTSTANDING
   ============================================================ */

function generateCustomerOutstandingNotifications() {

    if (
        !NOTIFICATION_CONFIG.customerOutstanding
    ) {

        return;

    }


    let customers = [];


    if (
        window.MMVCustomers &&
        typeof
        window.MMVCustomers
            .getCustomers ===
        "function"
    ) {

        customers =
            window.MMVCustomers
                .getCustomers() ||
            [];

    }


    if (
        customers.length === 0 &&
        window.MMVCustomers &&
        Array.isArray(
            window.MMVCustomers
                .customerCache
        )
    ) {

        customers =
            window.MMVCustomers
                .customerCache;

    }


    if (
        customers.length === 0
    ) {

        return;

    }


    customers
        .filter(
            customer =>
                notificationNumber(
                    customer.outstanding
                ) > 0
        )
        .sort(
            (
                a,
                b
            ) =>
                notificationNumber(
                    b.outstanding
                ) -
                notificationNumber(
                    a.outstanding
                )
        )
        .slice(
            0,
            NOTIFICATION_CONFIG.maxItems
        )
        .forEach(
            customer => {

                const outstanding =
                    notificationNumber(
                        customer.outstanding
                    );


                const name =
                    customer.customerName ||
                    customer.name ||
                    "Customer";


                addNotification({

                    id:
                        createNotificationId(
                            "CUSTOMER_DUE",
                            customer.id
                        ),

                    type:
                        "CUSTOMER_DUE",

                    title:
                        "Customer Outstanding",

                    message:
                        `${name} has an outstanding balance of ₹${notificationAmount(
                            outstanding
                        )}.`,

                    severity:
                        "info",

                    referenceId:
                        customer.id,

                    referenceType:
                        "customer"

                });

            }
        );

}


/* ============================================================
   SUPPLIER PAYABLE
   ============================================================ */

function generateSupplierPayableNotifications() {

    if (
        !NOTIFICATION_CONFIG.supplierPayable
    ) {

        return;

    }


    let suppliers = [];


    if (
        window.MMVSuppliers &&
        typeof
        window.MMVSuppliers
            .getSuppliers ===
        "function"
    ) {

        suppliers =
            window.MMVSuppliers
                .getSuppliers() ||
            [];

    }


    if (
        suppliers.length === 0 &&
        window.MMVSuppliers &&
        Array.isArray(
            window.MMVSuppliers
                .supplierCache
        )
    ) {

        suppliers =
            window.MMVSuppliers
                .supplierCache;

    }


    if (
        suppliers.length === 0
    ) {

        return;

    }


    suppliers
        .filter(
            supplier =>
                notificationNumber(
                    supplier.outstanding ??
                    supplier.payable
                ) > 0
        )
        .sort(
            (
                a,
                b
            ) =>
                notificationNumber(
                    b.outstanding ??
                    b.payable
                ) -
                notificationNumber(
                    a.outstanding ??
                    a.payable
                )
        )
        .slice(
            0,
            NOTIFICATION_CONFIG.maxItems
        )
        .forEach(
            supplier => {

                const payable =
                    notificationNumber(
                        supplier.outstanding ??
                        supplier.payable
                    );


                const name =
                    supplier.supplierName ||
                    "Supplier";


                addNotification({

                    id:
                        createNotificationId(
                            "SUPPLIER_DUE",
                            supplier.id
                        ),

                    type:
                        "SUPPLIER_DUE",

                    title:
                        "Supplier Payment Due",

                    message:
                        `${name} payable balance is ₹${notificationAmount(
                            payable
                        )}.`,

                    severity:
                        "warning",

                    referenceId:
                        supplier.id,

                    referenceType:
                        "supplier"

                });

            }
        );

}


/* ============================================================
   RECENT PAYMENT ALERTS
   ============================================================ */

function generateRecentPaymentNotifications() {

    if (
        !NOTIFICATION_CONFIG.recentPayment
    ) {

        return;

    }


    let payments = [];


    if (
        window.MMVPyments &&
        typeof
        window.MMVPyments
            .loadPayments ===
        "function"
    ) {

        /*
         * Do not reload Firebase here.
         * payments.js already manages the
         * payment data.
         */

        return;

    }


    /*
     * This section becomes active when
     * payment cache is exposed.
     */

    if (
        window.MMVPyments &&
        Array.isArray(
            window.MMVPyments
                .paymentCache
        )
    ) {

        payments =
            window.MMVPyments
                .paymentCache;

    }


    if (
        payments.length === 0
    ) {

        return;

    }


    const cutoff =
        Date.now() -
        (
            NOTIFICATION_CONFIG
                .recentPaymentHours *
            60 *
            60 *
            1000
        );


    payments
        .filter(
            payment => {

                const date =
                    notificationDate(
                        payment.createdAt ||
                        payment.paymentDate
                    );


                return (
                    date &&
                    date.getTime() >=
                    cutoff
                );

            }
        )
        .slice(
            0,
            10
        )
        .forEach(
            payment => {

                const type =
                    payment.type ===
                    "SUPPLIER"
                        ? "Supplier Payment"
                        : "Customer Receipt";


                const party =
                    payment.customerName ||
                    payment.supplierName ||
                    "Party";


                addNotification({

                    id:
                        createNotificationId(
                            "PAYMENT",
                            payment.id
                        ),

                    type:
                        "PAYMENT",

                    title:
                        type,

                    message:
                        `${party} — ₹${notificationAmount(
                            payment.amount
                        )}`,

                    severity:
                        "success",

                    referenceId:
                        payment.id,

                    referenceType:
                        "payment"

                });

            }
        );

}


/* ============================================================
   DAILY SUMMARY
   ============================================================ */

function generateDailySummaryNotification() {

    if (
        !NOTIFICATION_CONFIG.dailySummary
    ) {

        return;

    }


    if (
        !window.MMVDashboard ||
        typeof
        window.MMVDashboard
            .getDashboardSnapshot !==
        "function"
    ) {

        return;

    }


    const dashboard =
        window.MMVDashboard
            .getDashboardSnapshot();


    if (!dashboard) {

        return;

    }


    const today =
        notificationToday();


    addNotification({

        id:
            `DAILY_SUMMARY_${today}`,

        type:
            "DAILY_SUMMARY",

        title:
            "Today's Business Summary",

        message:
            `Sales ₹${notificationAmount(
                dashboard.todaySales
            )} · Purchase ₹${notificationAmount(
                dashboard.todayPurchase
            )} · Profit ₹${notificationAmount(
                dashboard.todayProfit
            )}`,

        severity:
            "info",

        referenceId:
            today,

        referenceType:
            "dashboard"

    });

}


/* ============================================================
   GENERATE ALL
   ============================================================ */

function generateNotifications() {

    notificationState.notifications =
        [];


    generateLowStockNotifications();

    generateCustomerOutstandingNotifications();

    generateSupplierPayableNotifications();

    generateRecentPaymentNotifications();

    generateDailySummaryNotification();


    /*
     * Newest first.
     */

    notificationState.notifications
        .sort(
            (
                a,
                b
            ) => {

                const dateA =
                    notificationDate(
                        a.createdAt
                    )?.getTime() ||
                    0;


                const dateB =
                    notificationDate(
                        b.createdAt
                    )?.getTime() ||
                    0;


                return dateB -
                    dateA;

            }
        );


    notificationState.notifications =
        notificationState.notifications
            .slice(
                0,
                NOTIFICATION_CONFIG.maxItems
            );


    updateUnreadCount();

    renderNotifications();


    notificationState.lastGeneratedAt =
        new Date();


    return notificationState
        .notifications;

}


/* ============================================================
   UNREAD COUNT
   ============================================================ */

function updateUnreadCount() {

    notificationState.unreadCount =
        notificationState.notifications
            .filter(
                notification =>
                    !notification.read
            )
            .length;


    setNotificationText(
        [
            "notificationCount",
            "notificationBadge",
            "unreadNotificationCount"
        ],
        notificationState.unreadCount
    );


    const badge =
        notificationEl(
            "notificationBadge"
        );


    if (badge) {

        badge.style.display =
            notificationState
                .unreadCount > 0
                ? ""
                : "none";

    }

}


/* ============================================================
   RENDER
   ============================================================ */

function renderNotifications() {

    const container =
        notificationEl(
            "notificationList"
        );


    if (!container) {

        return;

    }


    const notifications =
        notificationState
            .notifications;


    if (
        notifications.length ===
        0
    ) {

        container.innerHTML = `

            <div
                class="notification-empty"
            >

                <strong>
                    All clear
                </strong>

                <span>
                    No new business alerts.
                </span>

            </div>

        `;

        return;

    }


    container.innerHTML =
        notifications
            .map(
                notification => {

                    const unread =
                        !notification.read;


                    const severity =
                        escapeNotificationHTML(
                            notification.severity
                        );


                    return `

                        <div
                            class="
                                notification-item
                                ${unread
                                    ? "unread"
                                    : ""}
                                severity-${severity}
                            "
                            data-notification-id="${escapeNotificationHTML(
                                notification.id
                            )}"
                        >

                            <div
                                class="notification-icon"
                            >

                                ${
                                    notification.type ===
                                    "LOW_STOCK"
                                        ? "!"
                                        : notification.type ===
                                          "CUSTOMER_DUE"
                                            ? "₹"
                                            : notification.type ===
                                              "SUPPLIER_DUE"
                                                ? "!"
                                                : notification.type ===
                                                  "PAYMENT"
                                                    ? "✓"
                                                    : "i"
                                }

                            </div>


                            <div
                                class="notification-content"
                            >

                                <strong>
                                    ${escapeNotificationHTML(
                                        notification.title
                                    )}
                                </strong>


                                <p>
                                    ${escapeNotificationHTML(
                                        notification.message
                                    )}
                                </p>


                                <small>
                                    ${formatNotificationTime(
                                        notification.createdAt
                                    )}
                                </small>

                            </div>


                            ${
                                unread
                                    ? `

                                        <button
                                            type="button"
                                            class="notification-read-button"
                                            data-mark-read="${escapeNotificationHTML(
                                                notification.id
                                            )}"
                                            title="Mark as read"
                                        >
                                            ✓
                                        </button>

                                    `
                                    : ""
                            }

                        </div>

                    `;

                }
            )
            .join("");


    bindNotificationReadButtons();

}


/* ============================================================
   FORMAT TIME
   ============================================================ */

function formatNotificationTime(
    value
) {

    const date =
        notificationDate(
            value
        );


    if (!date) {

        return "";

    }


    return date.toLocaleString(
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
    );

}


/* ============================================================
   MARK AS READ
   ============================================================ */

function markNotificationRead(
    notificationId
) {

    const notification =
        notificationState
            .notifications
            .find(
                item =>
                    item.id ===
                    notificationId
            );


    if (!notification) {

        return;

    }


    notification.read =
        true;


    updateUnreadCount();

    renderNotifications();

}


/* ============================================================
   MARK ALL READ
   ============================================================ */

function markAllNotificationsRead() {

    notificationState
        .notifications
        .forEach(
            notification => {

                notification.read =
                    true;

            }
        );


    updateUnreadCount();

    renderNotifications();

}


/* ============================================================
   BUTTON EVENTS
   ============================================================ */

function bindNotificationReadButtons() {

    const buttons =
        document.querySelectorAll(
            "[data-mark-read]"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();


                    const id =
                        button.getAttribute(
                            "data-mark-read"
                        );


                    markNotificationRead(
                        id
                    );

                }
            );

        }
    );

}


/* ============================================================
   NOTIFICATION PANEL
   ============================================================ */

function openNotificationPanel() {

    const panel =
        notificationEl(
            "notificationPanel"
        );


    if (!panel) {

        return;

    }


    panel.classList.add(
        "open"
    );


    panel.setAttribute(
        "aria-hidden",
        "false"
    );


    renderNotifications();

}


function closeNotificationPanel() {

    const panel =
        notificationEl(
            "notificationPanel"
        );


    if (!panel) {

        return;

    }


    panel.classList.remove(
        "open"
    );


    panel.setAttribute(
        "aria-hidden",
        "true"
    );

}


function toggleNotificationPanel() {

    const panel =
        notificationEl(
            "notificationPanel"
        );


    if (!panel) {

        return;

    }


    if (
        panel.classList.contains(
            "open"
        )
    ) {

        closeNotificationPanel();

    }
    else {

        openNotificationPanel();

    }

}


/* ============================================================
   HEADER BUTTON
   ============================================================ */

function bindNotificationToggle() {

    const buttons =
        document.querySelectorAll(
            "[data-notification-toggle]"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    toggleNotificationPanel();

                }
            );

        }
    );

}


/* ============================================================
   CLOSE OUTSIDE CLICK
   ============================================================ */

function bindOutsideClick() {

    document.addEventListener(
        "click",
        event => {

            const panel =
                notificationEl(
                    "notificationPanel"
                );


            if (!panel) {

                return;

            }


            const toggle =
                event.target.closest(
                    "[data-notification-toggle]"
                );


            if (
                !toggle &&
                !panel.contains(
                    event.target
                )
            ) {

                closeNotificationPanel();

            }

        }
    );

}


/* ============================================================
   REFRESH
   ============================================================ */

async function refreshNotifications() {

    generateNotifications();

}


/* ============================================================
   NOTIFICATION TEXT
   ============================================================ */

function setNotificationText(
    ids,
    text
) {

    if (!Array.isArray(ids)) {

        ids = [ids];

    }


    ids.forEach(
        id => {

            const node =
                notificationEl(
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
   SNAPSHOT
   ============================================================ */

function getNotificationSnapshot() {

    return {

        notifications:
            [
                ...notificationState
                    .notifications
            ],

        unreadCount:
            notificationState
                .unreadCount,

        lastGeneratedAt:
            notificationState
                .lastGeneratedAt

    };

}


/* ============================================================
   INITIALIZE
   ============================================================ */

function initializeNotifications() {

    if (
        notificationState.initialized
    ) {

        return;

    }


    notificationState.initialized =
        true;


    bindNotificationToggle();

    bindOutsideClick();

    generateNotifications();

}


/* ============================================================
   DOM READY
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /*
         * Dashboard / master modules
         * should already be available.
         */

        initializeNotifications();

    }
);


/* ============================================================
   GLOBAL API
   ============================================================ */

window.MMVNotifications = {

    initialize:
        initializeNotifications,

    generate:
        generateNotifications,

    refresh:
        refreshNotifications,

    render:
        renderNotifications,

    markRead:
        markNotificationRead,

    markAllRead:
        markAllNotificationsRead,

    open:
        openNotificationPanel,

    close:
        closeNotificationPanel,

    toggle:
        toggleNotificationPanel,

    getSnapshot:
        getNotificationSnapshot

};


window.generateNotifications =
    generateNotifications;

window.refreshNotifications =
    refreshNotifications;

window.markAllNotificationsRead =
    markAllNotificationsRead;

window.toggleNotificationPanel =
    toggleNotificationPanel;


console.info(
    "%cMMV Notifications V2%c ready",
    "font-weight:800;color:#0a3d91;",
    "color:inherit;"
);
