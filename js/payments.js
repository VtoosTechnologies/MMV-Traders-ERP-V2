/* ============================================================
   MMV TRADERS ERP V2
   PAYMENTS SERVICE
   Production Firebase + Firestore
   ------------------------------------------------------------
   Handles:
   - Customer Receipts
   - Supplier Payments
   - Automatic Receipt / Payment numbering
   - Customer outstanding reduction
   - Supplier outstanding reduction
   - Cash / UPI / Card / Bank / Other
   - Payment reference
   - Payment history
   - Transaction-safe balance updates
   ============================================================ */

"use strict";

import {
    collection,
    getDocs,
    addDoc,
    doc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    runTransaction
} from
"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
    db,
    auth
} from "./firebase.js";


/* ============================================================
   COLLECTIONS
   ============================================================ */

const PAYMENTS =
    "payments";

const CUSTOMERS =
    "customers";

const SUPPLIERS =
    "suppliers";

const SALES =
    "sales";

const PURCHASES =
    "purchases";


/* ============================================================
   CONFIG
   ============================================================ */

const RECEIPT_PREFIX =
    "REC-";

const PAYMENT_PREFIX =
    "PAY-";

const MAX_RESULTS =
    500;


/* ============================================================
   STATE
   ============================================================ */

let paymentCache = [];

let customerCache = [];

let supplierCache = [];

let selectedPaymentType =
    "CUSTOMER";


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


function value(...ids) {

    for (const id of ids) {

        const node =
            el(id);

        if (node) {

            return clean(
                node.value
            );

        }

    }

    return "";

}


function setValue(
    ids,
    newValue
) {

    if (!Array.isArray(ids)) {

        ids = [ids];

    }


    for (const id of ids) {

        const node =
            el(id);

        if (node) {

            node.value =
                newValue ?? "";

            return;

        }

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

        return "-";

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

            return "-";

        }


        return date.toLocaleDateString(
            "en-IN"
        );

    }
    catch {

        return "-";

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


function currentUserId() {

    return (
        auth?.currentUser?.uid ||
        null
    );

}


/* ============================================================
   PAYMENT NUMBER
   ============================================================ */

async function generatePaymentNumber(
    type = "CUSTOMER"
) {

    const prefix =
        type === "SUPPLIER"
            ? PAYMENT_PREFIX
            : RECEIPT_PREFIX;


    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        PAYMENTS
                    ),
                    orderBy(
                        "paymentNumber",
                        "desc"
                    ),
                    limit(100)
                )
            );


        let highest =
            0;


        snapshot.forEach(
            item => {

                const payment =
                    clean(
                        item.data()
                            .paymentNumber
                    );


                const match =
                    payment.match(
                        /(\d+)$/
                    );


                if (match) {

                    const number =
                        Number(
                            match[1]
                        );


                    if (
                        number >
                        highest
                    ) {

                        highest =
                            number;

                    }

                }

            }
        );


        return (
            prefix +
            String(
                highest + 1
            ).padStart(
                6,
                "0"
            )
        );

    }
    catch(error) {

        console.warn(
            "Payment number fallback:",
            error
        );


        return (
            prefix +
            Date.now()
                .toString()
                .slice(-6)
        );

    }

}


/* ============================================================
   LOAD CUSTOMERS
   ============================================================ */

async function loadPaymentCustomers() {

    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        CUSTOMERS
                    ),
                    limit(
                        MAX_RESULTS
                    )
                )
            );


        customerCache =
            snapshot.docs.map(
                item => ({

                    id:
                        item.id,

                    ...item.data()

                })
            );


        customerCache.sort(
            (a, b) =>
                String(
                    a.customerName ||
                    a.name ||
                    ""
                ).localeCompare(
                    String(
                        b.customerName ||
                        b.name ||
                        ""
                    )
                )
        );


        populateCustomerSelect();


        return customerCache;

    }
    catch(error) {

        console.error(
            "Customer load error:",
            error
        );


        showMessage(
            getErrorMessage(error),
            "error"
        );


        return [];

    }

}


