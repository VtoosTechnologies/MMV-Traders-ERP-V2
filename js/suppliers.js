/* ============================================================
   MMV TRADERS ERP V2
   SUPPLIER MASTER
   Production Firestore Integration
   ============================================================ */

"use strict";

import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    doc,
    addDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
    db,
    auth
} from "./firebase.js";


/* ============================================================
   CONFIG
   ============================================================ */

const COLLECTION_NAME = "suppliers";

const DEFAULT_STATE = "Tamil Nadu";

const DEFAULT_STATUS = "Active";

let editingSupplierId = null;

let supplierCache = [];


/* ============================================================
   DOM HELPERS
   ============================================================ */

function el(id) {

    return document.getElementById(id);

}


function value(id) {

    const element = el(id);

    return element
        ? String(element.value || "").trim()
        : "";

}


function setValue(
    id,
    newValue
) {

    const element = el(id);

    if (element) {

        element.value =
            newValue ?? "";

    }

}


function checked(id) {

    const element = el(id);

    return element
        ? Boolean(element.checked)
        : false;

}


/* ============================================================
   SAFE TEXT
   ============================================================ */

function escapeHTML(
    input
) {

    return String(
        input ?? ""
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
   NUMBER
   ============================================================ */

function numberValue(
    input
) {

    const number =
        Number(
            input
        );


    return Number.isFinite(
        number
    )
        ? number
        : 0;

}


/* ============================================================
   NORMALIZE MOBILE
   ============================================================ */

function normalizeMobile(
    mobile
) {

    return String(
        mobile ?? ""
    )
    .replace(
        /\D/g,
        ""
    )
    .slice(
        -10
    );

}


/* ============================================================
   VALIDATE MOBILE
   ============================================================ */

function isValidMobile(
    mobile
) {

    return /^[6-9]\d{9}$/.test(
        normalizeMobile(
            mobile
        )
    );

}


/* ============================================================
   SUPPLIER CODE
   ============================================================ */

async function generateSupplierCode() {

    const prefix =
        "SUP-";


    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    COLLECTION_NAME
                )
            );


        let highest =
            0;


        snapshot.forEach(
            function(item) {

                const data =
                    item.data();


                const code =
                    String(
                        data.supplierCode || ""
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


        const next =
            highest + 1;


        return (
            prefix +
            String(
                next
            )
            .padStart(
                6,
                "0"
            )
        );

    }
    catch(error) {

        console.error(
            "Supplier code generation error:",
            error
        );


        return (
            prefix +
            Date.now()
                .toString()
                .slice(
                    -6
                )
        );

    }

}


/* ============================================================
   PREPARE NEW CODE
   ============================================================ */

async function prepareNewSupplierCode() {

    if (
        editingSupplierId
    ) {

        return;

    }


    const code =
        await generateSupplierCode();


    setValue(
        "supplierCode",
        code
    );

}


/* ============================================================
   FORM DATA
   ============================================================ */

function getFormData() {

    const supplierName =
        value(
            "supplierName"
        );


    const mobile =
        normalizeMobile(
            value(
                "mobile"
            )
        );


    const alternateMobile =
        normalizeMobile(
            value(
                "alternateMobile"
            )
        );


    const email =
        value(
            "email"
        );


    const address =
        value(
            "address"
        );


    const city =
        value(
            "city"
        );


    const state =
        value(
            "state"
        ) ||
        DEFAULT_STATE;


    const gstNumber =
        value(
            "gstNumber"
        )
        .toUpperCase();


    const outstanding =
        numberValue(
            value(
                "outstanding"
            )
        );


    const creditDays =
        numberValue(
            value(
                "creditDays"
            )
        );


    const status =
        checked(
            "active"
        )
            ? DEFAULT_STATUS
            : "Inactive";


    return {

        supplierCode:
            value(
                "supplierCode"
            ),

        supplierName,

        mobile,

        alternateMobile,

        email,

        address,

        city,

        state,

        gstNumber,

        outstanding,

        creditDays,

        status

    };

}


/* ============================================================
   VALIDATION
   ============================================================ */

function validateForm(
    data
) {

    if (
        !data.supplierName
    ) {

        throw new Error(
            "Supplier name is required."
        );

    }


    if (
        data.mobile &&
        !isValidMobile(
            data.mobile
        )
    ) {

        throw new Error(
            "Please enter a valid mobile number."
        );

    }


    if (
        data.alternateMobile &&
        !isValidMobile(
            data.alternateMobile
        )
    ) {

        throw new Error(
            "Please enter a valid alternate mobile number."
        );

    }


    if (
        data.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(
                data.email
            )
    ) {

        throw new Error(
            "Please enter a valid email address."
        );

    }


    if (
        data.outstanding < 0
    ) {

        throw new Error(
            "Outstanding amount cannot be negative."
        );

    }


    if (
        data.creditDays < 0
    ) {

        throw new Error(
            "Credit days cannot be negative."
        );

    }

}


/* ============================================================
   DUPLICATE CHECK
   ============================================================ */

async function checkDuplicateMobile(
    mobile,
    excludeId = null
) {

    if (!mobile) {

        return null;

    }


    const q =
        query(

            collection(
                db,
                COLLECTION_NAME
            ),

            where(
                "mobile",
                "==",
                mobile
            ),

            limit(
                5
            )

        );


    const snapshot =
        await getDocs(
            q
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


        return {

            id:
                item.id,

            ...item.data()

        };

    }


    return null;

}


/* ============================================================
   SAVE SUPPLIER
   ============================================================ */

async function saveSupplier() {

    const form =
        el(
            "supplierForm"
        );


    if (
        form &&
        !form.checkValidity()
    ) {

        form.reportValidity();

        return;

    }


    try {

        const data =
            getFormData();


        validateForm(
            data
        );


        const duplicate =
            await checkDuplicateMobile(

                data.mobile,

                editingSupplierId

            );


        if (
            duplicate
        ) {

            throw new Error(
                "A supplier with this mobile number already exists."
            );

        }


        const currentUser =
            auth.currentUser;


        /*
         * CREATE
         */

        if (
            !editingSupplierId
        ) {

            if (
                !data.supplierCode
            ) {

                data.supplierCode =
                    await generateSupplierCode();

            }


            const payload = {

                ...data,

                createdAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp(),

                createdBy:
                    currentUser
                        ? currentUser.uid
                        : null,

                updatedBy:
                    currentUser
                        ? currentUser.uid
                        : null

            };


            await addDoc(

                collection(
                    db,
                    COLLECTION_NAME
                ),

                payload

            );


            showMessage(
                "Supplier saved successfully.",
                "success"
            );

        }

        /*
         * UPDATE
         */

        else {

            const reference =
                doc(

                    db,

                    COLLECTION_NAME,

                    editingSupplierId

                );


            await updateDoc(

                reference,

                {

                    ...data,

                    updatedAt:
                        serverTimestamp(),

                    updatedBy:
                        currentUser
                            ? currentUser.uid
                            : null

                }

            );


            showMessage(
                "Supplier updated successfully.",
                "success"
            );

        }


        clearSupplierForm();

        await renderSuppliers();

    }
    catch(error) {

        console.error(
            "Save supplier error:",
            error
        );


        showMessage(
            getErrorMessage(
                error
            ),
            "error"
        );

    }

}


/* ============================================================
   LOAD SUPPLIERS
   ============================================================ */

async function loadSuppliers() {

    try {

        const q =
            query(

                collection(
                    db,
                    COLLECTION_NAME
                ),

                orderBy(
                    "createdAt",
                    "desc"
                ),

                limit(
                    500
                )

            );


        const snapshot =
            await getDocs(
                q
            );


        supplierCache =
            snapshot.docs.map(
                function(item) {

                    return {

                        id:
                            item.id,

                        ...item.data()

                    };

                }
            );


        return supplierCache;

    }
    catch(error) {

        /*
         * Fallback for old records
         * without createdAt.
         */

        console.warn(
            "Ordered supplier query failed. Using fallback.",
            error
        );


        try {

            const snapshot =
                await getDocs(
                    query(

                        collection(
                            db,
                            COLLECTION_NAME
                        ),

                        limit(
                            500
                        )

                    )
                );


            supplierCache =
                snapshot.docs.map(
                    function(item) {

                        return {

                            id:
                                item.id,

                            ...item.data()

                        };

                    }
                );


            supplierCache.sort(
                function(a,b) {

                    return String(
                        b.supplierCode || ""
                    )
                    .localeCompare(
                        String(
                            a.supplierCode || ""
                        )
                    );

                }
            );


            return supplierCache;

        }
        catch(fallbackError) {

            console.error(
                "Load suppliers error:",
                fallbackError
            );


            throw fallbackError;

        }

    }

}


/* ============================================================
   RENDER SUPPLIERS
   ============================================================ */

async function renderSuppliers() {

    const table =
        el(
            "supplierTable"
        );


    const mobile =
        el(
            "mobileSuppliers"
        );


    if (
        table
    ) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="100%"
                    class="loading-row"
                >
                    Loading suppliers...
                </td>

            </tr>

        `;

    }


    try {

        const suppliers =
            await loadSuppliers();


        const search =
            value(
                "supplierSearch"
            )
            .toLowerCase();


        const statusFilter =
            value(
                "statusFilter"
            );


        const filtered =
            suppliers.filter(
                function(item) {

                    const searchable =
                        [

                            item.supplierCode,

                            item.supplierName,

                            item.mobile,

                            item.email,

                            item.city,

                            item.gstNumber

                        ]
                        .join(" ")
                        .toLowerCase();


                    const matchesSearch =
                        !search ||
                        searchable.includes(
                            search
                        );


                    const matchesStatus =
                        !statusFilter ||
                        statusFilter === "All" ||
                        item.status === statusFilter;


                    return (
                        matchesSearch &&
                        matchesStatus
                    );

                }
            );


        renderDesktopTable(
            filtered
        );


        renderMobileCards(
            filtered,
            mobile
        );


        updateSummary(
            filtered
        );

    }
    catch(error) {

        console.error(
            "Render suppliers error:",
            error
        );


        if (
            table
        ) {

            table.innerHTML = `

                <tr>

                    <td
                        colspan="100%"
                        class="error-row"
                    >
                        Unable to load suppliers.
                    </td>

                </tr>

            `;

        }

    }

}


/* ============================================================
   DESKTOP TABLE
   ============================================================ */

function renderDesktopTable(
    suppliers
) {

    const table =
        el(
            "supplierTable"
        );


    if (!table) {

        return;

    }


    if (
        suppliers.length === 0
    ) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="100%"
                >

                    <div class="empty-state">

                        <div class="empty-icon">
                            ♙
                        </div>

                        <strong>
                            No suppliers found
                        </strong>

                        <span>
                            Add a supplier to start managing purchases.
                        </span>

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    table.innerHTML =
        suppliers.map(
            function(item) {

                const status =
                    item.status ||
                    "Active";


                return `

                    <tr>

                        <td>
                            ${escapeHTML(
                                item.supplierCode
                            )}
                        </td>

                        <td>
                            <strong>
                                ${escapeHTML(
                                    item.supplierName
                                )}
                            </strong>
                        </td>

                        <td>
                            ${escapeHTML(
                                item.mobile ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                item.city ||
                                "-"
                            )}
                        </td>

                        <td>
                            ₹${formatAmount(
                                item.outstanding
                            )}
                        </td>

                        <td>

                            <span
                                class="${
                                    status === "Active"
                                        ? "active-badge"
                                        : "inactive-badge"
                                }"
                            >
                                ${escapeHTML(
                                    status
                                )}
                            </span>

                        </td>

                        <td>

                            <div class="action-buttons">

                                <button
                                    type="button"
                                    onclick="editSupplier('${escapeHTML(item.id)}')"
                                    title="Edit"
                                >
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    onclick="toggleSupplierStatus('${escapeHTML(item.id)}')"
                                    title="Change status"
                                >
                                    ${status === "Active"
                                        ? "Disable"
                                        : "Activate"}
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
   MOBILE CARDS
   ============================================================ */

function renderMobileCards(
    suppliers,
    container
) {

    if (!container) {

        return;

    }


    if (
        suppliers.length === 0
    ) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    ♙
                </div>

                <strong>
                    No suppliers found
                </strong>

                <span>
                    Add a supplier to start.
                </span>

            </div>

        `;

        return;

    }


    container.innerHTML =
        suppliers.map(
            function(item) {

                const status =
                    item.status ||
                    "Active";


                return `

                    <article class="supplier-card">

                        <div class="supplier-card-top">

                            <div>

                                <strong>
                                    ${escapeHTML(
                                        item.supplierName
                                    )}
                                </strong>

                                <small>
                                    ${escapeHTML(
                                        item.supplierCode
                                    )}
                                </small>

                            </div>

                            <span
                                class="${
                                    status === "Active"
                                        ? "active-badge"
                                        : "inactive-badge"
                                }"
                            >
                                ${escapeHTML(
                                    status
                                )}
                            </span>

                        </div>


                        <div class="supplier-card-details">

                            <div>

                                <span>
                                    Mobile
                                </span>

                                <strong>
                                    ${escapeHTML(
                                        item.mobile ||
                                        "-"
                                    )}
                                </strong>

                            </div>


                            <div>

                                <span>
                                    Outstanding
                                </span>

                                <strong>
                                    ₹${formatAmount(
                                        item.outstanding
                                    )}
                                </strong>

                            </div>

                        </div>


                        <div class="supplier-card-actions">

                            <button
                                type="button"
                                onclick="editSupplier('${escapeHTML(item.id)}')"
                            >
                                Edit
                            </button>

                            <button
                                type="button"
                                onclick="toggleSupplierStatus('${escapeHTML(item.id)}')"
                            >
                                ${
                                    status === "Active"
                                        ? "Disable"
                                        : "Activate"
                                }
                            </button>

                        </div>

                    </article>

                `;

            }
        )
        .join("");

}


/* ============================================================
   EDIT SUPPLIER
   ============================================================ */

async function editSupplier(
    supplierId
) {

    const supplier =
        supplierCache.find(
            function(item) {

                return (
                    item.id ===
                    supplierId
                );

            }
        );


    if (!supplier) {

        showMessage(
            "Supplier record not found.",
            "error"
        );

        return;

    }


    editingSupplierId =
        supplierId;


    setValue(
        "supplierCode",
        supplier.supplierCode
    );

    setValue(
        "supplierName",
        supplier.supplierName
    );

    setValue(
        "mobile",
        supplier.mobile
    );

    setValue(
        "alternateMobile",
        supplier.alternateMobile
    );

    setValue(
        "email",
        supplier.email
    );

    setValue(
        "address",
        supplier.address
    );

    setValue(
        "city",
        supplier.city
    );

    setValue(
        "state",
        supplier.state ||
        DEFAULT_STATE
    );

    setValue(
        "gstNumber",
        supplier.gstNumber
    );

    setValue(
        "outstanding",
        supplier.outstanding || 0
    );

    setValue(
        "creditDays",
        supplier.creditDays || 0
    );


    const active =
        el(
            "active"
        );


    if (active) {

        active.checked =
            supplier.status !==
            "Inactive";

    }


    const title =
        el(
            "supplierFormTitle"
        );


    if (title) {

        title.textContent =
            "Edit Supplier";

    }


    const button =
        document.querySelector(
            "#supplierForm .save-btn"
        );


    if (button) {

        button.textContent =
            "Update Supplier";

    }


    /*
     * Scroll only to form.
     */

    const form =
        el(
            "supplierForm"
        );


    if (form) {

        form.scrollIntoView({

            behavior: "smooth",

            block: "start"

        });

    }

}


/* ============================================================
   TOGGLE STATUS
   ============================================================ */

async function toggleSupplierStatus(
    supplierId
) {

    const supplier =
        supplierCache.find(
            function(item) {

                return (
                    item.id ===
                    supplierId
                );

            }
        );


    if (!supplier) {

        showMessage(
            "Supplier record not found.",
            "error"
        );

        return;

    }


    const currentStatus =
        supplier.status ||
        "Active";


    const newStatus =
        currentStatus === "Active"
            ? "Inactive"
            : "Active";


    const confirmed =
        window.confirm(
            `Change supplier status to ${newStatus}?`
        );


    if (!confirmed) {

        return;

    }


    try {

        await updateDoc(

            doc(

                db,

                COLLECTION_NAME,

                supplierId

            ),

            {

                status:
                    newStatus,

                updatedAt:
                    serverTimestamp(),

                updatedBy:
                    auth.currentUser
                        ? auth.currentUser.uid
                        : null

            }

        );


        showMessage(
            `Supplier ${newStatus.toLowerCase()}.`,
            "success"
        );


        await renderSuppliers();

    }
    catch(error) {

        console.error(
            "Supplier status error:",
            error
        );


        showMessage(
            getErrorMessage(
                error
            ),
            "error"
        );

    }

}


/* ============================================================
   CLEAR FORM
   ============================================================ */

function clearSupplierForm() {

    editingSupplierId =
        null;


    const form =
        el(
            "supplierForm"
        );


    if (form) {

        form.reset();

    }


    setValue(
        "state",
        DEFAULT_STATE
    );


    setValue(
        "outstanding",
        0
    );


    setValue(
        "creditDays",
        0
    );


    const active =
        el(
            "active"
        );


    if (active) {

        active.checked =
            true;

    }


    const title =
        el(
            "supplierFormTitle"
        );


    if (title) {

        title.textContent =
            "Add Supplier";

    }


    const button =
        document.querySelector(
            "#supplierForm .save-btn"
        );


    if (button) {

        button.textContent =
            "Save Supplier";

    }


    prepareNewSupplierCode();

}


/* ============================================================
   SUMMARY
   ============================================================ */

function updateSummary(
    suppliers
) {

    const total =
        suppliers.length;


    const active =
        suppliers.filter(
            function(item) {

                return (
                    item.status !==
                    "Inactive"
                );

            }
        ).length;


    const outstanding =
        suppliers.reduce(
            function(sum,item) {

                return (
                    sum +
                    numberValue(
                        item.outstanding
                    )
                );

            },
            0
        );


    setSummary(
        [
            "totalSuppliers",
            "supplierCount",
            "totalSupplierCount"
        ],
        total
    );


    setSummary(
        [
            "activeSuppliers",
            "activeSupplierCount"
        ],
        active
    );


    setSummary(
        [
            "supplierOutstanding",
            "totalOutstanding",
            "supplierPayable"
        ],
        "₹" +
        formatAmount(
            outstanding
        )
    );

}


/* ============================================================
   SUMMARY HELPER
   ============================================================ */

function setSummary(
    ids,
    valueToSet
) {

    for (
        const id of ids
    ) {

        const node =
            el(
                id
            );


        if (node) {

            node.textContent =
                valueToSet;

            return;

        }

    }

}


/* ============================================================
   AMOUNT FORMAT
   ============================================================ */

function formatAmount(
    amount
) {

    return numberValue(
        amount
    )
    .toLocaleString(
        "en-IN",
        {

            minimumFractionDigits:
                2,

            maximumFractionDigits:
                2

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
            "mmvSupplierMessage"
        );


    if (!box) {

        box =
            document.createElement(
                "div"
            );


        box.id =
            "mmvSupplierMessage";


        box.style.position =
            "fixed";

        box.style.right =
            "18px";

        box.style.bottom =
            "18px";

        box.style.zIndex =
            "99999";

        box.style.maxWidth =
            "360px";

        box.style.padding =
            "13px 16px";

        box.style.borderRadius =
            "10px";

        box.style.fontSize =
            "12px";

        box.style.fontWeight =
            "700";

        box.style.boxShadow =
            "0 12px 35px rgba(0,0,0,.15)";


        document.body.appendChild(
            box
        );

    }


    box.textContent =
        message;


    box.style.background =
        type === "success"
            ? "#eaf8f0"
            : type === "error"
                ? "#fff0f0"
                : "#eef5ff";


    box.style.color =
        type === "success"
            ? "#167447"
            : type === "error"
                ? "#b42318"
                : "#174a91";


    box.style.border =
        type === "success"
            ? "1px solid #bce8cf"
            : type === "error"
                ? "1px solid #f2c5c5"
                : "1px solid #c9ddfa";


    clearTimeout(
        box._timer
    );


    box._timer =
        setTimeout(
            function() {

                box.remove();

            },
            3200
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
            error.code || ""
        );


    if (
        code.includes(
            "permission-denied"
        )
    ) {

        return "You do not have permission to perform this action.";

    }


    if (
        code.includes(
            "failed-precondition"
        )
    ) {

        return "Firestore requires an index for this query. Please check Firebase Console.";

    }


    if (
        code.includes(
            "unavailable"
        )
    ) {

        return "Firebase is temporarily unavailable. Please try again.";

    }


    if (
        error.message
    ) {

        return error.message;

    }


    return "Unable to complete the request.";

}


/* ============================================================
   GLOBAL API
   Existing HTML already calls these functions.
   ============================================================ */

window.MMVSuppliers = {

    saveSupplier,

    renderSuppliers,

    editSupplier,

    toggleSupplierStatus,

    prepareNewSupplierCode,

    clearSupplierForm

};


window.saveSupplier =
    saveSupplier;

window.editSupplier =
    editSupplier;

window.toggleSupplierStatus =
    toggleSupplierStatus;


/* ============================================================
   SEARCH / FILTER
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        /*
         * Initial state.
         */

        setValue(
            "state",
            DEFAULT_STATE
        );


        const active =
            el(
                "active"
            );


        if (active) {

            active.checked =
                true;

        }


        /*
         * Search
         */

        const search =
            el(
                "supplierSearch"
            );


        if (search) {

            search.addEventListener(
                "input",
                function() {

                    renderSuppliers();

                }
            );

        }


        /*
         * Status filter
         */

        const filter =
            el(
                "statusFilter"
            );


        if (filter) {

            filter.addEventListener(
                "change",
                function() {

                    renderSuppliers();

                }
            );

        }


        /*
         * Initial load.
         */

        await renderSuppliers();


        /*
         * Generate code only
         * for new supplier.
         */

        await prepareNewSupplierCode();

    }
);


/* ============================================================
   MODULE READY
   ============================================================ */

console.info(
    "%cMMV Suppliers V2%c connected",
    "font-weight:800;color:#0a3d91;",
    "color:inherit;"
);
