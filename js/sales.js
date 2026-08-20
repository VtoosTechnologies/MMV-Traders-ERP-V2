/* ============================================================
   MMV TRADERS ERP V2
   SALES / INVOICE SERVICE
   COMPLETE VERSION

   FEATURES
   ------------------------------------------------------------
   ✓ Automatic invoice number
   ✓ Customer / Bill To
   ✓ Receiver / Ship To
   ✓ Same as Bill To
   ✓ Material selection
   ✓ HSN / GST / Rate
   ✓ Stock validation
   ✓ Stock OUT
   ✓ Customer outstanding
   ✓ Sales item documents
   ✓ View invoice
   ✓ Edit invoice
   ✓ Print invoice
   ✓ Delete invoice
   ✓ Edit stock reversal
   ✓ Delete stock restoration
   ✓ A4 invoice data preparation
   ✓ Transport / Vehicle / Driver
   ============================================================ */

"use strict";

import {
    collection,
    getDocs,
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

const SALES = "sales";
const SALES_ITEMS = "salesItems";
const CUSTOMERS = "customers";
const MATERIALS = "materials";
const INVENTORY = "inventory";


/* ============================================================
   CONFIG
   ============================================================ */

const INVOICE_PREFIX = "INV-";
const MAX_RESULTS = 500;


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

    for (
        const id of ids
    ) {

        const node =
            el(id);

        if (!node) {
            continue;
        }

        if (
            "value" in node
        ) {
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

    const list =
        Array.isArray(ids)
            ? ids
            : [ids];

    for (
        const id of list
    ) {

        const node =
            el(id);

        if (
            node &&
            "value" in node
        ) {

            node.value =
                newValue ?? "";

            return true;

        }

    }

    return false;

}


function setText(
    ids,
    text
) {

    const list =
        Array.isArray(ids)
            ? ids
            : [ids];

    for (
        const id of list
    ) {

        const node =
            el(id);

        if (node) {

            node.textContent =
                text ?? "";

            return true;

        }

    }

    return false;

}


function setHTML(
    ids,
    html
) {

    const list =
        Array.isArray(ids)
            ? ids
            : [ids];

    for (
        const id of list
    ) {

        const node =
            el(id);

        if (node) {

            node.innerHTML =
                html;

            return true;

        }

    }

    return false;

}


function escapeHTML(value) {

    return String(
        value ?? ""
    )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

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


function money(value) {

    return "₹" +
        formatAmount(value);

}


function formatDate(value) {

    if (!value) {
        return "-";
    }

    try {

        if (
            typeof value === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(value)
        ) {

            const [
                year,
                month,
                day
            ] =
                value.split("-");

            return `${day}-${month}-${year}`;

        }

        const date =
            typeof value?.toDate === "function"
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


function todayValue() {

    return new Date()
        .toISOString()
        .split("T")[0];

}


function currentUserId() {

    return (
        auth?.currentUser?.uid ||
        null
    );

}


function getCheckbox(
    ...ids
) {

    for (
        const id of ids
    ) {

        const node =
            el(id);

        if (node) {
            return Boolean(
                node.checked
            );
        }

    }

    return false;

}


function setCheckbox(
    ids,
    checked
) {

    const list =
        Array.isArray(ids)
            ? ids
            : [ids];

    for (
        const id of list
    ) {

        const node =
            el(id);

        if (node) {

            node.checked =
                Boolean(checked);

            return true;

        }

    }

    return false;

}


/* ============================================================
   CUSTOMER FIELD HELPERS
   ============================================================ */

function customerName(customer) {

    return clean(
        customer?.customerName ||
        customer?.name ||
        customer?.businessName ||
        ""
    );

}


function customerAddress(customer) {

    return clean(
        customer?.address ||
        customer?.customerAddress ||
        customer?.billingAddress ||
        ""
    );

}


function customerGSTIN(customer) {

    return clean(
        customer?.gstin ||
        customer?.GSTIN ||
        customer?.gstNumber ||
        ""
    );

}


function customerMobile(customer) {

    return clean(
        customer?.mobile ||
        customer?.phone ||
        customer?.mobileNumber ||
        ""
    );

}


function findCustomer(
    customerId
) {

    return customerCache.find(
        customer =>
            customer.id ===
            customerId
    ) || null;

}


/* ============================================================
   INVOICE NUMBER
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
                    limit(200)
                )
            );

        let highest = 0;

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

                if (!match) {
                    return;
                }

                highest =
                    Math.max(
                        highest,
                        numberValue(
                            match[1]
                        )
                    );

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
                    id: item.id,
                    ...item.data()
                })
            );

        customerCache.sort(
            (a, b) =>
                customerName(a)
                    .localeCompare(
                        customerName(b)
                    )
        );

        populateCustomerSelects();

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
   POPULATE CUSTOMER + RECEIVER DROPDOWNS
   ============================================================ */

function populateSelect(
    ids,
    placeholder
) {

    let select = null;

    for (
        const id of ids
    ) {

        const node =
            el(id);

        if (
            node &&
            node.tagName === "SELECT"
        ) {

            select = node;
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
            ${escapeHTML(placeholder)}
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
                                customerName(customer) ||
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


function populateCustomerSelects() {

    populateSelect(
        [
            "customerId",
            "salesCustomer",
            "customerSelect"
        ],
        "Select Customer"
    );

    populateSelect(
        [
            "receiverId",
            "receiverSelect",
            "shipToSelect"
        ],
        "Select Receiver"
    );

}


/* ============================================================
   LOAD MATERIALS
   ============================================================ */

async function loadSalesMaterials() {

    try {

        let snapshot;

        try {

            snapshot =
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

        }
        catch {

            snapshot =
                await getDocs(
                    query(
                        collection(
                            db,
                            MATERIALS
                        ),
                        limit(
                            MAX_RESULTS
                        )
                    )
                );

        }

        materialCache =
            snapshot.docs.map(
                item => ({
                    id: item.id,
                    ...item.data()
                })
            );

        materialCache.sort(
            (a, b) =>
                clean(
                    a.name
                ).localeCompare(
                    clean(
                        b.name
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
                        Select Material
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
                                            material.name ||
                                            "Material"
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
   CUSTOMER / RECEIVER AUTO FILL
   ============================================================ */

function applyCustomerToBuyer(
    customerId
) {

    const customer =
        findCustomer(
            customerId
        );

    if (!customer) {
        return;
    }

    setValue(
        [
            "customerName",
            "billToName",
            "buyerName"
        ],
        customerName(customer)
    );

    setValue(
        [
            "customerAddress",
            "billToAddress",
            "buyerAddress"
        ],
        customerAddress(customer)
    );

    setValue(
        [
            "customerGSTIN",
            "customerGstin",
            "billToGSTIN",
            "buyerGSTIN"
        ],
        customerGSTIN(customer)
    );

    setValue(
        [
            "customerMobile",
            "billToMobile",
            "buyerMobile"
        ],
        customerMobile(customer)
    );

}


function applyCustomerToReceiver(
    customerId
) {

    const customer =
        findCustomer(
            customerId
        );

    if (!customer) {
        return;
    }

    setValue(
        [
            "receiverName",
            "shipToName"
        ],
        customerName(customer)
    );

    setValue(
        [
            "receiverAddress",
            "deliveryAddress",
            "shipToAddress"
        ],
        customerAddress(customer)
    );

    setValue(
        [
            "receiverGSTIN",
            "receiverGstin",
            "shipToGSTIN"
        ],
        customerGSTIN(customer)
    );

    setValue(
        [
            "receiverMobile",
            "receiverPhone",
            "shipToMobile"
        ],
        customerMobile(customer)
    );

}


function copyBuyerToReceiver() {

    setValue(
        [
            "receiverName",
            "shipToName"
        ],
        value(
            "customerName",
            "billToName",
            "buyerName"
        )
    );

    setValue(
        [
            "receiverAddress",
            "deliveryAddress",
            "shipToAddress"
        ],
        value(
            "customerAddress",
            "billToAddress",
            "buyerAddress"
        )
    );

    setValue(
        [
            "receiverGSTIN",
            "receiverGstin",
            "shipToGSTIN"
        ],
        value(
            "customerGSTIN",
            "customerGstin",
            "billToGSTIN",
            "buyerGSTIN"
        )
    );

    setValue(
        [
            "receiverMobile",
            "receiverPhone",
            "shipToMobile"
        ],
        value(
            "customerMobile",
            "billToMobile",
            "buyerMobile"
        )
    );

}


function handleSameAsBillTo() {

    const same =
        getCheckbox(
            "sameAsBillTo",
            "sameAsBuyer",
            "sameReceiver"
        );

    if (same) {

        const customerId =
            value(
                "customerId",
                "salesCustomer",
                "customerSelect"
            );

        setValue(
            [
                "receiverId",
                "receiverSelect",
                "shipToSelect"
            ],
            customerId
        );

        copyBuyerToReceiver();

    }

}


/* ============================================================
   MATERIAL ROW
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
            material.hsnCode ||
            "";

    }

    if (gst) {

        gst.value =
            numberValue(
                material.gst ??
                material.gstRate ??
                0
            );

    }

    if (rate) {

        rate.value =
            numberValue(
                material.sellingRate ??
                material.saleRate ??
                material.rate ??
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
   CALCULATE ROW
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
            money(
                taxableAmount
            );

    }

    if (gstNode) {

        gstNode.textContent =
            money(
                gstAmount
            );

    }

    if (totalNode) {

        totalNode.textContent =
            money(
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

    const items = [];

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
                    material?.materialName ||
                    "Material",

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
   CALCULATE TOTAL
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
        money(
            taxableAmount
        )
    );

    setText(
        [
            "salesGST",
            "gstAmount",
            "totalGST"
        ],
        money(
            gstAmount
        )
    );

    setText(
        [
            "salesTotal",
            "grandTotal",
            "totalAmount"
        ],
        money(
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
   PAYMENT
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


function normalizePaymentMode() {

    return (
        value(
            "paymentMode",
            "salesPaymentMode"
        ) ||
        "Credit"
    );

}


function updatePaymentSummary(
    totalAmount
) {

    const payment =
        Math.min(
            getPaymentAmount(),
            totalAmount
        );

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
        money(balance)
    );

    setText(
        [
            "paymentDue"
        ],
        money(balance)
    );

}


/* ============================================================
   FORM DATA
   ============================================================ */

function getSalesFormData() {

    const customerId =
        value(
            "customerId",
            "salesCustomer",
            "customerSelect"
        );

    const receiverId =
        value(
            "receiverId",
            "receiverSelect",
            "shipToSelect"
        );

    const customer =
        findCustomer(
            customerId
        );

    const receiver =
        findCustomer(
            receiverId
        );

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

    const sameAsBillTo =
        getCheckbox(
            "sameAsBillTo",
            "sameAsBuyer",
            "sameReceiver"
        );

    const customerNameValue =
        value(
            "customerName",
            "billToName",
            "buyerName"
        ) ||
        customerName(customer) ||
        (
            customerId
                ? "Customer"
                : "Walk-in Customer"
        );

    const customerAddressValue =
        value(
            "customerAddress",
            "billToAddress",
            "buyerAddress"
        ) ||
        customerAddress(customer);

    const customerGSTINValue =
        value(
            "customerGSTIN",
            "customerGstin",
            "billToGSTIN",
            "buyerGSTIN"
        ) ||
        customerGSTIN(customer);

    const customerMobileValue =
        value(
            "customerMobile",
            "billToMobile",
            "buyerMobile"
        ) ||
        customerMobile(customer);

    const receiverNameValue =
        sameAsBillTo
            ? customerNameValue
            : (
                value(
                    "receiverName",
                    "shipToName"
                ) ||
                customerName(receiver)
            );

    const receiverAddressValue =
        sameAsBillTo
            ? customerAddressValue
            : (
                value(
                    "receiverAddress",
                    "deliveryAddress",
                    "shipToAddress"
                ) ||
                customerAddress(receiver)
            );

    const receiverGSTINValue =
        sameAsBillTo
            ? customerGSTINValue
            : (
                value(
                    "receiverGSTIN",
                    "receiverGstin",
                    "shipToGSTIN"
                ) ||
                customerGSTIN(receiver)
            );

    const receiverMobileValue =
        sameAsBillTo
            ? customerMobileValue
            : (
                value(
                    "receiverMobile",
                    "receiverPhone",
                    "shipToMobile"
                ) ||
                customerMobile(receiver)
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
            ) ||
            todayValue(),

        dueDate:
            value(
                "dueDate",
                "salesDueDate"
            ),

        referenceNumber:
            value(
                "referenceNumber",
                "referenceNo",
                "orderReference"
            ),

        customerId,

        customerName:
            customerNameValue,

        customerAddress:
            customerAddressValue,

        customerGSTIN:
            customerGSTINValue,

        customerMobile:
            customerMobileValue,

        receiverId:
            sameAsBillTo
                ? customerId
                : receiverId,

        receiverName:
            receiverNameValue,

        receiverAddress:
            receiverAddressValue,

        receiverGSTIN:
            receiverGSTINValue,

        receiverMobile:
            receiverMobileValue,

        sameAsBillTo,

        transportMode:
            value(
                "transportMode",
                "transport",
                "transMode"
            ) ||
            "By Road",

        vehicleNumber:
            value(
                "vehicleNumber",
                "vehicleNo",
                "vehicle"
            ),

        driverName:
            value(
                "driverName",
                "driver"
            ),

        driverMobile:
            value(
                "driverMobile",
                "driverPhone"
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
   VALIDATE
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

    if (
        !data.customerName
    ) {

        throw new Error(
            "Customer / Bill To details are required."
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
                `Invalid selling rate for ${item.materialName}.`
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
            "Select customer when there is an outstanding amount."
        );

    }

}


/* ============================================================
   DUPLICATE CUSTOMER INVOICE CHECK
   ============================================================ */

async function checkDuplicateCustomerInvoice(
    customerId,
    invoiceNumber,
    excludeId = null
) {

    if (!invoiceNumber) {
        return null;
    }

    const snapshot =
        await getDocs(
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
                limit(10)
            )
        );

    for (
        const item of snapshot.docs
    ) {

        if (
            excludeId &&
            item.id === excludeId
        ) {
            continue;
        }

        const data =
            item.data();

        if (
            !customerId ||
            data.customerId === customerId
        ) {

            return {
                id: item.id,
                ...data
            };

        }

    }

    return null;

}


/* ============================================================
   LOAD SALE ITEMS
   ============================================================ */

async function getSaleItems(
    saleId
) {

    const snapshot =
        await getDocs(
            query(
                collection(
                    db,
                    SALES_ITEMS
                ),
                where(
                    "saleId",
                    "==",
                    saleId
                ),
                limit(
                    MAX_RESULTS
                )
            )
        );

    return snapshot.docs.map(
        item => ({
            id: item.id,
            ref: item.ref,
            ...item.data()
        })
    );

}


/* ============================================================
   INVENTORY REFERENCES
   ============================================================ */

async function getInventoryReferenceMap(
    materialIds
) {

    const uniqueIds =
        [
            ...new Set(
                materialIds.filter(Boolean)
            )
        ];

    const result =
        new Map();

    for (
        const materialId of uniqueIds
    ) {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        INVENTORY
                    ),
                    where(
                        "materialId",
                        "==",
                        materialId
                    ),
                    limit(1)
                )
            );

        if (
            snapshot.empty
        ) {

            throw new Error(
                "Inventory record not found."
            );

        }

        result.set(
            materialId,
            snapshot.docs[0].ref
        );

    }

    return result;

}


/* ============================================================
   INVENTORY DELTA
   + quantity = restore stock
   - quantity = reduce stock
   ============================================================ */

function buildInventoryDelta(
    oldItems,
    newItems
) {

    const delta =
        new Map();

    oldItems.forEach(
        item => {

            const current =
                delta.get(
                    item.materialId
                ) || 0;

            delta.set(
                item.materialId,
                current +
                numberValue(
                    item.quantity
                )
            );

        }
    );

    newItems.forEach(
        item => {

            const current =
                delta.get(
                    item.materialId
                ) || 0;

            delta.set(
                item.materialId,
                current -
                numberValue(
                    item.quantity
                )
            );

        }
    );

    return delta;

}


/* ============================================================
   CUSTOMER OUTSTANDING DELTA
   ============================================================ */

function buildCustomerDelta(
    oldSale,
    newData
) {

    const delta =
        new Map();

    if (
        oldSale?.customerId
    ) {

        delta.set(
            oldSale.customerId,
            (
                delta.get(
                    oldSale.customerId
                ) || 0
            ) -
            numberValue(
                oldSale.outstanding
            )
        );

    }

    if (
        newData.customerId
    ) {

        delta.set(
            newData.customerId,
            (
                delta.get(
                    newData.customerId
                ) || 0
            ) +
            numberValue(
                newData.outstanding
            )
        );

    }

    return delta;

}


/* ============================================================
   PAYMENT STATUS
   ============================================================ */

function getPaymentStatus(
    data
) {

    if (
        data.outstanding <= 0
    ) {
        return "Paid";
    }

    if (
        data.paymentAmount > 0
    ) {
        return "Partial";
    }

    return "Pending";

}


/* ============================================================
   SAVE / UPDATE SALE
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

        if (duplicate) {

            throw new Error(
                "This customer invoice number already exists."
            );

        }

        let oldSale = null;
        let oldItems = [];

        if (editingSaleId) {

            oldSale =
                salesCache.find(
                    sale =>
                        sale.id ===
                        editingSaleId
                ) || null;

            if (!oldSale) {

                throw new Error(
                    "Invoice not found for editing."
                );

            }

            oldItems =
                await getSaleItems(
                    editingSaleId
                );

        }

        const inventoryDelta =
            buildInventoryDelta(
                oldItems,
                data.items
            );

        const materialIds =
            [
                ...inventoryDelta.keys()
            ];

        const inventoryReferences =
            await getInventoryReferenceMap(
                materialIds
            );

        const customerDelta =
            buildCustomerDelta(
                oldSale,
                data
            );

        const userId =
            currentUserId();

        const saleId =
            editingSaleId ||
            doc(
                collection(
                    db,
                    SALES
                )
            ).id;

        const saleReference =
            doc(
                db,
                SALES,
                saleId
            );

        await runTransaction(
            db,
            async transaction => {

                /*
                 * READ SALE
                 */
                if (editingSaleId) {

                    const saleSnapshot =
                        await transaction.get(
                            saleReference
                        );

                    if (
                        !saleSnapshot.exists()
                    ) {

                        throw new Error(
                            "Invoice no longer exists."
                        );

                    }

                }


                /*
                 * READ CUSTOMERS
                 */
                const customerSnapshots =
                    new Map();

                for (
                    const customerId
                    of customerDelta.keys()
                ) {

                    if (!customerId) {
                        continue;
                    }

                    const customerReference =
                        doc(
                            db,
                            CUSTOMERS,
                            customerId
                        );

                    const snapshot =
                        await transaction.get(
                            customerReference
                        );

                    if (
                        !snapshot.exists()
                    ) {

                        throw new Error(
                            "Customer record was not found."
                        );

                    }

                    customerSnapshots.set(
                        customerId,
                        {
                            reference:
                                customerReference,
                            snapshot
                        }
                    );

                }


                /*
                 * READ INVENTORY
                 */
                const inventorySnapshots =
                    new Map();

                for (
                    const [
                        materialId,
                        reference
                    ]
                    of inventoryReferences
                ) {

                    const snapshot =
                        await transaction.get(
                            reference
                        );

                    if (
                        !snapshot.exists()
                    ) {

                        throw new Error(
                            "Inventory record no longer exists."
                        );

                    }

                    inventorySnapshots.set(
                        materialId,
                        snapshot
                    );

                }


                /*
                 * INVENTORY UPDATE
                 */
                for (
                    const [
                        materialId,
                        quantityDelta
                    ]
                    of inventoryDelta
                ) {

                    if (
                        quantityDelta === 0
                    ) {
                        continue;
                    }

                    const snapshot =
                        inventorySnapshots.get(
                            materialId
                        );

                    const inventory =
                        snapshot.data();

                    const oldQuantity =
                        numberValue(
                            inventory.quantity
                        );

                    const reserved =
                        numberValue(
                            inventory.reservedQuantity
                        );

                    const newQuantity =
                        oldQuantity +
                        quantityDelta;

                    if (
                        newQuantity < 0
                    ) {

                        const material =
                            getMaterial(
                                materialId
                            );

                        throw new Error(
                            `Insufficient stock for ${
                                material?.name ||
                                "material"
                            }.`
                        );

                    }

                    const newAvailable =
                        Math.max(
                            newQuantity -
                            reserved,
                            0
                        );

                    transaction.update(
                        inventoryReferences.get(
                            materialId
                        ),
                        {

                            quantity:
                                newQuantity,

                            availableQuantity:
                                newAvailable,

                            lastMovementType:
                                editingSaleId
                                    ? "SALE EDIT"
                                    : "SALE",

                            lastMovementQuantity:
                                Math.abs(
                                    quantityDelta
                                ),

                            lastSalesInvoice:
                                data.invoiceNumber,

                            updatedAt:
                                serverTimestamp()

                        }
                    );

                }


                /*
                 * CUSTOMER OUTSTANDING UPDATE
                 */
                for (
                    const [
                        customerId,
                        amountDelta
                    ]
                    of customerDelta
                ) {

                    if (
                        !customerId ||
                        amountDelta === 0
                    ) {
                        continue;
                    }

                    const customerEntry =
                        customerSnapshots.get(
                            customerId
                        );

                    if (!customerEntry) {
                        continue;
                    }

                    const customer =
                        customerEntry
                            .snapshot
                            .data();

                    const oldOutstanding =
                        numberValue(
                            customer.outstanding
                        );

                    const oldReceivable =
                        numberValue(
                            customer.receivable
                        );

                    transaction.update(
                        customerEntry.reference,
                        {

                            outstanding:
                                Math.max(
                                    oldOutstanding +
                                    amountDelta,
                                    0
                                ),

                            receivable:
                                Math.max(
                                    oldReceivable +
                                    amountDelta,
                                    0
                                ),

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
                 * SALES HEADER
                 */
                transaction.set(
                    saleReference,
                    {

                        invoiceNumber:
                            data.invoiceNumber,

                        invoiceDate:
                            data.invoiceDate ||
                            null,

                        dueDate:
                            data.dueDate ||
                            null,

                        referenceNumber:
                            data.referenceNumber ||
                            "",

                        customerId:
                            data.customerId ||
                            null,

                        customerName:
                            data.customerName,

                        customerAddress:
                            data.customerAddress,

                        customerGSTIN:
                            data.customerGSTIN,

                        customerMobile:
                            data.customerMobile,

                        receiverId:
                            data.receiverId ||
                            null,

                        receiverName:
                            data.receiverName,

                        receiverAddress:
                            data.receiverAddress,

                        receiverGSTIN:
                            data.receiverGSTIN,

                        receiverMobile:
                            data.receiverMobile,

                        sameAsBillTo:
                            data.sameAsBillTo,

                        transportMode:
                            data.transportMode,

                        vehicleNumber:
                            data.vehicleNumber,

                        driverName:
                            data.driverName,

                        driverMobile:
                            data.driverMobile,

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
                            getPaymentStatus(
                                data
                            ),

                        updatedAt:
                            serverTimestamp(),

                        updatedBy:
                            userId,

                        ...(
                            editingSaleId
                                ? {}
                                : {
                                    createdAt:
                                        serverTimestamp(),

                                    createdBy:
                                        userId
                                }
                        )

                    },
                    {
                        merge: true
                    }
                );


                /*
                 * DELETE OLD SALE ITEMS
                 */
                if (editingSaleId) {

                    for (
                        const oldItem
                        of oldItems
                    ) {

                        transaction.delete(
                            oldItem.ref
                        );

                    }

                }


                /*
                 * CREATE NEW SALE ITEMS
                 */
                for (
                    const item
                    of data.items
                ) {

                    const material =
                        getMaterial(
                            item.materialId
                        );

                    const costRate =
                        numberValue(
                            material?.purchaseRate ??
                            material?.averageCost ??
                            material?.costRate ??
                            0
                        );

                    const costAmount =
                        item.quantity *
                        costRate;

                    const profit =
                        item.taxableAmount -
                        costAmount;

                    const itemReference =
                        doc(
                            collection(
                                db,
                                SALES_ITEMS
                            )
                        );

                    transaction.set(
                        itemReference,
                        {

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

                            costRate,

                            costAmount,

                            profit,

                            createdAt:
                                serverTimestamp(),

                            createdBy:
                                userId

                        }
                    );

                }

            }
        );

        const message =
            editingSaleId
                ? `Invoice ${data.invoiceNumber} updated successfully.`
                : `Invoice ${data.invoiceNumber} posted successfully.`;

        showMessage(
            message,
            "success"
        );

        editingSaleId = null;

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
                    id: item.id,
                    ...item.data()
                })
            );

    }
    catch(error) {

        console.warn(
            "Ordered sales query failed:",
            error
        );

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
                    id: item.id,
                    ...item.data()
                })
            );

    }

    renderSales(
        salesCache
    );

    updateSalesSummary(
        salesCache
    );

    return salesCache;

}


/* ============================================================
   RENDER SALES HISTORY
   ============================================================ */

function renderSales(
    sales
) {

    const table =
        el(
            "salesTable"
        ) ||
        el(
            "recentInvoices"
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
                        sale.receiverName,
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

    if (!filtered.length) {

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
                sale => {

                    const id =
                        escapeHTML(
                            sale.id
                        );

                    return `
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
                                ${escapeHTML(
                                    formatDate(
                                        sale.invoiceDate
                                    )
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
                                <span class="status">
                                    ${escapeHTML(
                                        sale.paymentStatus ||
                                        "Pending"
                                    )}
                                </span>
                            </td>

                            <td>
                                <div
                                    style="
                                        display:flex;
                                        gap:6px;
                                        flex-wrap:wrap;
                                    "
                                >

                                    <button
                                        type="button"
                                        onclick="viewSale('${id}')"
                                    >
                                        View
                                    </button>

                                    <button
                                        type="button"
                                        onclick="editSale('${id}')"
                                    >
                                        Edit
                                    </button>

                                    <button
                                        type="button"
                                        onclick="printSale('${id}')"
                                    >
                                        Print
                                    </button>

                                    <button
                                        type="button"
                                        onclick="deleteSale('${id}')"
                                    >
                                        Delete
                                    </button>

                                </div>
                            </td>

                        </tr>
                    `;

                }
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
                total,
                sale
            ) =>
                total +
                numberValue(
                    sale.totalAmount
                ),
            0
        );

    const totalOutstanding =
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

    const totalGST =
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
        money(
            totalSales
        )
    );

    setText(
        [
            "salesOutstanding",
            "totalSalesOutstanding"
        ],
        money(
            totalOutstanding
        )
    );

    setText(
        [
            "salesGST",
            "totalSalesGST"
        ],
        money(
            totalGST
        )
    );

}


/* ============================================================
   GET SALE FROM CACHE
   ============================================================ */

function findSale(
    saleId
) {

    return salesCache.find(
        sale =>
            sale.id === saleId
    ) || null;

}


/* ============================================================
   VIEW SALE
   ============================================================ */

async function viewSale(
    saleId
) {

    try {

        const sale =
            findSale(
                saleId
            );

        if (!sale) {

            throw new Error(
                "Sales invoice not found."
            );

        }

        const items =
            await getSaleItems(
                saleId
            );

        showSalesViewModal(
            sale,
            items
        );

    }
    catch(error) {

        showMessage(
            getErrorMessage(error),
            "error"
        );

    }

}


function showSalesViewModal(
    sale,
    items
) {

    let modal =
        el(
            "salesViewModal"
        );

    if (!modal) {

        modal =
            document.createElement(
                "div"
            );

        modal.id =
            "salesViewModal";

        Object.assign(
            modal.style,
            {
                position: "fixed",
                inset: "0",
                zIndex: "99999",
                background: "rgba(15,23,42,.55)",
                display: "none",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px"
            }
        );

        document.body.appendChild(
            modal
        );

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal
                ) {

                    closeSalesView();

                }

            }
        );

    }

    const itemRows =
        items.map(
            (
                item,
                index
            ) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>
                        ${escapeHTML(
                            item.materialName
                        )}
                    </td>
                    <td>
                        ${escapeHTML(
                            item.hsn ||
                            "-"
                        )}
                    </td>
                    <td>
                        ${numberValue(
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
                            item.lineTotal
                        )}
                    </td>
                </tr>
            `
        )
        .join("");

    modal.innerHTML = `
        <div
            style="
                width:min(900px,100%);
                max-height:90vh;
                overflow:auto;
                background:#fff;
                border-radius:18px;
                padding:24px;
                box-shadow:0 25px 80px rgba(0,0,0,.25);
            "
        >

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:15px;
                    margin-bottom:20px;
                "
            >

                <div>
                    <div
                        style="
                            font-size:20px;
                            font-weight:800;
                        "
                    >
                        ${escapeHTML(
                            sale.invoiceNumber
                        )}
                    </div>

                    <div
                        style="
                            color:#64748b;
                            margin-top:4px;
                        "
                    >
                        ${escapeHTML(
                            formatDate(
                                sale.invoiceDate
                            )
                        )}
                    </div>
                </div>

                <button
                    type="button"
                    onclick="closeSalesView()"
                >
                    Close
                </button>

            </div>

            <div
                style="
                    display:grid;
                    grid-template-columns:
                        repeat(
                            auto-fit,
                            minmax(220px,1fr)
                        );
                    gap:12px;
                    margin-bottom:20px;
                "
            >

                <div>
                    <strong>Bill To</strong>
                    <div>
                        ${escapeHTML(
                            sale.customerName ||
                            "-"
                        )}
                    </div>
                    <div>
                        ${escapeHTML(
                            sale.customerAddress ||
                            "-"
                        )}
                    </div>
                </div>

                <div>
                    <strong>Ship To</strong>
                    <div>
                        ${escapeHTML(
                            sale.receiverName ||
                            sale.customerName ||
                            "-"
                        )}
                    </div>
                    <div>
                        ${escapeHTML(
                            sale.receiverAddress ||
                            sale.customerAddress ||
                            "-"
                        )}
                    </div>
                </div>

                <div>
                    <strong>Transport</strong>
                    <div>
                        ${escapeHTML(
                            sale.transportMode ||
                            "-"
                        )}
                    </div>
                    <div>
                        Vehicle:
                        ${escapeHTML(
                            sale.vehicleNumber ||
                            "-"
                        )}
                    </div>
                    <div>
                        Driver:
                        ${escapeHTML(
                            sale.driverName ||
                            "-"
                        )}
                    </div>
                </div>

            </div>

            <div
                style="
                    overflow:auto;
                "
            >
                <table
                    style="
                        width:100%;
                        border-collapse:collapse;
                    "
                >
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Material</th>
                            <th>HSN</th>
                            <th>Qty</th>
                            <th>Rate</th>
                            <th>Amount</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${itemRows}
                    </tbody>
                </table>
            </div>

            <div
                style="
                    display:flex;
                    justify-content:flex-end;
                    margin-top:20px;
                    font-size:18px;
                "
            >
                <strong>
                    Grand Total:
                    ₹${formatAmount(
                        sale.totalAmount
                    )}
                </strong>
            </div>

        </div>
    `;

    modal.style.display =
        "flex";

}


function closeSalesView() {

    const modal =
        el(
            "salesViewModal"
        );

    if (modal) {

        modal.style.display =
            "none";

    }

}


/* ============================================================
   EDIT SALE
   ============================================================ */

async function editSale(
    saleId
) {

    try {

        const sale =
            findSale(
                saleId
            );

        if (!sale) {

            throw new Error(
                "Sales invoice not found."
            );

        }

        const items =
            await getSaleItems(
                saleId
            );

        editingSaleId =
            saleId;

        /*
         * HEADER
         */
        setValue(
            [
                "invoiceNumber",
                "salesInvoiceNumber"
            ],
            sale.invoiceNumber
        );

        setValue(
            [
                "invoiceDate",
                "salesDate"
            ],
            sale.invoiceDate ||
            todayValue()
        );

        setValue(
            [
                "dueDate",
                "salesDueDate"
            ],
            sale.dueDate ||
            ""
        );

        setValue(
            [
                "referenceNumber",
                "referenceNo",
                "orderReference"
            ],
            sale.referenceNumber ||
            ""
        );


        /*
         * CUSTOMER
         */
        setValue(
            [
                "customerId",
                "salesCustomer",
                "customerSelect"
            ],
            sale.customerId ||
            ""
        );

        setValue(
            [
                "customerName",
                "billToName",
                "buyerName"
            ],
            sale.customerName ||
            ""
        );

        setValue(
            [
                "customerAddress",
                "billToAddress",
                "buyerAddress"
            ],
            sale.customerAddress ||
            ""
        );

        setValue(
            [
                "customerGSTIN",
                "customerGstin",
                "billToGSTIN",
                "buyerGSTIN"
            ],
            sale.customerGSTIN ||
            ""
        );

        setValue(
            [
                "customerMobile",
                "billToMobile",
                "buyerMobile"
            ],
            sale.customerMobile ||
            ""
        );


        /*
         * RECEIVER
         */
        setCheckbox(
            [
                "sameAsBillTo",
                "sameAsBuyer",
                "sameReceiver"
            ],
            Boolean(
                sale.sameAsBillTo
            )
        );

        setValue(
            [
                "receiverId",
                "receiverSelect",
                "shipToSelect"
            ],
            sale.receiverId ||
            ""
        );

        setValue(
            [
                "receiverName",
                "shipToName"
            ],
            sale.receiverName ||
            ""
        );

        setValue(
            [
                "receiverAddress",
                "deliveryAddress",
                "shipToAddress"
            ],
            sale.receiverAddress ||
            ""
        );

        setValue(
            [
                "receiverGSTIN",
                "receiverGstin",
                "shipToGSTIN"
            ],
            sale.receiverGSTIN ||
            ""
        );

        setValue(
            [
                "receiverMobile",
                "receiverPhone",
                "shipToMobile"
            ],
            sale.receiverMobile ||
            ""
        );


        /*
         * TRANSPORT
         */
        setValue(
            [
                "transportMode",
                "transport",
                "transMode"
            ],
            sale.transportMode ||
            "By Road"
        );

        setValue(
            [
                "vehicleNumber",
                "vehicleNo",
                "vehicle"
            ],
            sale.vehicleNumber ||
            ""
        );

        setValue(
            [
                "driverName",
                "driver"
            ],
            sale.driverName ||
            ""
        );

        setValue(
            [
                "driverMobile",
                "driverPhone"
            ],
            sale.driverMobile ||
            ""
        );


        /*
         * PAYMENT
         */
        setValue(
            [
                "paymentMode",
                "salesPaymentMode"
            ],
            sale.paymentMode ||
            "Credit"
        );

        setValue(
            [
                "paymentAmount",
                "amountReceived",
                "receivedAmount"
            ],
            numberValue(
                sale.paymentAmount
            )
        );

        setValue(
            [
                "customerInvoiceNumber"
            ],
            sale.customerInvoiceNumber ||
            ""
        );

        setValue(
            [
                "notes",
                "remarks"
            ],
            sale.notes ||
            ""
        );


        /*
         * CLEAR OLD ROWS
         */
        const container =
            el(
                "salesItems"
            );

        if (!container) {

            throw new Error(
                "Sales items container not found."
            );

        }

        container.innerHTML = "";


        /*
         * ADD EDIT ITEMS
         */
        for (
            const item
            of items
        ) {

            addSalesRow();

            const row =
                container.lastElementChild;

            if (!row) {
                continue;
            }

            const materialSelect =
                row.querySelector(
                    "[data-sales-material]"
                );

            if (materialSelect) {

                materialSelect.value =
                    item.materialId;

            }

            applyMaterialToRow(
                row,
                item.materialId
            );

            const hsn =
                row.querySelector(
                    "[data-field='hsn']"
                );

            const quantity =
                row.querySelector(
                    "[data-field='quantity']"
                );

            const rate =
                row.querySelector(
                    "[data-field='rate']"
                );

            const gst =
                row.querySelector(
                    "[data-field='gst']"
                );

            if (hsn) {

                hsn.value =
                    item.hsn ||
                    "";

            }

            if (quantity) {

                quantity.value =
                    numberValue(
                        item.quantity
                    );

            }

            if (rate) {

                rate.value =
                    numberValue(
                        item.rate
                    );

            }

            if (gst) {

                gst.value =
                    numberValue(
                        item.gstRate
                    );

            }

            calculateSalesRow(
                row
            );

        }

        calculateSalesTotal();

        window.scrollTo(
            {
                top: 0,
                behavior: "smooth"
            }
        );

        showMessage(
            `${sale.invoiceNumber} loaded for editing.`,
            "info"
        );

    }
    catch(error) {

        editingSaleId = null;

        showMessage(
            getErrorMessage(error),
            "error"
        );

    }

}


/* ============================================================
   DELETE SALE
   ============================================================ */

async function deleteSale(
    saleId
) {

    try {

        const sale =
            findSale(
                saleId
            );

        if (!sale) {

            throw new Error(
                "Sales invoice not found."
            );

        }

        const confirmed =
            window.confirm(
                `Delete invoice ${sale.invoiceNumber}?\n\n` +
                "Stock and customer outstanding will be restored automatically."
            );

        if (!confirmed) {
            return;
        }

        const oldItems =
            await getSaleItems(
                saleId
            );

        const materialIds =
            oldItems.map(
                item =>
                    item.materialId
            );

        const inventoryReferences =
            await getInventoryReferenceMap(
                materialIds
            );

        const saleReference =
            doc(
                db,
                SALES,
                saleId
            );

        const userId =
            currentUserId();

        await runTransaction(
            db,
            async transaction => {

                const saleSnapshot =
                    await transaction.get(
                        saleReference
                    );

                if (
                    !saleSnapshot.exists()
                ) {

                    throw new Error(
                        "Invoice no longer exists."
                    );

                }


                /*
                 * READ CUSTOMER
                 */
                let customerReference =
                    null;

                let customerSnapshot =
                    null;

                if (
                    sale.customerId
                ) {

                    customerReference =
                        doc(
                            db,
                            CUSTOMERS,
                            sale.customerId
                        );

                    customerSnapshot =
                        await transaction.get(
                            customerReference
                        );

                }


                /*
                 * READ INVENTORY
                 */
                const inventorySnapshots =
                    new Map();

                for (
                    const [
                        materialId,
                        reference
                    ]
                    of inventoryReferences
                ) {

                    const snapshot =
                        await transaction.get(
                            reference
                        );

                    if (
                        !snapshot.exists()
                    ) {

                        throw new Error(
                            "Inventory record not found."
                        );

                    }

                    inventorySnapshots.set(
                        materialId,
                        snapshot
                    );

                }


                /*
                 * RESTORE STOCK
                 */
                const restoreMap =
                    new Map();

                oldItems.forEach(
                    item => {

                        restoreMap.set(
                            item.materialId,
                            (
                                restoreMap.get(
                                    item.materialId
                                ) || 0
                            ) +
                            numberValue(
                                item.quantity
                            )
                        );

                    }
                );

                for (
                    const [
                        materialId,
                        restoreQuantity
                    ]
                    of restoreMap
                ) {

                    const inventory =
                        inventorySnapshots
                            .get(
                                materialId
                            )
                            .data();

                    const oldQuantity =
                        numberValue(
                            inventory.quantity
                        );

                    const reserved =
                        numberValue(
                            inventory.reservedQuantity
                        );

                    const newQuantity =
                        oldQuantity +
                        restoreQuantity;

                    transaction.update(
                        inventoryReferences.get(
                            materialId
                        ),
                        {

                            quantity:
                                newQuantity,

                            availableQuantity:
                                Math.max(
                                    newQuantity -
                                    reserved,
                                    0
                                ),

                            lastMovementType:
                                "SALE DELETE",

                            lastMovementQuantity:
                                restoreQuantity,

                            updatedAt:
                                serverTimestamp()

                        }
                    );

                }


                /*
                 * RESTORE CUSTOMER OUTSTANDING
                 */
                if (
                    customerReference &&
                    customerSnapshot?.exists()
                ) {

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

                    transaction.update(
                        customerReference,
                        {

                            outstanding:
                                Math.max(
                                    oldOutstanding -
                                    numberValue(
                                        sale.outstanding
                                    ),
                                    0
                                ),

                            receivable:
                                Math.max(
                                    oldReceivable -
                                    numberValue(
                                        sale.outstanding
                                    ),
                                    0
                                ),

                            updatedAt:
                                serverTimestamp(),

                            updatedBy:
                                userId

                        }
                    );

                }


                /*
                 * DELETE SALE ITEMS
                 */
                for (
                    const item
                    of oldItems
                ) {

                    transaction.delete(
                        item.ref
                    );

                }


                /*
                 * DELETE HEADER
                 */
                transaction.delete(
                    saleReference
                );

            }
        );

        if (
            editingSaleId === saleId
        ) {

            await clearSalesForm();

        }

        showMessage(
            `${sale.invoiceNumber} deleted and stock restored.`,
            "success"
        );

        await loadSales();

    }
    catch(error) {

        console.error(
            "Delete sale error:",
            error
        );

        showMessage(
            getErrorMessage(error),
            "error"
        );

    }

}


/* ============================================================
   AMOUNT IN WORDS
   ============================================================ */

function amountInWords(
    amount
) {

    const number =
        Math.round(
            numberValue(amount)
        );

    if (number === 0) {
        return "Zero Rupees Only";
    }

    const ones = [
        "",
        "One",
        "Two",
        "Three",
        "Four",
        "Five",
        "Six",
        "Seven",
        "Eight",
        "Nine",
        "Ten",
        "Eleven",
        "Twelve",
        "Thirteen",
        "Fourteen",
        "Fifteen",
        "Sixteen",
        "Seventeen",
        "Eighteen",
        "Nineteen"
    ];

    const tens = [
        "",
        "",
        "Twenty",
        "Thirty",
        "Forty",
        "Fifty",
        "Sixty",
        "Seventy",
        "Eighty",
        "Ninety"
    ];

    function belowThousand(n) {

        let result = "";

        if (n >= 100) {

            result +=
                ones[
                    Math.floor(
                        n / 100
                    )
                ] +
                " Hundred";

            n %= 100;

            if (n) {
                result += " ";
            }

        }

        if (n >= 20) {

            result +=
                tens[
                    Math.floor(
                        n / 10
                    )
                ];

            if (n % 10) {

                result +=
                    " " +
                    ones[
                        n % 10
                    ];

            }

        }
        else if (n > 0) {

            result +=
                ones[n];

        }

        return result.trim();

    }

    let result = "";

    const crore =
        Math.floor(
            number / 10000000
        );

    const lakh =
        Math.floor(
            (
                number % 10000000
            ) / 100000
        );

    const thousand =
        Math.floor(
            (
                number % 100000
            ) / 1000
        );

    const rest =
        number % 1000;

    if (crore) {

        result +=
            belowThousand(
                crore
            ) +
            " Crore ";

    }

    if (lakh) {

        result +=
            belowThousand(
                lakh
            ) +
            " Lakh ";

    }

    if (thousand) {

        result +=
            belowThousand(
                thousand
            ) +
            " Thousand ";

    }

    if (rest) {

        result +=
            belowThousand(
                rest
            );

    }

    return (
        result
            .replace(
                /\s+/g,
                " "
            )
            .trim() +
        " Rupees Only"
    );

}


/* ============================================================
   PRINT SALE
   ============================================================ */

async function printSale(
    saleId
) {

    try {

        const sale =
            findSale(
                saleId
            );

        if (!sale) {

            throw new Error(
                "Sales invoice not found."
            );

        }

        const items =
            await getSaleItems(
                saleId
            );

        preparePrintInvoice(
            sale,
            items
        );

        setTimeout(
            () => {

                window.print();

            },
            150
        );

    }
    catch(error) {

        showMessage(
            getErrorMessage(error),
            "error"
        );

    }

}


/* ============================================================
   PREPARE A4 PRINT INVOICE
   ============================================================ */

function preparePrintInvoice(
    sale,
    items
) {

    /*
     * BILL TO
     */
    setText(
        [
            "printCustomer",
            "printBillToName",
            "printBuyerName"
        ],
        sale.customerName ||
        "Walk-in Customer"
    );

    const customerInfo =
        [
            sale.customerAddress,
            sale.customerGSTIN
                ? "GSTIN: " +
                  sale.customerGSTIN
                : "",
            sale.customerMobile
                ? "Mobile: " +
                  sale.customerMobile
                : ""
        ]
        .filter(Boolean)
        .join("\n");

    setText(
        [
            "printCustomerInfo",
            "printBillToInfo",
            "printBuyerInfo"
        ],
        customerInfo
    );


    /*
     * RECEIVER / SHIP TO
     */
    setText(
        [
            "printReceiver",
            "printReceiverName",
            "printShipToName"
        ],
        sale.receiverName ||
        sale.customerName ||
        "-"
    );

    const receiverInfo =
        [
            sale.receiverAddress ||
            sale.customerAddress,
            (
                sale.receiverGSTIN ||
                sale.customerGSTIN
            )
                ? "GSTIN: " +
                  (
                      sale.receiverGSTIN ||
                      sale.customerGSTIN
                  )
                : "",
            (
                sale.receiverMobile ||
                sale.customerMobile
            )
                ? "Mobile: " +
                  (
                      sale.receiverMobile ||
                      sale.customerMobile
                  )
                : ""
        ]
        .filter(Boolean)
        .join("\n");

    setText(
        [
            "printReceiverInfo",
            "printShipToInfo"
        ],
        receiverInfo
    );


    /*
     * INVOICE DETAILS
     */
    setText(
        [
            "printInvoiceNo",
            "printInvoiceNumber"
        ],
        sale.invoiceNumber ||
        "-"
    );

    setText(
        [
            "printInvoiceDate",
            "printDate"
        ],
        formatDate(
            sale.invoiceDate
        )
    );

    setText(
        [
            "printDueDate"
        ],
        formatDate(
            sale.dueDate
        )
    );

    setText(
        [
            "printReference",
            "printReferenceNumber"
        ],
        sale.referenceNumber ||
        "-"
    );

    setText(
        [
            "printTransportMode",
            "printTransport"
        ],
        sale.transportMode ||
        "By Road"
    );

    setText(
        [
            "printVehicleNo",
            "printVehicleNumber"
        ],
        sale.vehicleNumber ||
        "-"
    );

    setText(
        [
            "printDriver",
            "printDriverName"
        ],
        sale.driverName ||
        "-"
    );

    setText(
        [
            "printDriverMobile"
        ],
        sale.driverMobile ||
        "-"
    );


    /*
     * PRINT ITEMS
     */
    const body =
        el(
            "printItemBody"
        ) ||
        el(
            "printItems"
        );

    if (body) {

        body.innerHTML =
            items.map(
                (
                    item,
                    index
                ) => `
                    <tr>

                        <td>
                            ${String(
                                index + 1
                            ).padStart(
                                2,
                                "0"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                item.materialName ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                item.hsn ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${numberValue(
                                item.quantity
                            )}
                        </td>

                        <td>
                            ${formatAmount(
                                item.rate
                            )}
                        </td>

                        <td>
                            ${formatAmount(
                                item.lineTotal
                            )}
                        </td>

                    </tr>
                `
            )
            .join("");

    }


    /*
     * TOTALS
     */
    setText(
        [
            "printSubtotal",
            "printTaxable"
        ],
        money(
            sale.taxableAmount
        )
    );

    setText(
        [
            "printTax",
            "printGST"
        ],
        money(
            sale.gstAmount
        )
    );

    setText(
        [
            "printCGST"
        ],
        money(
            numberValue(
                sale.cgstAmount
            )
        )
    );

    setText(
        [
            "printSGST"
        ],
        money(
            numberValue(
                sale.sgstAmount
            )
        )
    );

    setText(
        [
            "printIGST"
        ],
        money(
            numberValue(
                sale.igstAmount
            )
        )
    );

    setText(
        [
            "printTotal",
            "printGrandTotal"
        ],
        money(
            sale.totalAmount
        )
    );

    setText(
        [
            "printAmountWords",
            "printTotalInWords"
        ],
        amountInWords(
            sale.totalAmount
        )
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

        showMessage(
            "Sales items container not found.",
            "error"
        );

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
                    Select Material
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
                                        material.name ||
                                        "Material"
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

    materialSelect?.addEventListener(
        "change",
        () => {

            applyMaterialToRow(
                row,
                materialSelect.value
            );

        }
    );

    row
        .querySelectorAll(
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
   CLEAR FORM
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

    const container =
        el(
            "salesItems"
        );

    if (container) {

        container.innerHTML = "";

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

    setValue(
        [
            "invoiceDate",
            "salesDate"
        ],
        todayValue()
    );

    setValue(
        [
            "paymentAmount",
            "amountReceived",
            "receivedAmount"
        ],
        "0"
    );

    setValue(
        [
            "transportMode",
            "transport",
            "transMode"
        ],
        "By Road"
    );

    calculateSalesTotal();

}


/* ============================================================
   BIND EXISTING ROW EVENTS
   ============================================================ */

function bindExistingRows() {

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

                select?.addEventListener(
                    "change",
                    () => {

                        applyMaterialToRow(
                            row,
                            select.value
                        );

                    }
                );

                row
                    .querySelectorAll(
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

}


/* ============================================================
   BIND CUSTOMER / RECEIVER EVENTS
   ============================================================ */

function bindCustomerReceiverEvents() {

    [
        "customerId",
        "salesCustomer",
        "customerSelect"
    ]
    .forEach(
        id => {

            const node =
                el(id);

            node?.addEventListener(
                "change",
                () => {

                    applyCustomerToBuyer(
                        node.value
                    );

                    if (
                        getCheckbox(
                            "sameAsBillTo",
                            "sameAsBuyer",
                            "sameReceiver"
                        )
                    ) {

                        handleSameAsBillTo();

                    }

                }
            );

        }
    );


    [
        "receiverId",
        "receiverSelect",
        "shipToSelect"
    ]
    .forEach(
        id => {

            const node =
                el(id);

            node?.addEventListener(
                "change",
                () => {

                    applyCustomerToReceiver(
                        node.value
                    );

                }
            );

        }
    );


    [
        "sameAsBillTo",
        "sameAsBuyer",
        "sameReceiver"
    ]
    .forEach(
        id => {

            const node =
                el(id);

            node?.addEventListener(
                "change",
                handleSameAsBillTo
            );

        }
    );

}


/* ============================================================
   PAYMENT EVENTS
   ============================================================ */

function bindPaymentEvents() {

    [
        "paymentAmount",
        "amountReceived",
        "receivedAmount"
    ]
    .forEach(
        id => {

            const node =
                el(id);

            node?.addEventListener(
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

                position: "fixed",

                right: "18px",

                bottom: "18px",

                zIndex: "999999",

                maxWidth: "420px",

                padding: "14px 18px",

                borderRadius: "12px",

                fontSize: "13px",

                fontWeight: "700",

                boxShadow:
                    "0 18px 45px rgba(0,0,0,.18)"

            }
        );

        document.body.appendChild(
            box
        );

    }

    box.textContent =
        message;

    if (
        type === "success"
    ) {

        box.style.background =
            "#eaf8f0";

        box.style.color =
            "#147a48";

        box.style.border =
            "1px solid #bce7ce";

    }
    else if (
        type === "error"
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
   ERROR MESSAGE
   ============================================================ */

function getErrorMessage(
    error
) {

    if (!error) {

        return "Something went wrong.";

    }

    const code =
        clean(
            error.code
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

        try {

            await Promise.all([
                loadSalesCustomers(),
                loadSalesMaterials()
            ]);

            const invoiceField =
                value(
                    "invoiceNumber",
                    "salesInvoiceNumber"
                );

            if (!invoiceField) {

                setValue(
                    [
                        "invoiceNumber",
                        "salesInvoiceNumber"
                    ],
                    await generateSalesInvoiceNumber()
                );

            }

            if (
                !value(
                    "invoiceDate",
                    "salesDate"
                )
            ) {

                setValue(
                    [
                        "invoiceDate",
                        "salesDate"
                    ],
                    todayValue()
                );

            }

            bindExistingRows();

            bindCustomerReceiverEvents();

            bindPaymentEvents();

            const search =
                el(
                    "salesSearch"
                ) ||
                el(
                    "search"
                );

            search?.addEventListener(
                "input",
                () =>
                    renderSales(
                        salesCache
                    )
            );

            calculateSalesTotal();

            await loadSales();

            console.info(
                "%cMMV Sales Complete%c ready",
                "font-weight:800;color:#0a3d91;",
                "color:inherit;"
            );

        }
        catch(error) {

            console.error(
                "Sales page initialization error:",
                error
            );

            showMessage(
                getErrorMessage(error),
                "error"
            );

        }

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

    viewSale,

    closeSalesView,

    editSale,

    printSale,

    deleteSale

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

window.closeSalesView =
    closeSalesView;

window.editSale =
    editSale;

window.printSale =
    printSale;

window.deleteSale =
    deleteSale;