/* ============================================================
   LOAD SUPPLIERS
   ============================================================ */

async function loadPaymentSuppliers() {

    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        SUPPLIERS
                    ),
                    limit(
                        MAX_RESULTS
                    )
                )
            );


        supplierCache =
            snapshot.docs.map(
                item => ({

                    id:
                        item.id,

                    ...item.data()

                })
            );


        supplierCache.sort(
            (a, b) =>
                String(
                    a.supplierName ||
                    ""
                ).localeCompare(
                    String(
                        b.supplierName ||
                        ""
                    )
                )
        );


        populateSupplierSelect();


        return supplierCache;

    }
    catch(error) {

        console.error(
            "Supplier load error:",
            error
        );


        showMessage(
            getErrorMessage(error),
            "error"
        );


        return [];

    }

}


/* ============================================================
   CUSTOMER DROPDOWN
   ============================================================ */

function populateCustomerSelect() {

    const ids = [

        "customerId",
        "paymentCustomer",
        "customerSelect"

    ];


    let select =
        null;


    for (const id of ids) {

        const node =
            el(id);

        if (
            node &&
            node.tagName ===
            "SELECT"
        ) {

            select =
                node;

            break;

        }

    }


    if (!select) {

        return;

    }


    const current =
        select.value;


    select.innerHTML = `

        <option value="">
            Select customer
        </option>

        ${
            customerCache
                .map(
                    customer => `

                        <option
                            value="${escapeHTML(
                                customer.id
                            )}"
                        >

                            ${escapeHTML(
                                customer.customerName ||
                                customer.name ||
                                "Customer"
                            )}

                        </option>

                    `
                )
                .join("")
        }

    `;


    if (current) {

        select.value =
            current;

    }

}


/* ============================================================
   SUPPLIER DROPDOWN
   ============================================================ */

function populateSupplierSelect() {

    const ids = [

        "supplierId",
        "paymentSupplier",
        "supplierSelect"

    ];


    let select =
        null;


    for (const id of ids) {

        const node =
            el(id);

        if (
            node &&
            node.tagName ===
            "SELECT"
        ) {

            select =
                node;

            break;

        }

    }


    if (!select) {

        return;

    }


    const current =
        select.value;


    select.innerHTML = `

        <option value="">
            Select supplier
        </option>

        ${
            supplierCache
                .map(
                    supplier => `

                        <option
                            value="${escapeHTML(
                                supplier.id
                            )}"
                        >

                            ${escapeHTML(
                                supplier.supplierName ||
                                "Supplier"
                            )}

                        </option>

                    `
                )
                .join("")
        }

    `;


    if (current) {

        select.value =
            current;

    }

}


/* ============================================================
   CUSTOMER OUTSTANDING
   ============================================================ */

async function getCustomerOutstanding(
    customerId
) {

    if (!customerId) {

        return 0;

    }


    const reference =
        doc(
            db,
            CUSTOMERS,
            customerId
        );


    const snapshot =
        await runTransaction(
            db,
            async transaction => {

                return await transaction.get(
                    reference
                );

            }
        );


    if (
        !snapshot.exists()
    ) {

        throw new Error(
            "Customer not found."
        );

    }


    return numberValue(
        snapshot.data()
            .outstanding
    );

}


/* ============================================================
   SUPPLIER OUTSTANDING
   ============================================================ */

async function getSupplierOutstanding(
    supplierId
) {

    if (!supplierId) {

        return 0;

    }


    const reference =
        doc(
            db,
            SUPPLIERS,
            supplierId
        );


    const snapshot =
        await runTransaction(
            db,
            async transaction => {

                return await transaction.get(
                    reference
                );

            }
        );


    if (
        !snapshot.exists()
    ) {

        throw new Error(
            "Supplier not found."
        );

    }


    const data =
        snapshot.data();


    return numberValue(
        data.outstanding ??
        data.payable
    );

}


/* ============================================================
   UPDATE FORM BALANCE
   ============================================================ */

