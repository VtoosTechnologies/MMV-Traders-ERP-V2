/* ============================================================
   MMV TRADERS ERP V2
   SALES / INVOICE SERVICE
   Production Firebase + Firestore
   ------------------------------------------------------------
   Handles:
   - Automatic sales invoice numbering
   - Customer selection
   - Walk-in customer support
   - Material selection
   - HSN / GST / selling rate
   - Stock availability validation
   - Stock OUT
   - Customer receivable / outstanding
   - Cash / UPI / Card / Bank / Credit
   - Profit calculation
   - Sales history
   - Duplicate invoice protection
   - Posted invoice protection
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

const SALES =
    "sales";

const SALES_ITEMS =
    "salesItems";

const CUSTOMERS =
    "customers";

const MATERIALS =
    "materials";

const INVENTORY =
    "inventory";


/* ============================================================
   CONFIG
   ============================================================ */

const INVOICE_PREFIX =
    "INV-";

const MAX_RESULTS =
    500;


/* ============================================================
   STATE
   ============================================================ */

let salesCache = [];

let customerCache = [];

let materialCache = [];

let editingSaleId = null;


/* ============================================================
   BASIC HELPERS
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

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
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


function escapeHTML(
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


function formatAmount(
    value
) {

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


function formatDate(
    value
) {

    if (!value) {

        return "-";

    }


    try {

        let date;

        if (
            typeof value.toDate ===
            "function"
        ) {

            date =
                value.toDate();

        }
        else {

            date =
                new Date(value);

        }


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


/* ============================================================
   AUTH
   ============================================================ */

function currentUserId() {

    return (
        auth?.currentUser?.uid ||
        null
    );

}


/* ============================================================
   SALES INVOICE NUMBER
   ============================================================ */

async function generateSalesInvoiceNumber() {

    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        SALES
                    ),
                    orderBy(
                        "invoiceNumber",
                        "desc"
                    ),
                    limit(100)
                )
            );


        let highest =
            0;


        snapshot.forEach(
            item => {

                const invoice =
                    clean(
                        item.data()
                            .invoiceNumber
                    );


                const match =
                    invoice.match(
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
            INVOICE_PREFIX +
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
            "Invoice number fallback:",
            error
        );


        return (
            INVOICE_PREFIX +
            Date.now()
                .toString()
                .slice(-6)
        );

    }

}


/* ============================================================
   LOAD CUSTOMERS
   ============================================================ */

