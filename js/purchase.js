/* ============================================================
   MMV TRADERS ERP V2
   PURCHASE SERVICE
   Production Firebase + Firestore
   ------------------------------------------------------------
   Handles:
   - Purchase invoice numbering
   - Supplier selection
   - Material-wise GST / HSN / rate
   - Line calculations
   - Purchase total
   - Supplier payable
   - Inventory Stock IN
   - Purchase history
   - Duplicate invoice protection
   ============================================================ */

"use strict";

import {
    collection,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    doc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
    db,
    auth
} from "./firebase.js";


/* ============================================================
   COLLECTIONS
   ============================================================ */

const PURCHASES =
    "purchases";

const SUPPLIERS =
    "suppliers";

const MATERIALS =
    "materials";

const INVENTORY =
    "inventory";

const PURCHASE_ITEMS =
    "purchaseItems";


/* ============================================================
   CONFIG
   ============================================================ */

const INVOICE_PREFIX =
    "PUR-";

const MAX_RESULTS =
    500;


/* ============================================================
   STATE
   ============================================================ */

let purchaseCache = [];

let supplierCache = [];

let materialCache = [];

let editingPurchaseId = null;


/* ============================================================
   BASIC HELPERS
   ============================================================ */

function el(id) {

    return document.getElementById(id);

}