async function updateOutstandingPreview() {

    const type =
        selectedPaymentType;


    const partyId =
        type === "SUPPLIER"
            ? value(
                "supplierId",
                "paymentSupplier",
                "supplierSelect"
            )
            : value(
                "customerId",
                "paymentCustomer",
                "customerSelect"
            );


    if (!partyId) {

        setText(
            [
                "currentOutstanding",
                "partyOutstanding",
                "outstandingBalance"
            ],
            "₹0.00"
        );

        return;

    }


    try {

        const outstanding =
            type === "SUPPLIER"
                ? await getSupplierOutstanding(
                    partyId
                )
                : await getCustomerOutstanding(
                    partyId
                );


        setText(
            [
                "currentOutstanding",
                "partyOutstanding",
                "outstandingBalance"
            ],
            "₹" +
            formatAmount(
                outstanding
            )
        );

    }
    catch(error) {

        console.error(
            error
        );

    }

}


/* ============================================================
   SELECT PAYMENT TYPE
   ============================================================ */

function setPaymentType(
    type
) {

    selectedPaymentType =
        type === "SUPPLIER"
            ? "SUPPLIER"
            : "CUSTOMER";


    setValue(
        [
            "paymentType"
        ],
        selectedPaymentType
    );


    const customerSection =
        el(
            "customerPaymentSection"
        );


    const supplierSection =
        el(
            "supplierPaymentSection"
        );


    if (customerSection) {

        customerSection.style.display =
            selectedPaymentType ===
            "CUSTOMER"
                ? ""
                : "none";

    }


    if (supplierSection) {

        supplierSection.style.display =
            selectedPaymentType ===
            "SUPPLIER"
                ? ""
                : "none";

    }


    const customerButton =
        el(
            "customerPaymentButton"
        );


    const supplierButton =
        el(
            "supplierPaymentButton"
        );


    if (customerButton) {

        customerButton.classList.toggle(
            "active",
            selectedPaymentType ===
            "CUSTOMER"
        );

    }


    if (supplierButton) {

        supplierButton.classList.toggle(
            "active",
            selectedPaymentType ===
            "SUPPLIER"
        );

    }


    generatePaymentNumber(
        selectedPaymentType
    )
    .then(
        number => {

            setValue(
                [
                    "paymentNumber",
                    "receiptNumber"
                ],
                number
            );

        }
    );


    updateOutstandingPreview();

}


/* ============================================================
   PAYMENT FORM DATA
   ============================================================ */

function getPaymentFormData() {

    const type =
        selectedPaymentType;


    const customerId =
        type === "CUSTOMER"
            ? value(
                "customerId",
                "paymentCustomer",
                "customerSelect"
            )
            : "";


    const supplierId =
        type === "SUPPLIER"
            ? value(
                "supplierId",
                "paymentSupplier",
                "supplierSelect"
            )
            : "";


    const customer =
        customerCache.find(
            item =>
                item.id ===
                customerId
        ) || null;


    const supplier =
        supplierCache.find(
            item =>
                item.id ===
                supplierId
        ) || null;


    return {

        type,

        paymentNumber:
            value(
                "paymentNumber",
                "receiptNumber"
            ),

        paymentDate:
            value(
                "paymentDate",
                "receiptDate"
            ),

        customerId,

        customerName:
            customer?.customerName ||
            customer?.name ||
            "",

        supplierId,

        supplierName:
            supplier?.supplierName ||
            "",

        amount:
            numberValue(
                value(
                    "paymentAmount",
                    "amount",
                    "receivedAmount"
                )
            ),

        paymentMode:
            value(
                "paymentMode",
                "paymentMethod"
            ) ||
            "Cash",

        referenceNumber:
            value(
                "referenceNumber",
                "transactionReference",
                "utrNumber"
            ),

        invoiceNumber:
            value(
                "invoiceNumber",
                "againstInvoice"
            ),

        notes:
            value(
                "notes",
                "remarks"
            )

    };

}


/* ============================================================
   VALIDATE
   ============================================================ */

