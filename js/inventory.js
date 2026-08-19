/* ============================================================
   MMV TRADERS ERP V2
   INVENTORY / MATERIAL MASTER SERVICE
   Production Firebase + Firestore
   ============================================================ */

"use strict";

import {
    collection,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
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
   CONFIGURATION
   ============================================================ */

const MATERIALS_COLLECTION = "materials";

const STOCK_COLLECTION = "inventory";

const DEFAULT_STATUS = "Active";

const DEFAULT_GST = 18;

const PAGE_SIZE = 50;

let materialCache = [];

let inventoryCache = [];

let editingMaterialId = null;


/* ============================================================
   HELPERS
   ============================================================ */

function getElement(id) {

    return document.getElementById(id);

}


function getValue(...ids) {

    for (const id of ids) {

        const element =
            getElement(id);

        if (element) {

            return String(
                element.value ?? ""
            ).trim();

        }

    }

    return "";

}


function setValue(
    ids,
    value
) {

    if (!Array.isArray(ids)) {

        ids = [ids];

    }


    for (const id of ids) {

        const element =
            getElement(id);

        if (element) {

            element.value =
                value ?? "";

            return;

        }

    }

}


function numberValue(value) {

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : 0;

}


function clean(value) {

    return String(
        value ?? ""
    ).trim();

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


function formatQuantity(value) {

    return numberValue(
        value
    ).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3
        }
    );

}


/* ============================================================
   CURRENT USER
   ============================================================ */

function currentUserId() {

    return auth?.currentUser?.uid || null;

}


/* ============================================================
   MATERIAL CODE
   ============================================================ */

async function generateMaterialCode() {

    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        MATERIALS_COLLECTION
                    ),
                    limit(1000)
                )
            );


        let highest =
            0;


        snapshot.forEach(
            item => {

                const data =
                    item.data();


                const code =
                    clean(
                        data.materialCode
                    );


                const match =
                    code.match(
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
            "MAT-" +
            String(
                highest + 1
            ).padStart(
                6,
                "0"
            )
        );

    }
    catch(error) {

        console.error(
            "Material code generation error:",
            error
        );


        return (
            "MAT-" +
            Date.now()
                .toString()
                .slice(-6)
        );

    }

}


/* ============================================================
   MATERIAL DATA
   ============================================================ */

function getMaterialFormData() {

    const name =
        getValue(
            "materialName",
            "itemName",
            "productName"
        );


    const materialCode =
        getValue(
            "materialCode",
            "itemCode",
            "productCode"
        );


    const category =
        getValue(
            "category",
            "materialCategory"
        );


    const unit =
        getValue(
            "unit",
            "uom"
        ) || "PCS";


    const hsn =
        getValue(
            "hsn",
            "hsnCode"
        );


    const gst =
        numberValue(
            getValue(
                "gst",
                "gstRate",
                "taxRate"
            ) || DEFAULT_GST
        );


    const purchaseRate =
        numberValue(
            getValue(
                "purchaseRate",
                "buyRate",
                "costPrice"
            )
        );


    const sellingRate =
        numberValue(
            getValue(
                "sellingRate",
                "saleRate",
                "salesRate"
            )
        );


    const openingStock =
        numberValue(
            getValue(
                "openingStock",
                "openingQty",
                "quantity"
            )
        );


    const reorderLevel =
        numberValue(
            getValue(
                "reorderLevel",
                "minimumStock",
                "minStock"
            )
        );


    const status =
        getValue(
            "status",
            "materialStatus"
        ) || DEFAULT_STATUS;


    return {

        materialCode,

        name,

        category,

        unit,

        hsn,

        gst,

        purchaseRate,

        sellingRate,

        openingStock,

        reorderLevel,

        status

    };

}


/* ============================================================
   VALIDATION
   ============================================================ */

function validateMaterial(data) {

    if (!data.name) {

        throw new Error(
            "Material name is required."
        );

    }


    if (
        data.purchaseRate < 0
    ) {

        throw new Error(
            "Purchase rate cannot be negative."
        );

    }


    if (
        data.sellingRate < 0
    ) {

        throw new Error(
            "Selling rate cannot be negative."
        );

    }


    if (
        data.openingStock < 0
    ) {

        throw new Error(
            "Opening stock cannot be negative."
        );

    }


    if (
        data.reorderLevel < 0
    ) {

        throw new Error(
            "Reorder level cannot be negative."
        );

    }


    if (
        data.gst < 0 ||
        data.gst > 100
    ) {

        throw new Error(
            "GST rate must be between 0 and 100."
        );

    }

}