async function loadSalesCustomers() {

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
                    a.customerName || ""
                ).localeCompare(
                    String(
                        b.customerName || ""
                    )
                )
        );


        populateCustomerSelect();


        return customerCache;

    }
    catch(error) {

        console.error(
            "Customer loading error:",
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
   LOAD MATERIALS
   ============================================================ */

async function loadSalesMaterials() {

    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        MATERIALS
                    ),
                    where(
                        "status",
                        "==",
                        "Active"
                    ),
                    limit(
                        MAX_RESULTS
                    )
                )
            );


        materialCache =
            snapshot.docs.map(
                item => ({

                    id:
                        item.id,

                    ...item.data()

                })
            );


        materialCache.sort(
            (a, b) =>
                String(
                    a.name || ""
                ).localeCompare(
                    String(
                        b.name || ""
                    )
                )
        );


        populateMaterialSelects();


        return materialCache;

    }
    catch(error) {

        console.error(
            "Material loading error:",
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
        "salesCustomer",
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
            Walk-in / Select Customer
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

                            ${
                                customer.customerCode
                                    ? " — " +
                                      escapeHTML(
                                          customer.customerCode
                                      )
                                    : ""
                            }

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
   MATERIAL DROPDOWNS
   ============================================================ */

function populateMaterialSelects() {

    document
        .querySelectorAll(
            "select[data-sales-material]"
        )
        .forEach(
            select => {

                const current =
                    select.value;


                select.innerHTML = `

                    <option value="">
                        Select material
                    </option>

                    ${
                        materialCache
                            .map(
                                material => `

                                    <option
                                        value="${escapeHTML(
                                            material.id
                                        )}"
                                    >

                                        ${escapeHTML(
                                            material.name
                                        )}

                                        ${
                                            material.materialCode
                                                ? " — " +
                                                  escapeHTML(
                                                      material.materialCode
                                                  )
                                                : ""
                                        }

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
        );

}


/* ============================================================
   GET MATERIAL
   ============================================================ */

function getMaterial(
    materialId
) {

    return materialCache.find(
        item =>
            item.id ===
            materialId
    ) || null;

}


/* ============================================================
   APPLY MATERIAL DETAILS
   ============================================================ */

function applyMaterialToRow(
    row,
    materialId
) {

    const material =
        getMaterial(
            materialId
        );


    if (!material) {

        return;

    }


    const hsn =
        row.querySelector(
            "[data-field='hsn']"
        );


    const gst =
        row.querySelector(
            "[data-field='gst']"
        );


    const rate =
        row.querySelector(
            "[data-field='rate']"
        );


    const unit =
        row.querySelector(
            "[data-field='unit']"
        );


    if (hsn) {

        hsn.value =
            material.hsn ||
            "";

    }


    if (gst) {

        gst.value =
            numberValue(
                material.gst
            );

    }


    if (rate) {

        rate.value =
            numberValue(
                material.sellingRate ??
                material.saleRate ??
                0
            );

    }


    if (unit) {

        unit.textContent =
            material.unit ||
            "PCS";

    }


    calculateSalesRow(
        row
    );

}


/* ============================================================
   CALCULATE SALES ROW
   ============================================================ */

function calculateSalesRow(
    row
) {

    const quantity =
        numberValue(
            row.querySelector(
                "[data-field='quantity']"
            )?.value
        );


    const rate =
        numberValue(
            row.querySelector(
                "[data-field='rate']"
            )?.value
        );


    const gstRate =
        numberValue(
            row.querySelector(
                "[data-field='gst']"
            )?.value
        );


    const taxableAmount =
        quantity *
        rate;


    const gstAmount =
        taxableAmount *
        gstRate /
        100;


    const lineTotal =
        taxableAmount +
        gstAmount;


    const taxableNode =
        row.querySelector(
            "[data-total='taxable']"
        );


    const gstNode =
        row.querySelector(
            "[data-total='gst']"
        );


    const totalNode =
        row.querySelector(
            "[data-total='total']"
        );


    if (taxableNode) {

        taxableNode.textContent =
            "₹" +
            formatAmount(
                taxableAmount
            );

    }


    if (gstNode) {

        gstNode.textContent =
            "₹" +
            formatAmount(
                gstAmount
            );

    }


    if (totalNode) {

        totalNode.textContent =
            "₹" +
            formatAmount(
                lineTotal
            );

    }


    calculateSalesTotal();

}


/* ============================================================
   GET SALES ROWS
   ============================================================ */

function getSalesRows() {

    const rows =
        document.querySelectorAll(
            "[data-sales-row]"
        );


    const items =
        [];


    rows.forEach(
        row => {

            const materialSelect =
                row.querySelector(
                    "select[data-sales-material]"
                );


            const materialId =
                materialSelect
                    ? materialSelect.value
                    : clean(
                        row.dataset.materialId
                    );


            if (!materialId) {

                return;

            }


            const material =
                getMaterial(
                    materialId
                );


            const quantity =
                numberValue(
                    row.querySelector(
                        "[data-field='quantity']"
                    )?.value
                );


            const rate =
                numberValue(
                    row.querySelector(
                        "[data-field='rate']"
                    )?.value
                );


            const gstRate =
                numberValue(
                    row.querySelector(
                        "[data-field='gst']"
                    )?.value
                );


            const hsn =
                clean(
                    row.querySelector(
                        "[data-field='hsn']"
                    )?.value
                );


            const taxableAmount =
                quantity *
                rate;


            const gstAmount =
                taxableAmount *
                gstRate /
                100;


            const lineTotal =
                taxableAmount +
                gstAmount;


            items.push({

                materialId,

                materialCode:
                    material?.materialCode ||
                    "",

                materialName:
                    material?.name ||
                    "",

                unit:
                    material?.unit ||
                    "PCS",

                hsn,

                gstRate,

                quantity,

                rate,

                taxableAmount,

                gstAmount,

                lineTotal

            });

        }
    );


    return items;

}


/* ============================================================
   CALCULATE SALES TOTAL
   ============================================================ */

function calculateSalesTotal() {

    const items =
        getSalesRows();


    const taxableAmount =
        items.reduce(
            (
                total,
                item
            ) =>
                total +
                item.taxableAmount,
            0
        );


    const gstAmount =
        items.reduce(
            (
                total,
                item
            ) =>
                total +
                item.gstAmount,
            0
        );


    const totalAmount =
        taxableAmount +
        gstAmount;


    setText(
        [
            "salesTaxable",
            "taxableAmount",
            "subtotal"
        ],
        "₹" +
        formatAmount(
            taxableAmount
        )
    );


    setText(
        [
            "salesGST",
            "gstAmount",
            "totalGST"
        ],
        "₹" +
        formatAmount(
            gstAmount
        )
    );


    setText(
        [
            "salesTotal",
            "grandTotal",
            "totalAmount"
        ],
        "₹" +
        formatAmount(
            totalAmount
        )
    );


    updatePaymentSummary(
        totalAmount
    );


    return {

        taxableAmount,

        gstAmount,

        totalAmount

    };

}


/* ============================================================
   PAYMENT SUMMARY
   ============================================================ */

function getPaymentAmount() {

    return numberValue(
        value(
            "paymentAmount",
            "amountReceived",
            "receivedAmount"
        )
    );

}


function updatePaymentSummary(
    totalAmount
) {

    const payment =
        getPaymentAmount();


    const balance =
        Math.max(
            totalAmount -
            payment,
            0
        );


    setText(
        [
            "balanceAmount",
            "customerBalance",
            "outstandingAmount"
        ],
        "₹" +
        formatAmount(
            balance
        )
    );


    setText(
        [
            "paymentDue"
        ],
        "₹" +
        formatAmount(
            balance
        )
    );

}


/* ============================================================
   PAYMENT MODE
   ============================================================ */

function normalizePaymentMode() {

    return (
        value(
            "paymentMode",
            "salesPaymentMode"
        ) ||
        "Credit"
    );

}


/* ============================================================
   GET SALES FORM DATA
   ============================================================ */

function getSalesFormData() {

    const customerId =
        value(
            "customerId",
            "salesCustomer",
            "customerSelect"
        );


    const customer =
        customerCache.find(
            item =>
                item.id ===
                customerId
        ) || null;


    const totals =
        calculateSalesTotal();


    const paymentAmount =
        Math.min(
            getPaymentAmount(),
            totals.totalAmount
        );


    const outstanding =
        Math.max(
            totals.totalAmount -
            paymentAmount,
            0
        );


    return {

        invoiceNumber:
            value(
                "invoiceNumber",
                "salesInvoiceNumber"
            ),

        invoiceDate:
            value(
                "invoiceDate",
                "salesDate"
            ),

        customerId,

        customerName:
            customer?.customerName ||
            customer?.name ||
            (
                customerId
                    ? "Customer"
                    : "Walk-in Customer"
            ),

        customerInvoiceNumber:
            value(
                "customerInvoiceNumber"
            ),

        paymentMode:
            normalizePaymentMode(),

        paymentAmount,

        outstanding,

        notes:
            value(
                "notes",
                "remarks"
            ),

        items:
            getSalesRows(),

        taxableAmount:
            totals.taxableAmount,

        gstAmount:
            totals.gstAmount,

        totalAmount:
            totals.totalAmount

    };

}


/* ============================================================
   VALIDATE SALES
   ============================================================ */

function validateSales(
    data
) {

    if (
        !data.items.length
    ) {

        throw new Error(
            "Please add at least one material."
        );

    }


    for (
        const item of data.items
    ) {

        if (
            item.quantity <= 0
        ) {

            throw new Error(
                `Quantity must be greater than zero for ${item.materialName}.`
            );

        }


        if (
            item.rate < 0
        ) {

            throw new Error(
                `Selling rate cannot be negative for ${item.materialName}.`
            );

        }


        if (
            item.gstRate < 0 ||
            item.gstRate > 100
        ) {

            throw new Error(
                `Invalid GST rate for ${item.materialName}.`
            );

        }

    }


    if (
        data.totalAmount <= 0
    ) {

        throw new Error(
            "Invoice total must be greater than zero."
        );

    }


    if (
        data.paymentAmount < 0
    ) {

        throw new Error(
            "Payment amount cannot be negative."
        );

    }


    if (
        data.paymentAmount >
        data.totalAmount
    ) {

        throw new Error(
            "Payment cannot exceed invoice total."
        );

    }


    if (
        data.outstanding > 0 &&
        !data.customerId
    ) {

        throw new Error(
            "Customer is required when there is an outstanding amount."
        );

    }

}


/* ============================================================
   DUPLICATE CUSTOMER INVOICE
   ============================================================ */

async function checkDuplicateCustomerInvoice(
    customerId,
    invoiceNumber,
    excludeId = null
) {

    if (
        !invoiceNumber
    ) {

        return null;

    }


    const q =
        query(
            collection(
                db,
                SALES
            ),
            where(
                "customerInvoiceNumber",
                "==",
                invoiceNumber
            ),
            limit(5)
        );


    const snapshot =
        await getDocs(q);


    for (
        const item of snapshot.docs
    ) {

        if (
            excludeId &&
            item.id ===
            excludeId
        ) {

            continue;

        }


        const data =
            item.data();


        if (
            !customerId ||
            data.customerId ===
            customerId
        ) {

            return {

                id:
                    item.id,

                ...data

            };

        }

    }


    return null;

}


/* ============================================================
   FIND INVENTORY REFERENCES
   ============================================================ */

async function getInventoryReferences(
    items
) {

    const references =
        [];


    const seen =
        new Set();


    for (
        const item of items
    ) {

        if (
            seen.has(
                item.materialId
            )
        ) {

            continue;

        }


        seen.add(
            item.materialId
        );


        const inventoryQuery =
            query(
                collection(
                    db,
                    INVENTORY
                ),
                where(
                    "materialId",
                    "==",
                    item.materialId
                ),
                limit(1)
            );


        const snapshot =
            await getDocs(
                inventoryQuery
            );


        if (
            snapshot.empty
        ) {

            throw new Error(
                `Inventory record not found for ${item.materialName}.`
            );

        }


        references.push({

            materialId:
                item.materialId,

            reference:
                snapshot.docs[0].ref

        });

    }


    return references;

}


/* ============================================================
   SAVE SALES INVOICE
   ============================================================ */

async function saveSale() {

    try {

        const data =
            getSalesFormData();


        validateSales(
            data
        );


        if (
            !data.invoiceNumber
        ) {

            data.invoiceNumber =
                await generateSalesInvoiceNumber();

        }


        const duplicate =
            await checkDuplicateCustomerInvoice(
                data.customerId,
                data.customerInvoiceNumber,
                editingSaleId
            );


        if (
            duplicate
        ) {

            throw new Error(
                "This customer invoice number already exists."
            );

        }


        if (
            editingSaleId
        ) {

            throw new Error(
                "Posted sales invoices cannot be directly edited."
            );

        }


        /*
         * Get inventory document references
         * before starting transaction.
         */

        const inventoryReferences =
            await getInventoryReferences(
                data.items
            );


        const inventoryMap =
            new Map();


        inventoryReferences.forEach(
            entry => {

                inventoryMap.set(
                    entry.materialId,
                    entry.reference
                );

            }
        );


        const userId =
            currentUserId();


        let saleId =
            null;


        /*
         * ========================================================
         * ATOMIC TRANSACTION
         * ========================================================
         *
         * Reads:
         *   Customer
         *   Inventory
         *
         * Writes:
         *   Sales header
         *   Inventory OUT
         *   Customer outstanding
         */

        await runTransaction(
            db,
            async transaction => {

                let customerSnapshot =
                    null;


                /*
                 * CUSTOMER READ
                 */

                if (
                    data.customerId
                ) {

                    const customerReference =
                        doc(
                            db,
                            CUSTOMERS,
                            data.customerId
                        );


                    customerSnapshot =
                        await transaction.get(
                            customerReference
                        );


                    if (
                        !customerSnapshot.exists()
                    ) {

                        throw new Error(
                            "Selected customer was not found."
                        );

                    }

                }


                /*
                 * INVENTORY READS
                 */

                const inventorySnapshots =
                    new Map();


                for (
                    const entry
                    of inventoryReferences
                ) {

                    const snapshot =
                        await transaction.get(
                            entry.reference
                        );


                    if (
                        !snapshot.exists()
                    ) {

                        throw new Error(
                            "Inventory record no longer exists."
                        );

                    }


                    inventorySnapshots.set(
                        entry.materialId,
                        snapshot
                    );

                }


                /*
                 * CREATE SALES HEADER
                 */

                const saleReference =
                    doc(
                        collection(
                            db,
                            SALES
                        )
                    );


                saleId =
                    saleReference.id;


                const paymentStatus =
                    data.outstanding <= 0
                        ? "Paid"
                        : (
                            data.paymentAmount > 0
                                ? "Partial"
                                : "Pending"
                        );


                transaction.set(
                    saleReference,
                    {

                        invoiceNumber:
                            data.invoiceNumber,

                        invoiceDate:
                            data.invoiceDate ||
                            null,

                        customerId:
                            data.customerId ||
                            null,

                        customerName:
                            data.customerName,

                        customerInvoiceNumber:
                            data.customerInvoiceNumber,

                        paymentMode:
                            data.paymentMode,

                        paymentAmount:
                            data.paymentAmount,

                        outstanding:
                            data.outstanding,

                        taxableAmount:
                            data.taxableAmount,

                        gstAmount:
                            data.gstAmount,

                        totalAmount:
                            data.totalAmount,

                        itemCount:
                            data.items.length,

                        notes:
                            data.notes,

                        status:
                            "Posted",

                        paymentStatus:
                            paymentStatus,

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


                /*
                 * CUSTOMER OUTSTANDING
                 */

                if (
                    data.customerId &&
                    customerSnapshot
                ) {

                    const customerReference =
                        doc(
                            db,
                            CUSTOMERS,
                            data.customerId
                        );


                    const customer =
                        customerSnapshot.data();


                    const oldOutstanding =
                        numberValue(
                            customer.outstanding
                        );


                    const oldReceivable =
                        numberValue(
                            customer.receivable
                        );


                    const newOutstanding =
                        oldOutstanding +
                        data.outstanding;


                    const newReceivable =
                        oldReceivable +
                        data.outstanding;


                    transaction.update(
                        customerReference,
                        {

                            outstanding:
                                newOutstanding,

                            receivable:
                                newReceivable,

                            lastSaleInvoice:
                                data.invoiceNumber,

                            updatedAt:
                                serverTimestamp(),

                            updatedBy:
                                userId

                        }
                    );

                }


                /*
                 * INVENTORY STOCK OUT
                 */

                for (
                    const item
                    of data.items
                ) {

                    const inventorySnapshot =
                        inventorySnapshots.get(
                            item.materialId
                        );


                    const inventory =
                        inventorySnapshot.data();


                    const oldQuantity =
                        numberValue(
                            inventory.quantity
                        );


                    const availableQuantity =
                        numberValue(
                            inventory.availableQuantity
                        );


                    /*
                     * Use availableQuantity
                     * when present.
                     * Otherwise use quantity.
                     */

                    const available =
                        Number.isFinite(
                            Number(
                                inventory.availableQuantity
                            )
                        )
                            ? availableQuantity
                            : oldQuantity;


                    if (
                        item.quantity >
                        available
                    ) {

                        throw new Error(
                            `Insufficient stock for ${item.materialName}. Available: ${formatAmount(
                                available
                            )}`
                        );

                    }


                    const newQuantity =
                        oldQuantity -
                        item.quantity;


                    const reserved =
                        numberValue(
                            inventory.reservedQuantity
                        );


                    const newAvailable =
                        Math.max(
                            newQuantity -
                            reserved,
                            0
                        );


                    transaction.update(
                        inventoryMap.get(
                            item.materialId
                        ),
                        {

                            quantity:
                                newQuantity,

                            availableQuantity:
                                newAvailable,

                            lastMovementType:
                                "SALE",

                            lastMovementQuantity:
                                item.quantity,

                            lastSalesInvoice:
                                data.invoiceNumber,

                            updatedAt:
                                serverTimestamp()

                        }
                    );

                }

            }
        );


        /*
         * ========================================================
         * CREATE SALES ITEM DOCUMENTS
         * ========================================================
         */

        for (
            const item of data.items
        ) {

            /*
             * Cost is taken from material/inventory master
             * for profit snapshot.
             */

            const material =
                getMaterial(
                    item.materialId
                );


            const costRate =
                numberValue(
                    material?.purchaseRate ??
                    material?.averageCost ??
                    0
                );


            const costAmount =
                item.quantity *
                costRate;


            const profit =
                item.taxableAmount -
                costAmount;


            await addDoc(
                collection(
                    db,
                    SALES_ITEMS
                ),
                {

                    saleId:
                        saleId,

                    invoiceNumber:
                        data.invoiceNumber,

                    customerId:
                        data.customerId ||
                        null,

                    customerName:
                        data.customerName,

                    materialId:
                        item.materialId,

                    materialCode:
                        item.materialCode,

                    materialName:
                        item.materialName,

                    unit:
                        item.unit,

                    hsn:
                        item.hsn,

                    gstRate:
                        item.gstRate,

                    quantity:
                        item.quantity,

                    rate:
                        item.rate,

                    taxableAmount:
                        item.taxableAmount,

                    gstAmount:
                        item.gstAmount,

                    lineTotal:
                        item.lineTotal,

                    costRate:
                        costRate,

                    costAmount:
                        costAmount,

                    profit:
                        profit,

                    createdAt:
                        serverTimestamp(),

                    createdBy:
                        userId

                }
            );

        }


        showMessage(
            `Invoice ${data.invoiceNumber} posted successfully.`,
            "success"
        );


        await clearSalesForm();

        await loadSales();


        return saleId;

    }
    catch(error) {

        console.error(
            "Save sales invoice error:",
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
   LOAD SALES
   ============================================================ */

async function loadSales() {

    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        SALES
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


        salesCache =
            snapshot.docs.map(
                item => ({

                    id:
                        item.id,

                    ...item.data()

                })
            );


        renderSales(
            salesCache
        );


        updateSalesSummary(
            salesCache
        );


        return salesCache;

    }
    catch(error) {

        console.error(
            "Load sales error:",
            error
        );


        /*
         * Fallback for existing
         * documents without createdAt.
         */

        try {

            const snapshot =
                await getDocs(
                    query(
                        collection(
                            db,
                            SALES
                        ),
                        limit(
                            MAX_RESULTS
                        )
                    )
                );


            salesCache =
                snapshot.docs.map(
                    item => ({

                        id:
                            item.id,

                        ...item.data()

                    })
                );


            renderSales(
                salesCache
            );


            updateSalesSummary(
                salesCache
            );


            return salesCache;

        }
        catch(
            fallbackError
        ) {

            console.error(
                fallbackError
            );


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
   RENDER SALES TABLE
   ============================================================ */

function renderSales(
    sales
) {

    const table =
        el(
            "salesTable"
        );


    if (!table) {

        return;

    }


    const search =
        value(
            "salesSearch",
            "search"
        )
        .toLowerCase();


    const filtered =
        sales.filter(
            sale => {

                const searchable =
                    [

                        sale.invoiceNumber,

                        sale.customerName,

                        sale.customerInvoiceNumber,

                        sale.paymentStatus,

                        sale.paymentMode

                    ]
                    .join(" ")
                    .toLowerCase();


                return (
                    !search ||
                    searchable.includes(
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
                            No sales invoices found
                        </strong>

                        <span>
                            Posted invoices will appear here.
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
                                sale.invoiceDate
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
                            <strong>
                                ₹${formatAmount(
                                    sale.totalAmount
                                )}
                            </strong>
                        </td>

                        <td>
                            ₹${formatAmount(
                                sale.outstanding
                            )}
                        </td>

                        <td>

                            <span
                                class="status"
                            >
                                ${escapeHTML(
                                    sale.paymentStatus ||
                                    "Pending"
                                )}
                            </span>

                        </td>

                        <td>

                            <button
                                type="button"
                                onclick="viewSale('${escapeHTML(
                                    sale.id
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
   SALES SUMMARY
   ============================================================ */

function updateSalesSummary(
    sales
) {

    const count =
        sales.length;


    const totalSales =
        sales.reduce(
            (
                sum,
                sale
            ) =>
                sum +
                numberValue(
                    sale.totalAmount
                ),
            0
        );


    const totalOutstanding =
        sales.reduce(
            (
                sum,
                sale
            ) =>
                sum +
                numberValue(
                    sale.outstanding
                ),
            0
        );


    const totalGST =
        sales.reduce(
            (
                sum,
                sale
            ) =>
                sum +
                numberValue(
                    sale.gstAmount
                ),
            0
        );


    setText(
        [
            "totalSales",
            "salesCount"
        ],
        count
    );


    setText(
        [
            "salesValue",
            "totalSalesValue"
        ],
        "₹" +
        formatAmount(
            totalSales
        )
    );


    setText(
        [
            "salesOutstanding",
            "totalSalesOutstanding"
        ],
        "₹" +
        formatAmount(
            totalOutstanding
        )
    );


    setText(
        [
            "salesGST",
            "totalSalesGST"
        ],
        "₹" +
        formatAmount(
            totalGST
        )
    );

}


/* ============================================================
   VIEW SALE
   ============================================================ */

async function viewSale(
    saleId
) {

    const sale =
        salesCache.find(
            item =>
                item.id ===
                saleId
        );


    if (!sale) {

        showMessage(
            "Sales invoice not found.",
            "error"
        );

        return;

    }


    const modal =
        el(
            "salesViewModal"
        );


    if (modal) {

        const content =
            modal.querySelector(
                "[data-sales-content]"
            );


        if (content) {

            content.innerHTML = `

                <div class="sales-view">

                    <h3>
                        ${escapeHTML(
                            sale.invoiceNumber
                        )}
                    </h3>

                    <p>
                        Customer:
                        <strong>
                            ${escapeHTML(
                                sale.customerName ||
                                "Walk-in Customer"
                            )}
                        </strong>
                    </p>

                    <p>
                        Invoice Total:
                        <strong>
                            ₹${formatAmount(
                                sale.totalAmount
                            )}
                        </strong>
                    </p>

                    <p>
                        Received:
                        ₹${formatAmount(
                            sale.paymentAmount
                        )}
                    </p>

                    <p>
                        Outstanding:
                        <strong>
                            ₹${formatAmount(
                                sale.outstanding
                            )}
                        </strong>
                    </p>

                    <p>
                        Payment Status:
                        ${escapeHTML(
                            sale.paymentStatus ||
                            "Pending"
                        )}
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
        `${sale.invoiceNumber} — ₹${formatAmount(
            sale.totalAmount
        )}`,
        "info"
    );

}


/* ============================================================
   ADD SALES ROW
   ============================================================ */

function addSalesRow() {

    const container =
        el(
            "salesItems"
        );


    if (!container) {

        return;

    }


    const row =
        document.createElement(
            "div"
        );


    row.className =
        "sales-row";


    row.dataset.salesRow =
        "true";


    row.innerHTML = `

        <div>

            <select
                data-sales-material
                data-field="material"
            >

                <option value="">
                    Select material
                </option>

                ${
                    materialCache
                        .map(
                            material => `

                                <option
                                    value="${escapeHTML(
                                        material.id
                                    )}"
                                >

                                    ${escapeHTML(
                                        material.name
                                    )}

                                </option>

                            `
                        )
                        .join("")
                }

            </select>

        </div>


        <div>

            <input
                type="text"
                data-field="hsn"
                placeholder="HSN"
            >

        </div>


        <div>

            <input
                type="number"
                data-field="quantity"
                min="0"
                step="0.001"
                value="1"
            >

        </div>


        <div>

            <input
                type="number"
                data-field="rate"
                min="0"
                step="0.01"
                value="0"
            >

        </div>


        <div>

            <input
                type="number"
                data-field="gst"
                min="0"
                max="100"
                step="0.01"
                value="0"
            >

        </div>


        <div>

            <strong
                data-total="total"
            >
                ₹0.00
            </strong>

        </div>


        <div>

            <button
                type="button"
                onclick="removeSalesRow(this)"
            >
                Remove
            </button>

        </div>

    `;


    container.appendChild(
        row
    );


    const materialSelect =
        row.querySelector(
            "[data-sales-material]"
        );


    materialSelect.addEventListener(
        "change",
        () => {

            applyMaterialToRow(
                row,
                materialSelect.value
            );

        }
    );


    row.querySelectorAll(
        "input"
    )
    .forEach(
        input => {

            input.addEventListener(
                "input",
                () =>
                    calculateSalesRow(
                        row
                    )
            );

        }
    );


    calculateSalesRow(
        row
    );

}


/* ============================================================
   REMOVE SALES ROW
   ============================================================ */

function removeSalesRow(
    button
) {

    const row =
        button.closest(
            "[data-sales-row]"
        );


    if (row) {

        row.remove();

    }


    calculateSalesTotal();

}


/* ============================================================
   CLEAR SALES FORM
   ============================================================ */

async function clearSalesForm() {

    editingSaleId =
        null;


    const form =
        el(
            "salesForm"
        );


    if (form) {

        form.reset();

    }


    const invoiceNumber =
        await generateSalesInvoiceNumber();


    setValue(
        [
            "invoiceNumber",
            "salesInvoiceNumber"
        ],
        invoiceNumber
    );


    const today =
        new Date()
            .toISOString()
            .split("T")[0];


    setValue(
        [
            "invoiceDate",
            "salesDate"
        ],
        today
    );


    setValue(
        [
            "paymentAmount",
            "amountReceived",
            "receivedAmount"
        ],
        "0"
    );


    calculateSalesTotal();

}


/* ============================================================
   PAYMENT INPUT LISTENER
   ============================================================ */

function bindPaymentEvents() {

    const ids = [

        "paymentAmount",

        "amountReceived",

        "receivedAmount"

    ];


    ids.forEach(
        id => {

            const node =
                el(id);


            if (!node) {

                return;

            }


            node.addEventListener(
                "input",
                () => {

                    const total =
                        calculateSalesTotal()
                            .totalAmount;


                    updatePaymentSummary(
                        total
                    );

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
            "mmvSalesMessage"
        );


    if (!box) {

        box =
            document.createElement(
                "div"
            );


        box.id =
            "mmvSalesMessage";


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
   FIREBASE ERROR
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

        return "Firebase is temporarily unavailable. Please try again.";

    }


    return (
        error.message ||
        "Unable to complete the operation."
    );

}


/* ============================================================
   DOM READY
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        /*
         * Master data.
         */

        await Promise.all([

            loadSalesCustomers(),

            loadSalesMaterials()

        ]);


        /*
         * Invoice number.
         */

        const invoiceNumber =
            await generateSalesInvoiceNumber();


        setValue(
            [
                "invoiceNumber",
                "salesInvoiceNumber"
            ],
            invoiceNumber
        );


        /*
         * Date.
         */

        const today =
            new Date()
                .toISOString()
                .split("T")[0];


        setValue(
            [
                "invoiceDate",
                "salesDate"
            ],
            today
        );


        /*
         * Existing rows.
         */

        document
            .querySelectorAll(
                "[data-sales-row]"
            )
            .forEach(
                row => {

                    const select =
                        row.querySelector(
                            "[data-sales-material]"
                        );


                    if (select) {

                        select.addEventListener(
                            "change",
                            () => {

                                applyMaterialToRow(
                                    row,
                                    select.value
                                );

                            }
                        );

                    }


                    row.querySelectorAll(
                        "input"
                    )
                    .forEach(
                        input => {

                            input.addEventListener(
                                "input",
                                () =>
                                    calculateSalesRow(
                                        row
                                    )
                            );

                        }
                    );

                }
            );


        /*
         * Search.
         */

        const search =
            el(
                "salesSearch"
            );


        if (search) {

            search.addEventListener(
                "input",
                () =>
                    renderSales(
                        salesCache
                    )
            );

        }


        bindPaymentEvents();


        calculateSalesTotal();


        await loadSales();

    }
);


/* ============================================================
   GLOBAL API
   ============================================================ */

window.MMVSales = {

    saveSale,

    loadSales,

    loadSalesCustomers,

    loadSalesMaterials,

    generateSalesInvoiceNumber,

    calculateSalesTotal,

    calculateSalesRow,

    addSalesRow,

    removeSalesRow,

    clearSalesForm,

    viewSale

};


window.saveSale =
    saveSale;

window.loadSales =
    loadSales;

window.generateSalesInvoiceNumber =
    generateSalesInvoiceNumber;

window.calculateSalesTotal =
    calculateSalesTotal;

window.calculateSalesRow =
    calculateSalesRow;

window.addSalesRow =
    addSalesRow;

window.removeSalesRow =
    removeSalesRow;

window.clearSalesForm =
    clearSalesForm;

window.viewSale =
    viewSale;


console.info(
    "%cMMV Sales V2%c ready",
    "font-weight:800;color:#0a3d91;",
    "color:inherit;"
);