function validatePayment(
    data
) {

    if (
        data.type ===
        "CUSTOMER" &&
        !data.customerId
    ) {

        throw new Error(
            "Please select a customer."
        );

    }


    if (
        data.type ===
        "SUPPLIER" &&
        !data.supplierId
    ) {

        throw new Error(
            "Please select a supplier."
        );

    }


    if (
        data.amount <= 0
    ) {

        throw new Error(
            "Payment amount must be greater than zero."
        );

    }


    if (
        data.paymentMode ===
        "UPI" &&
        !data.referenceNumber
    ) {

        throw new Error(
            "UPI transaction reference is required."
        );

    }


    if (
        data.paymentMode ===
        "Bank" &&
        !data.referenceNumber
    ) {

        throw new Error(
            "Bank transaction reference is required."
        );

    }

}


/* ============================================================
   SAVE PAYMENT
   ============================================================ */

async function savePayment() {

    try {

        const data =
            getPaymentFormData();


        validatePayment(
            data
        );


        if (
            !data.paymentNumber
        ) {

            data.paymentNumber =
                await generatePaymentNumber(
                    data.type
                );

        }


        const userId =
            currentUserId();


        let paymentId =
            null;


        await runTransaction(
            db,
            async transaction => {

                /*
                 * CUSTOMER RECEIPT
                 */

                if (
                    data.type ===
                    "CUSTOMER"
                ) {

                    const customerReference =
                        doc(
                            db,
                            CUSTOMERS,
                            data.customerId
                        );


                    const customerSnapshot =
                        await transaction.get(
                            customerReference
                        );


                    if (
                        !customerSnapshot.exists()
                    ) {

                        throw new Error(
                            "Customer record not found."
                        );

                    }


                    const customer =
                        customerSnapshot.data();


                    const oldOutstanding =
                        numberValue(
                            customer.outstanding
                        );


                    if (
                        data.amount >
                        oldOutstanding
                    ) {

                        throw new Error(
                            `Payment exceeds customer outstanding. Outstanding: ₹${formatAmount(
                                oldOutstanding
                            )}`
                        );

                    }


                    const newOutstanding =
                        oldOutstanding -
                        data.amount;


                    const oldReceivable =
                        numberValue(
                            customer.receivable
                        );


                    const newReceivable =
                        Math.max(
                            oldReceivable -
                            data.amount,
                            0
                        );


                    const paymentReference =
                        doc(
                            collection(
                                db,
                                PAYMENTS
                            )
                        );


                    paymentId =
                        paymentReference.id;


                    transaction.set(
                        paymentReference,
                        {

                            paymentNumber:
                                data.paymentNumber,

                            type:
                                "CUSTOMER",

                            paymentDate:
                                data.paymentDate ||
                                null,

                            customerId:
                                data.customerId,

                            customerName:
                                data.customerName,

                            amount:
                                data.amount,

                            paymentMode:
                                data.paymentMode,

                            referenceNumber:
                                data.referenceNumber,

                            invoiceNumber:
                                data.invoiceNumber,

                            notes:
                                data.notes,

                            previousOutstanding:
                                oldOutstanding,

                            remainingOutstanding:
                                newOutstanding,

                            status:
                                "Posted",

                            createdAt:
                                serverTimestamp(),

                            updatedAt:
                                serverTimestamp(),

                            createdBy:
                                userId,

                            updatedBy:
                                userId

                        }
                    );


                    transaction.update(
                        customerReference,
                        {

                            outstanding:
                                newOutstanding,

                            receivable:
                                newReceivable,

                            lastPaymentNumber:
                                data.paymentNumber,

                            lastPaymentAmount:
                                data.amount,

                            updatedAt:
                                serverTimestamp(),

                            updatedBy:
                                userId

                        }
                    );

                }


                /*
                 * SUPPLIER PAYMENT
                 */

                else {

                    const supplierReference =
                        doc(
                            db,
                            SUPPLIERS,
                            data.supplierId
                        );


                    const supplierSnapshot =
                        await transaction.get(
                            supplierReference
                        );


                    if (
                        !supplierSnapshot.exists()
                    ) {

                        throw new Error(
                            "Supplier record not found."
                        );

                    }


                    const supplier =
                        supplierSnapshot.data();


                    const oldOutstanding =
                        numberValue(
                            supplier.outstanding ??
                            supplier.payable
                        );


                    if (
                        data.amount >
                        oldOutstanding
                    ) {

                        throw new Error(
                            `Payment exceeds supplier outstanding. Outstanding: ₹${formatAmount(
                                oldOutstanding
                            )}`
                        );

                    }


                    const newOutstanding =
                        oldOutstanding -
                        data.amount;


                    const paymentReference =
                        doc(
                            collection(
                                db,
                                PAYMENTS
                            )
                        );


                    paymentId =
                        paymentReference.id;


                    transaction.set(
                        paymentReference,
                        {

                            paymentNumber:
                                data.paymentNumber,

                            type:
                                "SUPPLIER",

                            paymentDate:
                                data.paymentDate ||
                                null,

                            supplierId:
                                data.supplierId,

                            supplierName:
                                data.supplierName,

                            amount:
                                data.amount,

                            paymentMode:
                                data.paymentMode,

                            referenceNumber:
                                data.referenceNumber,

                            invoiceNumber:
                                data.invoiceNumber,

                            notes:
                                data.notes,

                            previousOutstanding:
                                oldOutstanding,

                            remainingOutstanding:
                                newOutstanding,

                            status:
                                "Posted",

                            createdAt:
                                serverTimestamp(),

                            updatedAt:
                                serverTimestamp(),

                            createdBy:
                                userId,

                            updatedBy:
                                userId

                        }
                    );


                    transaction.update(
                        supplierReference,
                        {

                            outstanding:
                                newOutstanding,

                            payable:
                                newOutstanding,

                            lastPaymentNumber:
                                data.paymentNumber,

                            lastPaymentAmount:
                                data.amount,

                            updatedAt:
                                serverTimestamp(),

                            updatedBy:
                                userId

                        }
                    );

                }

            }
        );


        showMessage(
            `${data.type === "CUSTOMER" ? "Receipt" : "Payment"} ${data.paymentNumber} posted successfully.`,
            "success"
        );


        await clearPaymentForm();

        await loadPayments();


        return paymentId;

    }
    catch(error) {

        console.error(
            "Save payment error:",
            error
        );


        showMessage(
            getErrorMessage(error),
            "error"
        );


        return null;

    }

}