function value(...ids) {

    for (const id of ids) {

        const node =
            el(id);

        if (node) {

            return String(
                node.value ?? ""
            ).trim();

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


function numberValue(input) {

    const n =
        Number(input);

    return Number.isFinite(n)
        ? n
        : 0;

}


function clean(input) {

    return String(
        input ?? ""
    ).trim();

}


function escapeHTML(input) {

    return String(
        input ?? ""
    )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function formatAmount(input) {

    return numberValue(
        input
    ).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );

}


function formatDate(dateValue) {

    if (!dateValue) {

        return "-";

    }

    try {

        let date;

        if (
            typeof dateValue.toDate ===
            "function"
        ) {

            date =
                dateValue.toDate();

        }
        else {

            date =
                new Date(
                    dateValue
                );

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
   CURRENT USER
   ============================================================ */

function currentUserId() {

    return auth?.currentUser?.uid ||
        null;

}


/* ============================================================
   PURCHASE NUMBER
   ============================================================ */

async function generatePurchaseNumber() {

    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        PURCHASES
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

                const data =
                    item.data();


                const invoice =
                    clean(
                        data.invoiceNumber
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
            "Purchase number generation fallback:",
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
   LOAD SUPPLIERS
   ============================================================ */

async function loadPurchaseSuppliers() {

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
                    a.supplierName || ""
                ).localeCompare(
                    String(
                        b.supplierName || ""
                    )
                )
        );


        populateSupplierSelect();


        return supplierCache;

    }
    catch(error) {

        console.error(
            "Load suppliers error:",
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

async function loadPurchaseMaterials() {

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
            "Load materials error:",
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
   SUPPLIER DROPDOWN
   ============================================================ */

function populateSupplierSelect() {

    const ids = [

        "supplierId",
        "purchaseSupplier",
        "supplierSelect"

    ];


    let select = null;


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
                                supplier.supplierName
                            )}
                            ${
                                supplier.supplierCode
                                    ? " — " +
                                      escapeHTML(
                                          supplier.supplierCode
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

    const selects =
        document.querySelectorAll(
            "select[data-purchase-material]"
        );


    selects.forEach(
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
   MATERIAL DETAILS
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
   APPLY MATERIAL DETAILS TO ROW
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
                material.purchaseRate
            );

    }


    if (unit) {

        unit.textContent =
            material.unit ||
            "PCS";

    }


    calculatePurchaseRow(
        row
    );

}


/* ============================================================
   CALCULATE ONE ROW
   ============================================================ */

function calculatePurchaseRow(
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


    const taxable =
        quantity *
        rate;


    const gstAmount =
        taxable *
        gstRate /
        100;


    const total =
        taxable +
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
                taxable
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
                total
            );

    }


    calculatePurchaseTotal();

}


/* ============================================================
   GET PURCHASE ROWS
   ============================================================ */

function getPurchaseRows() {

    const rows =
        document.querySelectorAll(
            "[data-purchase-row]"
        );


    const result = [];


    rows.forEach(
        row => {

            const materialSelect =
                row.querySelector(
                    "select[data-purchase-material]"
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


            result.push({

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


    return result;

}


/* ============================================================
   PURCHASE TOTAL
   ============================================================ */

function calculatePurchaseTotal() {

    const items =
        getPurchaseRows();


    const taxableAmount =
        items.reduce(
            (
                sum,
                item
            ) =>
                sum +
                item.taxableAmount,
            0
        );


    const gstAmount =
        items.reduce(
            (
                sum,
                item
            ) =>
                sum +
                item.gstAmount,
            0
        );


    const total =
        taxableAmount +
        gstAmount;


    setText(
        [
            "purchaseTaxable",
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
            "purchaseGST",
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
            "purchaseTotal",
            "grandTotal",
            "totalAmount"
        ],
        "₹" +
        formatAmount(
            total
        )
    );


    return {

        taxableAmount,

        gstAmount,

        total

    };

}


/* ============================================================
   GET PURCHASE FORM
   ============================================================ */

function getPurchaseFormData() {

    const supplierId =
        value(
            "supplierId",
            "purchaseSupplier",
            "supplierSelect"
        );


    const supplier =
        supplierCache.find(
            item =>
                item.id ===
                supplierId
        ) || null;


    const invoiceNumber =
        value(
            "invoiceNumber",
            "purchaseNumber"
        );


    const invoiceDate =
        value(
            "invoiceDate",
            "purchaseDate"
        );


    const supplierInvoiceNumber =
        value(
            "supplierInvoiceNumber",
            "supplierInvoiceNo"
        );


    const paymentMode =
        value(
            "paymentMode"
        ) ||
        "Credit";


    const notes =
        value(
            "notes",
            "remarks"
        );


    const items =
        getPurchaseRows();


    const totals =
        calculatePurchaseTotal();


    return {

        invoiceNumber,

        invoiceDate,

        supplierInvoiceNumber,

        supplierId,

        supplierName:
            supplier?.supplierName ||
            "",

        paymentMode,

        notes,

        items,

        taxableAmount:
            totals.taxableAmount,

        gstAmount:
            totals.gstAmount,

        totalAmount:
            totals.total

    };

}


/* ============================================================
   VALIDATE PURCHASE
   ============================================================ */

function validatePurchase(
    data
) {

    if (
        !data.supplierId
    ) {

        throw new Error(
            "Please select a supplier."
        );

    }


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
            !item.materialId
        ) {

            throw new Error(
                "Material is missing in purchase."
            );

        }


        if (
            item.quantity <= 0
        ) {

            throw new Error(
                "Purchase quantity must be greater than zero."
            );

        }


        if (
            item.rate < 0
        ) {

            throw new Error(
                "Purchase rate cannot be negative."
            );

        }


        if (
            item.gstRate < 0 ||
            item.gstRate > 100
        ) {

            throw new Error(
                "GST rate must be between 0 and 100."
            );

        }

    }


    if (
        data.totalAmount <= 0
    ) {

        throw new Error(
            "Purchase total must be greater than zero."
        );

    }

}


/* ============================================================
   DUPLICATE SUPPLIER INVOICE
   ============================================================ */

async function checkDuplicateSupplierInvoice(
    supplierId,
    supplierInvoiceNumber,
    excludeId = null
) {

    if (
        !supplierInvoiceNumber
    ) {

        return null;

    }


    const q =
        query(
            collection(
                db,
                PURCHASES
            ),
            where(
                "supplierId",
                "==",
                supplierId
            ),
            where(
                "supplierInvoiceNumber",
                "==",
                supplierInvoiceNumber
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


        return {

            id:
                item.id,

            ...item.data()

        };

    }


    return null;

}


/* ============================================================
   SAVE PURCHASE
   ============================================================ */

async function savePurchase() {

    try {

        const data =
            getPurchaseFormData();


        validatePurchase(
            data
        );


        const duplicate =
            await checkDuplicateSupplierInvoice(

                data.supplierId,

                data.supplierInvoiceNumber,

                editingPurchaseId

            );


        if (
            duplicate
        ) {

            throw new Error(
                "This supplier invoice number already exists."
            );

        }


        if (
            editingPurchaseId
        ) {

            throw new Error(
                "Editing posted purchases is disabled. Use a purchase reversal/adjustment workflow."
            );

        }


        if (
            !data.invoiceNumber
        ) {

            data.invoiceNumber =
                await generatePurchaseNumber();

        }


        const userId =
            currentUserId();


        /*
         * --------------------------------------------------------
         * TRANSACTION
         * --------------------------------------------------------
         *
         * Purchase posting performs:
         *
         * 1. Purchase document
         * 2. Purchase item documents
         * 3. Supplier payable increase
         * 4. Inventory quantity increase
         *
         * Together.
         */

        let purchaseId =
            null;


        await runTransaction(
            db,
            async transaction => {

                /*
                 * Supplier
                 */

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


                /*
                 * Inventory references
                 */

                const inventoryReferences =
                    [];


                for (
                    const item
                    of data.items
                ) {

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


                    const inventorySnapshot =
                        await getDocs(
                            inventoryQuery
                        );


                    if (
                        inventorySnapshot.empty
                    ) {

                        throw new Error(
                            `Inventory record missing for ${item.materialName}.`
                        );

                    }


                    inventoryReferences.push({

                        item,

                        reference:
                            inventorySnapshot
                                .docs[0]
                                .ref

                    });

                }


                /*
                 * Purchase header
                 */

                const purchaseReference =
                    doc(
                        collection(
                            db,
                            PURCHASES
                        )
                    );


                purchaseId =
                    purchaseReference.id;


                transaction.set(
                    purchaseReference,
                    {

                        invoiceNumber:
                            data.invoiceNumber,

                        invoiceDate:
                            data.invoiceDate ||
                            null,

                        supplierId:
                            data.supplierId,

                        supplierName:
                            data.supplierName,

                        supplierInvoiceNumber:
                            data.supplierInvoiceNumber,

                        paymentMode:
                            data.paymentMode,

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
                 * Supplier payable
                 */

                const supplier =
                    supplierSnapshot.data();


                const oldPayable =
                    numberValue(
                        supplier.payable
                    );


                const oldOutstanding =
                    numberValue(
                        supplier.outstanding
                    );


                const newPayable =
                    oldPayable +
                    data.totalAmount;


                const newOutstanding =
                    oldOutstanding +
                    data.totalAmount;


                transaction.update(
                    supplierReference,
                    {

                        payable:
                            newPayable,

                        outstanding:
                            newOutstanding,

                        updatedAt:
                            serverTimestamp(),

                        updatedBy:
                            userId

                    }
                );


                /*
                 * Inventory
                 */

                for (
                    const entry
                    of inventoryReferences
                ) {

                    const inventorySnapshot =
                        await transaction.get(
                            entry.reference
                        );


                    if (
                        !inventorySnapshot.exists()
                    ) {

                        throw new Error(
                            `Inventory record missing for ${entry.item.materialName}.`
                        );

                    }


                    const inventory =
                        inventorySnapshot.data();


                    const oldQuantity =
                        numberValue(
                            inventory.quantity
                        );


                    const newQuantity =
                        oldQuantity +
                        entry.item.quantity;


                    const reserved =
                        numberValue(
                            inventory.reservedQuantity
                        );


                    const available =
                        newQuantity -
                        reserved;


                    const purchaseRate =
                        entry.item.rate;


                    transaction.update(
                        entry.reference,
                        {

                            quantity:
                                newQuantity,

                            availableQuantity:
                                available,

                            purchaseRate:
                                purchaseRate,

                            stockValue:
                                newQuantity *
                                purchaseRate,

                            lastMovementType:
                                "PURCHASE",

                            lastMovementQuantity:
                                entry.item.quantity,

                            lastPurchaseNumber:
                                data.invoiceNumber,

                            updatedAt:
                                serverTimestamp()

                        }
                    );

                }

            }
        );


        /*
         * --------------------------------------------------------
         * PURCHASE ITEMS
         * --------------------------------------------------------
         *
         * Created after the header transaction.
         * Purchase header is already posted.
         */

        for (
            const item of data.items
        ) {

            await addDoc(
                collection(
                    db,
                    PURCHASE_ITEMS
                ),
                {

                    purchaseId:

                        purchaseId,

                    invoiceNumber:

                        data.invoiceNumber,

                    supplierId:

                        data.supplierId,

                    supplierName:

                        data.supplierName,

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

                    createdAt:

                        serverTimestamp(),

                    createdBy:

                        userId

                }
            );

        }


        showMessage(
            `Purchase ${data.invoiceNumber} posted successfully.`,
            "success"
        );


        clearPurchaseForm();


        await loadPurchases();


        return purchaseId;

    }
    catch(error) {

        console.error(
            "Save purchase error:",
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
   LOAD PURCHASES
   ============================================================ */

async function loadPurchases() {

    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        PURCHASES
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


        purchaseCache =
            snapshot.docs.map(
                item => ({

                    id:
                        item.id,

                    ...item.data()

                })
            );


        renderPurchases(
            purchaseCache
        );


        updatePurchaseSummary(
            purchaseCache
        );


        return purchaseCache;

    }
    catch(error) {

        console.error(
            "Load purchases error:",
            error
        );


        /*
         * Fallback for older documents
         * without createdAt.
         */

        try {

            const snapshot =
                await getDocs(
                    query(
                        collection(
                            db,
                            PURCHASES
                        ),
                        limit(
                            MAX_RESULTS
                        )
                    )
                );


            purchaseCache =
                snapshot.docs.map(
                    item => ({

                        id:
                            item.id,

                        ...item.data()

                    })
                );


            renderPurchases(
                purchaseCache
            );


            updatePurchaseSummary(
                purchaseCache
            );


            return purchaseCache;

        }
        catch(fallbackError) {

            console.error(
                "Purchase fallback error:",
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
   RENDER PURCHASES
   ============================================================ */

function renderPurchases(
    purchases
) {

    const table =
        el(
            "purchaseTable"
        );


    if (!table) {

        return;

    }


    const search =
        value(
            "purchaseSearch",
            "search"
        )
        .toLowerCase();


    const filtered =
        purchases.filter(
            item => {

                const text =
                    [

                        item.invoiceNumber,

                        item.supplierName,

                        item.supplierInvoiceNumber,

                        item.paymentMode

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
        filtered.length === 0
    ) {

        table.innerHTML = `

            <tr>

                <td colspan="100%">

                    <div class="empty-state">

                        <strong>
                            No purchases found
                        </strong>

                        <span>
                            Posted purchases will appear here.
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
                                purchase.invoiceDate
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
                            <strong>
                                ₹${formatAmount(
                                    purchase.totalAmount
                                )}
                            </strong>
                        </td>

                        <td>

                            <span
                                class="active-badge"
                            >
                                ${escapeHTML(
                                    purchase.status ||
                                    "Posted"
                                )}
                            </span>

                        </td>

                        <td>

                            <button
                                type="button"
                                onclick="viewPurchase('${escapeHTML(
                                    purchase.id
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
   PURCHASE SUMMARY
   ============================================================ */

function updatePurchaseSummary(
    purchases
) {

    const totalPurchases =
        purchases.length;


    const totalValue =
        purchases.reduce(
            (
                sum,
                purchase
            ) =>
                sum +
                numberValue(
                    purchase.totalAmount
                ),
            0
        );


    const totalGST =
        purchases.reduce(
            (
                sum,
                purchase
            ) =>
                sum +
                numberValue(
                    purchase.gstAmount
                ),
            0
        );


    setText(
        [
            "totalPurchases",
            "purchaseCount"
        ],
        totalPurchases
    );


    setText(
        [
            "purchaseValue",
            "totalPurchaseValue"
        ],
        "₹" +
        formatAmount(
            totalValue
        )
    );


    setText(
        [
            "purchaseGST",
            "totalPurchaseGST"
        ],
        "₹" +
        formatAmount(
            totalGST
        )
    );

}


/* ============================================================
   VIEW PURCHASE
   ============================================================ */

async function viewPurchase(
    purchaseId
) {

    const purchase =
        purchaseCache.find(
            item =>
                item.id ===
                purchaseId
        );


    if (!purchase) {

        showMessage(
            "Purchase not found.",
            "error"
        );

        return;

    }


    /*
     * If a modal already exists in HTML,
     * populate it.
     */

    const modal =
        el(
            "purchaseViewModal"
        );


    if (modal) {

        const content =
            modal.querySelector(
                "[data-purchase-content]"
            );


        if (content) {

            content.innerHTML = `

                <div class="purchase-view">

                    <h3>
                        ${escapeHTML(
                            purchase.invoiceNumber
                        )}
                    </h3>

                    <p>
                        Supplier:
                        <strong>
                            ${escapeHTML(
                                purchase.supplierName
                            )}
                        </strong>
                    </p>

                    <p>
                        Total:
                        <strong>
                            ₹${formatAmount(
                                purchase.totalAmount
                            )}
                        </strong>
                    </p>

                    <p>
                        Status:
                        ${escapeHTML(
                            purchase.status ||
                            "Posted"
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


    /*
     * Safe fallback.
     */

    showMessage(
        `Purchase ${purchase.invoiceNumber} — ₹${formatAmount(
            purchase.totalAmount
        )}`,
        "info"
    );

}


/* ============================================================
   CLEAR PURCHASE FORM
   ============================================================ */

async function clearPurchaseForm() {

    editingPurchaseId =
        null;


    const form =
        el(
            "purchaseForm"
        );


    if (form) {

        form.reset();

    }


    const invoiceNumber =
        await generatePurchaseNumber();


    setValue(
        [
            "invoiceNumber",
            "purchaseNumber"
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
            "purchaseDate"
        ],
        today
    );


    calculatePurchaseTotal();

}


/* ============================================================
   ADD PURCHASE ROW
   ============================================================ */

function addPurchaseRow() {

    const container =
        el(
            "purchaseItems"
        );


    if (!container) {

        return;

    }


    const row =
        document.createElement(
            "div"
        );


    row.className =
        "purchase-row";


    row.dataset.purchaseRow =
        "true";


    row.innerHTML = `

        <div>

            <select
                data-purchase-material
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
                onclick="removePurchaseRow(this)"
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
            "[data-purchase-material]"
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
                    calculatePurchaseRow(
                        row
                    )
            );

        }
    );


    calculatePurchaseRow(
        row
    );

}


/* ============================================================
   REMOVE PURCHASE ROW
   ============================================================ */

function removePurchaseRow(
    button
) {

    const row =
        button.closest(
            "[data-purchase-row]"
        );


    if (row) {

        row.remove();

    }


    calculatePurchaseTotal();

}


/* ============================================================
   TEXT HELPER
   ============================================================ */

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


/* ============================================================
   MESSAGE
   ============================================================ */

function showMessage(
    message,
    type = "info"
) {

    let box =
        el(
            "mmvPurchaseMessage"
        );


    if (!box) {

        box =
            document.createElement(
                "div"
            );


        box.id =
            "mmvPurchaseMessage";


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
   FIREBASE ERROR MESSAGE
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
         * Load master data first.
         */

        await Promise.all([

            loadPurchaseSuppliers(),

            loadPurchaseMaterials()

        ]);


        /*
         * New purchase number.
         */

        const invoice =
            await generatePurchaseNumber();


        setValue(
            [
                "invoiceNumber",
                "purchaseNumber"
            ],
            invoice
        );


        /*
         * Today's date.
         */

        const today =
            new Date()
                .toISOString()
                .split("T")[0];


        setValue(
            [
                "invoiceDate",
                "purchaseDate"
            ],
            today
        );


        /*
         * Search.
         */

        const search =
            el(
                "purchaseSearch"
            );


        if (search) {

            search.addEventListener(
                "input",
                () =>
                    renderPurchases(
                        purchaseCache
                    )
            );

        }


        /*
         * Existing purchase rows.
         */

        document
            .querySelectorAll(
                "[data-purchase-row]"
            )
            .forEach(
                row => {

                    const select =
                        row.querySelector(
                            "[data-purchase-material]"
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
                                    calculatePurchaseRow(
                                        row
                                    )
                            );

                        }
                    );

                }
            );


        calculatePurchaseTotal();


        /*
         * Load purchase history.
         */

        await loadPurchases();

    }
);


/* ============================================================
   GLOBAL API
   ============================================================ */

window.MMVPurchase = {

    savePurchase,

    loadPurchases,

    loadPurchaseSuppliers,

    loadPurchaseMaterials,

    generatePurchaseNumber,

    calculatePurchaseTotal,

    calculatePurchaseRow,

    addPurchaseRow,

    removePurchaseRow,

    clearPurchaseForm,

    viewPurchase

};


window.savePurchase =
    savePurchase;

window.loadPurchases =
    loadPurchases;

window.generatePurchaseNumber =
    generatePurchaseNumber;

window.calculatePurchaseTotal =
    calculatePurchaseTotal;

window.calculatePurchaseRow =
    calculatePurchaseRow;

window.addPurchaseRow =
    addPurchaseRow;

window.removePurchaseRow =
    removePurchaseRow;

window.clearPurchaseForm =
    clearPurchaseForm;

window.viewPurchase =
    viewPurchase;


console.info(
    "%cMMV Purchase V2%c ready",
    "font-weight:800;color:#0a3d91;",
    "color:inherit;"
);