/* ============================================================
   DUPLICATE MATERIAL CHECK
   ============================================================ */

async function findMaterialByCode(
    materialCode,
    excludeId = null
) {

    if (!materialCode) {

        return null;

    }


    const q =
        query(
            collection(
                db,
                MATERIALS_COLLECTION
            ),
            where(
                "materialCode",
                "==",
                materialCode
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
            item.id === excludeId
        ) {

            continue;

        }


        return {

            id: item.id,

            ...item.data()

        };

    }


    return null;

}


/* ============================================================
   DUPLICATE NAME CHECK
   ============================================================ */

async function findMaterialByName(
    name,
    excludeId = null
) {

    if (!name) {

        return null;

    }


    const q =
        query(
            collection(
                db,
                MATERIALS_COLLECTION
            ),
            where(
                "name",
                "==",
                name
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
            item.id === excludeId
        ) {

            continue;

        }


        return {

            id: item.id,

            ...item.data()

        };

    }


    return null;

}


/* ============================================================
   CREATE MATERIAL
   ============================================================ */

async function createMaterial() {

    try {

        const data =
            getMaterialFormData();


        validateMaterial(
            data
        );


        if (
            !data.materialCode
        ) {

            data.materialCode =
                await generateMaterialCode();

        }


        const duplicateCode =
            await findMaterialByCode(
                data.materialCode
            );


        if (
            duplicateCode
        ) {

            throw new Error(
                "Material code already exists."
            );

        }


        const duplicateName =
            await findMaterialByName(
                data.name
            );


        if (
            duplicateName
        ) {

            throw new Error(
                "Material with this name already exists."
            );

        }


        const userId =
            currentUserId();


        const materialRef =
            await addDoc(
                collection(
                    db,
                    MATERIALS_COLLECTION
                ),
                {

                    materialCode:
                        data.materialCode,

                    name:
                        data.name,

                    category:
                        data.category,

                    unit:
                        data.unit,

                    hsn:
                        data.hsn,

                    gst:
                        data.gst,

                    purchaseRate:
                        data.purchaseRate,

                    sellingRate:
                        data.sellingRate,

                    openingStock:
                        data.openingStock,

                    currentStock:
                        data.openingStock,

                    reorderLevel:
                        data.reorderLevel,

                    status:
                        data.status,

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
         * Create matching inventory document.
         */

        await addDoc(
            collection(
                db,
                STOCK_COLLECTION
            ),
            {

                materialId:
                    materialRef.id,

                materialCode:
                    data.materialCode,

                materialName:
                    data.name,

                unit:
                    data.unit,

                quantity:
                    data.openingStock,

                reservedQuantity:
                    0,

                availableQuantity:
                    data.openingStock,

                reorderLevel:
                    data.reorderLevel,

                purchaseRate:
                    data.purchaseRate,

                stockValue:
                    data.openingStock *
                    data.purchaseRate,

                status:
                    data.status,

                createdAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp()

            }
        );


        showMessage(
            "Material created successfully.",
            "success"
        );


        clearMaterialForm();

        await loadInventory();

        return materialRef.id;

    }
    catch(error) {

        console.error(
            "Create material error:",
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
   UPDATE MATERIAL
   ============================================================ */

async function updateMaterial(
    materialId,
    data = null
) {

    try {

        if (!data) {

            data =
                getMaterialFormData();

        }


        validateMaterial(
            data
        );


        const duplicateCode =
            await findMaterialByCode(
                data.materialCode,
                materialId
            );


        if (
            duplicateCode
        ) {

            throw new Error(
                "Another material already uses this code."
            );

        }


        const duplicateName =
            await findMaterialByName(
                data.name,
                materialId
            );


        if (
            duplicateName
        ) {

            throw new Error(
                "Another material already uses this name."
            );

        }


        const reference =
            doc(
                db,
                MATERIALS_COLLECTION,
                materialId
            );


        await updateDoc(
            reference,
            {

                materialCode:
                    data.materialCode,

                name:
                    data.name,

                category:
                    data.category,

                unit:
                    data.unit,

                hsn:
                    data.hsn,

                gst:
                    data.gst,

                purchaseRate:
                    data.purchaseRate,

                sellingRate:
                    data.sellingRate,

                reorderLevel:
                    data.reorderLevel,

                status:
                    data.status,

                updatedAt:
                    serverTimestamp(),

                updatedBy:
                    currentUserId()

            }
        );


        /*
         * Keep inventory master synchronized.
         */

        const stockQuery =
            query(
                collection(
                    db,
                    STOCK_COLLECTION
                ),
                where(
                    "materialId",
                    "==",
                    materialId
                ),
                limit(1)
            );


        const stockSnapshot =
            await getDocs(
                stockQuery
            );


        if (
            !stockSnapshot.empty
        ) {

            const stockDoc =
                stockSnapshot.docs[0];


            await updateDoc(
                stockDoc.ref,
                {

                    materialCode:
                        data.materialCode,

                    materialName:
                        data.name,

                    unit:
                        data.unit,

                    reorderLevel:
                        data.reorderLevel,

                    purchaseRate:
                        data.purchaseRate,

                    status:
                        data.status,

                    updatedAt:
                        serverTimestamp()

                }
            );

        }


        showMessage(
            "Material updated successfully.",
            "success"
        );


        clearMaterialForm();

        await loadInventory();

        return true;

    }
    catch(error) {

        console.error(
            "Update material error:",
            error
        );


        showMessage(
            getErrorMessage(error),
            "error"
        );


        return false;

    }

}


/* ============================================================
   LOAD MATERIALS
   ============================================================ */

async function loadMaterials() {

    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        MATERIALS_COLLECTION
                    ),
                    limit(1000)
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
            (a,b) =>
                String(
                    a.name || ""
                ).localeCompare(
                    String(
                        b.name || ""
                    )
                )
        );


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
   LOAD INVENTORY
   ============================================================ */

async function loadInventory() {

    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        STOCK_COLLECTION
                    ),
                    limit(1000)
                )
            );


        inventoryCache =
            snapshot.docs.map(
                item => ({

                    id:
                        item.id,

                    ...item.data()

                })
            );


        renderInventory(
            inventoryCache
        );


        updateInventorySummary(
            inventoryCache
        );


        return inventoryCache;

    }
    catch(error) {

        console.error(
            "Load inventory error:",
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
   RENDER INVENTORY
   ============================================================ */

function renderInventory(
    records
) {

    const table =
        getElement(
            "inventoryTable"
        );


    const mobile =
        getElement(
            "mobileInventory"
        );


    const search =
        getValue(
            "inventorySearch",
            "materialSearch",
            "search"
        )
        .toLowerCase();


    const category =
        getValue(
            "categoryFilter",
            "inventoryCategory"
        );


    const filtered =
        records.filter(
            item => {

                const searchable =
                    [

                        item.materialCode,

                        item.materialName,

                        item.category,

                        item.hsn

                    ]
                    .join(" ")
                    .toLowerCase();


                const searchMatch =
                    !search ||
                    searchable.includes(
                        search
                    );


                const categoryMatch =
                    !category ||
                    category === "All" ||
                    item.category === category;


                return (
                    searchMatch &&
                    categoryMatch
                );

            }
        );


    if (table) {

        if (
            filtered.length === 0
        ) {

            table.innerHTML = `

                <tr>

                    <td colspan="100%">

                        <div class="empty-state">

                            <strong>
                                No inventory found
                            </strong>

                            <span>
                                Add a material to start inventory management.
                            </span>

                        </div>

                    </td>

                </tr>

            `;

        }
        else {

            table.innerHTML =
                filtered.map(
                    item =>
                        inventoryRow(
                            item
                        )
                )
                .join("");

        }

    }


    if (mobile) {

        mobile.innerHTML =
            filtered.map(
                item =>
                    inventoryCard(
                        item
                    )
            )
            .join("");

    }

}


/* ============================================================
   DESKTOP ROW
   ============================================================ */

function inventoryRow(
    item
) {

    const quantity =
        numberValue(
            item.quantity
        );


    const reorder =
        numberValue(
            item.reorderLevel
        );


    let stockStatus =
        "In Stock";


    if (
        quantity <= 0
    ) {

        stockStatus =
            "Out of Stock";

    }
    else if (
        quantity <= reorder
    ) {

        stockStatus =
            "Low Stock";

    }


    return `

        <tr>

            <td>
                ${escapeHTML(
                    item.materialCode
                )}
            </td>

            <td>

                <strong>
                    ${escapeHTML(
                        item.materialName
                    )}
                </strong>

            </td>

            <td>
                ${escapeHTML(
                    item.category || "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    item.unit || "PCS"
                )}
            </td>

            <td>
                ${formatQuantity(
                    quantity
                )}
            </td>

            <td>
                ₹${formatAmount(
                    item.purchaseRate
                )}
            </td>

            <td>
                ₹${formatAmount(
                    item.stockValue
                )}
            </td>

            <td>

                <span
                    class="${
                        stockStatus === "In Stock"
                            ? "active-badge"
                            : stockStatus === "Low Stock"
                                ? "warning-badge"
                                : "inactive-badge"
                    }"
                >
                    ${stockStatus}
                </span>

            </td>

            <td>

                <div class="action-buttons">

                    <button
                        type="button"
                        onclick="editMaterial('${escapeHTML(item.materialId)}')"
                    >
                        Edit
                    </button>

                    <button
                        type="button"
                        onclick="viewStockHistory('${escapeHTML(item.materialId)}')"
                    >
                        History
                    </button>

                </div>

            </td>

        </tr>

    `;

}


/* ============================================================
   MOBILE CARD
   ============================================================ */

function inventoryCard(
    item
) {

    const quantity =
        numberValue(
            item.quantity
        );


    const reorder =
        numberValue(
            item.reorderLevel
        );


    const status =
        quantity <= 0
            ? "Out of Stock"
            : quantity <= reorder
                ? "Low Stock"
                : "In Stock";


    return `

        <article class="inventory-card">

            <div class="inventory-card-top">

                <div>

                    <strong>
                        ${escapeHTML(
                            item.materialName
                        )}
                    </strong>

                    <small>
                        ${escapeHTML(
                            item.materialCode
                        )}
                    </small>

                </div>

                <span>
                    ${status}
                </span>

            </div>


            <div class="inventory-card-grid">

                <div>

                    <small>
                        Stock
                    </small>

                    <strong>
                        ${formatQuantity(
                            quantity
                        )}
                        ${escapeHTML(
                            item.unit || "PCS"
                        )}
                    </strong>

                </div>


                <div>

                    <small>
                        Purchase Rate
                    </small>

                    <strong>
                        ₹${formatAmount(
                            item.purchaseRate
                        )}
                    </strong>

                </div>


                <div>

                    <small>
                        Stock Value
                    </small>

                    <strong>
                        ₹${formatAmount(
                            item.stockValue
                        )}
                    </strong>

                </div>


                <div>

                    <small>
                        Reorder Level
                    </small>

                    <strong>
                        ${formatQuantity(
                            reorder
                        )}
                    </strong>

                </div>

            </div>


            <div class="inventory-card-actions">

                <button
                    type="button"
                    onclick="editMaterial('${escapeHTML(item.materialId)}')"
                >
                    Edit
                </button>

                <button
                    type="button"
                    onclick="viewStockHistory('${escapeHTML(item.materialId)}')"
                >
                    History
                </button>

            </div>

        </article>

    `;

}


/* ============================================================
   INVENTORY SUMMARY
   ============================================================ */

function updateInventorySummary(
    records
) {

    const totalItems =
        records.length;


    const totalQuantity =
        records.reduce(
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
        records.reduce(
            (
                total,
                item
            ) =>
                total +
                numberValue(
                    item.stockValue
                ),
            0
        );


    const lowStock =
        records.filter(
            item =>
                numberValue(
                    item.quantity
                ) <=
                numberValue(
                    item.reorderLevel
                )
        ).length;


    setSummary(
        [
            "totalItems",
            "totalMaterials",
            "inventoryItems"
        ],
        totalItems
    );


    setSummary(
        [
            "totalQuantity",
            "stockQuantity"
        ],
        formatQuantity(
            totalQuantity
        )
    );


    setSummary(
        [
            "stockValue",
            "totalStockValue"
        ],
        "₹" +
        formatAmount(
            stockValue
        )
    );


    setSummary(
        [
            "lowStock",
            "lowStockItems"
        ],
        lowStock
    );

}


/* ============================================================
   SUMMARY HELPER
   ============================================================ */

function setSummary(
    ids,
    value
) {

    for (
        const id of ids
    ) {

        const node =
            getElement(id);


        if (node) {

            node.textContent =
                value;

            return;

        }

    }

}


/* ============================================================
   EDIT MATERIAL
   ============================================================ */

async function editMaterial(
    materialId
) {

    try {

        const reference =
            doc(
                db,
                MATERIALS_COLLECTION,
                materialId
            );


        const snapshot =
            await getDoc(
                reference
            );


        if (
            !snapshot.exists()
        ) {

            throw new Error(
                "Material not found."
            );

        }


        const data =
            snapshot.data();


        editingMaterialId =
            materialId;


        setValue(
            [
                "materialCode",
                "itemCode",
                "productCode"
            ],
            data.materialCode
        );


        setValue(
            [
                "materialName",
                "itemName",
                "productName"
            ],
            data.name
        );


        setValue(
            [
                "category",
                "materialCategory"
            ],
            data.category
        );


        setValue(
            [
                "unit",
                "uom"
            ],
            data.unit
        );


        setValue(
            [
                "hsn",
                "hsnCode"
            ],
            data.hsn
        );


        setValue(
            [
                "gst",
                "gstRate",
                "taxRate"
            ],
            data.gst
        );


        setValue(
            [
                "purchaseRate",
                "buyRate",
                "costPrice"
            ],
            data.purchaseRate
        );


        setValue(
            [
                "sellingRate",
                "saleRate",
                "salesRate"
            ],
            data.sellingRate
        );


        setValue(
            [
                "reorderLevel",
                "minimumStock",
                "minStock"
            ],
            data.reorderLevel
        );


        setValue(
            [
                "status",
                "materialStatus"
            ],
            data.status
        );


        const title =
            getElement(
                "materialFormTitle"
            );


        if (title) {

            title.textContent =
                "Edit Material";

        }


        const form =
            getElement(
                "materialForm"
            );


        if (form) {

            form.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }

    }
    catch(error) {

        console.error(
            "Edit material error:",
            error
        );


        showMessage(
            getErrorMessage(error),
            "error"
        );

    }

}


/* ============================================================
   SAVE MATERIAL
   ============================================================ */

async function saveMaterial() {

    if (
        editingMaterialId
    ) {

        return updateMaterial(
            editingMaterialId
        );

    }


    return createMaterial();

}


/* ============================================================
   CLEAR FORM
   ============================================================ */

function clearMaterialForm() {

    editingMaterialId =
        null;


    const form =
        getElement(
            "materialForm"
        );


    if (form) {

        form.reset();

    }


    setValue(
        [
            "gst",
            "gstRate",
            "taxRate"
        ],
        DEFAULT_GST
    );


    setValue(
        [
            "unit",
            "uom"
        ],
        "PCS"
    );


    setValue(
        [
            "status",
            "materialStatus"
        ],
        DEFAULT_STATUS
    );


    const title =
        getElement(
            "materialFormTitle"
        );


    if (title) {

        title.textContent =
            "Add Material";

    }


    const code =
        generateMaterialCode();


    code.then(
        newCode => {

            setValue(
                [
                    "materialCode",
                    "itemCode",
                    "productCode"
                ],
                newCode
            );

        }
    );

}


/* ============================================================
   STOCK MOVEMENT
   ============================================================ */

async function updateStock(
    materialId,
    quantityChange,
    movementType,
    reference = {}
) {

    const change =
        numberValue(
            quantityChange
        );


    if (
        !materialId
    ) {

        throw new Error(
            "Material ID is required."
        );

    }


    if (
        !change ||
        change < 0
    ) {

        throw new Error(
            "Stock quantity must be greater than zero."
        );

    }


    const stockQuery =
        query(
            collection(
                db,
                STOCK_COLLECTION
            ),
            where(
                "materialId",
                "==",
                materialId
            ),
            limit(1)
        );


    const stockSnapshot =
        await getDocs(
            stockQuery
        );


    if (
        stockSnapshot.empty
    ) {

        throw new Error(
            "Inventory record not found."
        );

    }


    const stockReference =
        stockSnapshot.docs[0].ref;


    const materialReference =
        doc(
            db,
            MATERIALS_COLLECTION,
            materialId
        );


    await runTransaction(
        db,
        async transaction => {

            const stockSnapshot =
                await transaction.get(
                    stockReference
                );


            const materialSnapshot =
                await transaction.get(
                    materialReference
                );


            if (
                !stockSnapshot.exists()
            ) {

                throw new Error(
                    "Inventory record not found."
                );

            }


            const stock =
                stockSnapshot.data();


            const material =
                materialSnapshot.exists()
                    ? materialSnapshot.data()
                    : {};


            const oldQuantity =
                numberValue(
                    stock.quantity
                );


            let newQuantity =
                oldQuantity;


            if (
                movementType === "IN"
            ) {

                newQuantity +=
                    change;

            }
            else if (
                movementType === "OUT"
            ) {

                if (
                    oldQuantity <
                    change
                ) {

                    throw new Error(
                        "Insufficient stock."
                    );

                }


                newQuantity -=
                    change;

            }
            else {

                throw new Error(
                    "Invalid stock movement type."
                );

            }


            const purchaseRate =
                numberValue(
                    stock.purchaseRate ||
                    material.purchaseRate
                );


            transaction.update(
                stockReference,
                {

                    quantity:
                        newQuantity,

                    availableQuantity:
                        newQuantity -
                        numberValue(
                            stock.reservedQuantity
                        ),

                    stockValue:
                        newQuantity *
                        purchaseRate,

                    lastMovementType:
                        movementType,

                    lastMovementQuantity:
                        change,

                    lastReference:
                        reference.referenceNumber ||
                        null,

                    updatedAt:
                        serverTimestamp()

                }
            );


            transaction.update(
                materialReference,
                {

                    currentStock:
                        newQuantity,

                    updatedAt:
                        serverTimestamp()

                }
            );

        }
    );


    showMessage(
        `Stock ${movementType === "IN" ? "added" : "deducted"} successfully.`,
        "success"
    );


    await loadInventory();

}


/* ============================================================
   STOCK IN
   ============================================================ */

async function stockIn(
    materialId,
    quantity,
    reference = {}
) {

    return updateStock(
        materialId,
        quantity,
        "IN",
        reference
    );

}


/* ============================================================
   STOCK OUT
   ============================================================ */

async function stockOut(
    materialId,
    quantity,
    reference = {}
) {

    return updateStock(
        materialId,
        quantity,
        "OUT",
        reference
    );

}


/* ============================================================
   STOCK HISTORY
   ============================================================ */

async function viewStockHistory(
    materialId
) {

    /*
     * Transaction history collection will be connected
     * when Purchase / Sales modules are integrated.
     */

    console.info(
        "Stock history requested:",
        materialId
    );


    showMessage(
        "Stock history will be available with Purchase & Sales integration.",
        "info"
    );

}


/* ============================================================
   SEARCH
   ============================================================ */

function filterInventory() {

    renderInventory(
        inventoryCache
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
        getElement(
            "mmvInventoryMessage"
        );


    if (!box) {

        box =
            document.createElement(
                "div"
            );


        box.id =
            "mmvInventoryMessage";


        Object.assign(
            box.style,
            {

                position: "fixed",

                right: "18px",

                bottom: "18px",

                zIndex: "99999",

                maxWidth: "380px",

                padding: "14px 17px",

                borderRadius: "12px",

                fontSize: "13px",

                fontWeight: "700",

                boxShadow:
                    "0 14px 35px rgba(0,0,0,.15)"

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
            error.code || ""
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

        return "Firestore index is required for this operation.";

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
        "Unable to complete the operation."
    );

}


/* ============================================================
   SEARCH EVENTS
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const search =
            getElement(
                "inventorySearch"
            );


        if (search) {

            search.addEventListener(
                "input",
                filterInventory
            );

        }


        const materialSearch =
            getElement(
                "materialSearch"
            );


        if (
            materialSearch &&
            materialSearch !== search
        ) {

            materialSearch.addEventListener(
                "input",
                filterInventory
            );

        }


        const category =
            getElement(
                "categoryFilter"
            );


        if (category) {

            category.addEventListener(
                "change",
                filterInventory
            );

        }


        await loadInventory();


        /*
         * Generate first material code
         * for a new record.
         */

        if (
            !editingMaterialId
        ) {

            const code =
                await generateMaterialCode();


            setValue(
                [
                    "materialCode",
                    "itemCode",
                    "productCode"
                ],
                code
            );

        }

    }
);


/* ============================================================
   GLOBAL API
   ============================================================ */

window.MMVInventory = {

    createMaterial,

    updateMaterial,

    saveMaterial,

    editMaterial,

    clearMaterialForm,

    loadMaterials,

    loadInventory,

    renderInventory,

    stockIn,

    stockOut,

    updateStock,

    viewStockHistory,

    generateMaterialCode

};


/*
 * Compatibility with existing HTML.
 */

window.createMaterial =
    createMaterial;

window.updateMaterial =
    updateMaterial;

window.saveMaterial =
    saveMaterial;

window.editMaterial =
    editMaterial;

window.clearMaterialForm =
    clearMaterialForm;

window.stockIn =
    stockIn;

window.stockOut =
    stockOut;

window.viewStockHistory =
    viewStockHistory;


/* ============================================================
   READY
   ============================================================ */

console.info(
    "%cMMV Inventory V2%c ready",
    "font-weight:800;color:#0a3d91;",
    "color:inherit;"
);