/* ============================================================
   LOAD PAYMENTS
   ============================================================ */

async function loadPayments() {

    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        PAYMENTS
                    ),
                    orderBy(
                        "createdAt",
                        "desc"
                    ),
                    limit(
                        MAX_RESULTS
                    )
                )
            );


        paymentCache =
            snapshot.docs.map(
                item => ({

                    id:
                        item.id,

                    ...item.data()

                })
            );


        renderPayments(
            paymentCache
        );


        updatePaymentSummary(
            paymentCache
        );


        return paymentCache;

    }
    catch(error) {

        console.error(
            "Payment history load error:",
            error
        );


        try {

            const snapshot =
                await getDocs(
                    query(
                        collection(
                            db,
                            PAYMENTS
                        ),
                        limit(
                            MAX_RESULTS
                        )
                    )
                );


            paymentCache =
                snapshot.docs.map(
                    item => ({

                        id:
                            item.id,

                        ...item.data()

                    })
                );


            renderPayments(
                paymentCache
            );


            updatePaymentSummary(
                paymentCache
            );


            return paymentCache;

        }
        catch(
            fallbackError
        ) {

            showMessage(
                getErrorMessage(
                    fallbackError
                ),
                "error"
            );


            return [];

        }

    }

}


/* ============================================================
   RENDER PAYMENTS
   ============================================================ */

function renderPayments(
    payments
) {

    const table =
        el(
            "paymentsTable"
        );


    if (!table) {

        return;

    }


    const search =
        value(
            "paymentSearch",
            "search"
        )
        .toLowerCase();


    const filtered =
        payments.filter(
            payment => {

                const text =
                    [

                        payment.paymentNumber,

                        payment.customerName,

                        payment.supplierName,

                        payment.paymentMode,

                        payment.referenceNumber

                    ]
                    .join(" ")
                    .toLowerCase();


                return (
                    !search ||
                    text.includes(
                        search
                    )
                );

            }
        );


    if (
        filtered.length ===
        0
    ) {

        table.innerHTML = `

            <tr>

                <td colspan="100%">

                    <div class="empty-state">

                        <strong>
                            No payments found
                        </strong>

                        <span>
                            Posted receipts and supplier payments will appear here.
                        </span>

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    table.innerHTML =
        filtered
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
                                payment.paymentDate
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

                        <td>

                            <span
                                class="active-badge"
                            >
                                ${escapeHTML(
                                    payment.status ||
                                    "Posted"
                                )}
                            </span>

                        </td>

                        <td>

                            <button
                                type="button"
                                onclick="viewPayment('${escapeHTML(
                                    payment.id
                                )}')"
                            >
                                View
                            </button>

                        </td>

                    </tr>

                `
            )
            .join("");

}


/* ============================================================
   SUMMARY
   ============================================================ */

function updatePaymentSummary(
    payments
) {

    const customerReceipts =
        payments.filter(
            payment =>
                payment.type ===
                "CUSTOMER"
        );


    const supplierPayments =
        payments.filter(
            payment =>
                payment.type ===
                "SUPPLIER"
        );


    const totalReceipts =
        customerReceipts.reduce(
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


    const totalSupplierPayments =
        supplierPayments.reduce(
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


    setText(
        [
            "totalPayments",
            "paymentCount"
        ],
        payments.length
    );


    setText(
        [
            "customerReceipts",
            "totalReceipts"
        ],
        "₹" +
        formatAmount(
            totalReceipts
        )
    );


    setText(
        [
            "supplierPayments",
            "totalSupplierPayments"
        ],
        "₹" +
        formatAmount(
            totalSupplierPayments
        )
    );

}


/* ============================================================
   VIEW PAYMENT
   ============================================================ */

function viewPayment(
    paymentId
) {

    const payment =
        paymentCache.find(
            item =>
                item.id ===
                paymentId
        );


    if (!payment) {

        showMessage(
            "Payment record not found.",
            "error"
        );

        return;

    }


    const modal =
        el(
            "paymentViewModal"
        );


    if (modal) {

        const content =
            modal.querySelector(
                "[data-payment-content]"
            );


        if (content) {

            content.innerHTML = `

                <div class="payment-view">

                    <h3>
                        ${escapeHTML(
                            payment.paymentNumber
                        )}
                    </h3>

                    <p>
                        Type:
                        <strong>
                            ${
                                payment.type ===
                                "SUPPLIER"
                                    ? "Supplier Payment"
                                    : "Customer Receipt"
                            }
                        </strong>
                    </p>

                    <p>
                        Party:
                        <strong>
                            ${escapeHTML(
                                payment.customerName ||
                                payment.supplierName ||
                                "-"
                            )}
                        </strong>
                    </p>

                    <p>
                        Amount:
                        <strong>
                            ₹${formatAmount(
                                payment.amount
                            )}
                        </strong>
                    </p>

                    <p>
                        Mode:
                        ${escapeHTML(
                            payment.paymentMode ||
                            "-"
                        )}
                    </p>

                    <p>
                        Reference:
                        ${escapeHTML(
                            payment.referenceNumber ||
                            "-"
                        )}
                    </p>

                    <p>
                        Remaining Outstanding:
                        <strong>
                            ₹${formatAmount(
                                payment.remainingOutstanding
                            )}
                        </strong>
                    </p>

                </div>

            `;

        }


        modal.classList.add(
            "open"
        );


        return;

    }


    showMessage(
        `${payment.paymentNumber} — ₹${formatAmount(
            payment.amount
        )}`,
        "info"
    );

}


/* ============================================================
   CLEAR FORM
   ============================================================ */

async function clearPaymentForm() {

    const form =
        el(
            "paymentForm"
        );


    if (form) {

        form.reset();

    }


    const number =
        await generatePaymentNumber(
            selectedPaymentType
        );


    setValue(
        [
            "paymentNumber",
            "receiptNumber"
        ],
        number
    );


    const today =
        new Date()
            .toISOString()
            .split("T")[0];


    setValue(
        [
            "paymentDate",
            "receiptDate"
        ],
        today
    );


    setText(
        [
            "currentOutstanding",
            "partyOutstanding",
            "outstandingBalance"
        ],
        "₹0.00"
    );

}


/* ============================================================
   PAYMENT AMOUNT PREVIEW
   ============================================================ */

function bindPaymentAmountEvents() {

    [

        "paymentAmount",

        "amount",

        "receivedAmount"

    ]
    .forEach(
        id => {

            const node =
                el(id);


            if (!node) {

                return;

            }


            node.addEventListener(
                "input",
                () => {

                    updateOutstandingPreview();

                }
            );

        }
    );

}


/* ============================================================
   PARTY SELECT EVENTS
   ============================================================ */

function bindPartyEvents() {

    [

        "customerId",

        "paymentCustomer",

        "customerSelect",

        "supplierId",

        "paymentSupplier",

        "supplierSelect"

    ]
    .forEach(
        id => {

            const node =
                el(id);


            if (!node) {

                return;

            }


            node.addEventListener(
                "change",
                () => {

                    updateOutstandingPreview();

                }
            );

        }
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
            "mmvPaymentMessage"
        );


    if (!box) {

        box =
            document.createElement(
                "div"
            );


        box.id =
            "mmvPaymentMessage";


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

        box.style.border =
            "1px solid #bce7ce";

    }
    else if (
        type ===
        "error"
    ) {

        box.style.background =
            "#fff0f0";

        box.style.color =
            "#b42318";

        box.style.border =
            "1px solid #f1c5c5";

    }
    else {

        box.style.background =
            "#eef5ff";

        box.style.color =
            "#174a91";

        box.style.border =
            "1px solid #c9ddfa";

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
   ERROR HANDLER
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

        return "You do not have permission for this action.";

    }


    if (
        code.includes(
            "failed-precondition"
        )
    ) {

        return "Firestore index is required for this query.";

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
        "Unable to complete the payment."
    );

}


/* ============================================================
   DOM READY
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await Promise.all([

            loadPaymentCustomers(),

            loadPaymentSuppliers()

        ]);


        const paymentNumber =
            await generatePaymentNumber(
                selectedPaymentType
            );


        setValue(
            [
                "paymentNumber",
                "receiptNumber"
            ],
            paymentNumber
        );


        const today =
            new Date()
                .toISOString()
                .split("T")[0];


        setValue(
            [
                "paymentDate",
                "receiptDate"
            ],
            today
        );


        bindPaymentAmountEvents();

        bindPartyEvents();


        const search =
            el(
                "paymentSearch"
            );


        if (search) {

            search.addEventListener(
                "input",
                () =>
                    renderPayments(
                        paymentCache
                    )
            );

        }


        await loadPayments();

    }
);


/* ============================================================
   GLOBAL API
   ============================================================ */

window.MMVPyments = {

    savePayment,

    loadPayments,

    loadPaymentCustomers,

    loadPaymentSuppliers,

    generatePaymentNumber,

    setPaymentType,

    updateOutstandingPreview,

    clearPaymentForm,

    viewPayment

};


window.savePayment =
    savePayment;

window.loadPayments =
    loadPayments;

window.generatePaymentNumber =
    generatePaymentNumber;

window.setPaymentType =
    setPaymentType;

window.updateOutstandingPreview =
    updateOutstandingPreview;

window.clearPaymentForm =
    clearPaymentForm;

window.viewPayment =
    viewPayment;


console.info(
    "%cMMV Payments V2%c ready",
    "font-weight:800;color:#0a3d91;",
    "color:inherit;"
);
