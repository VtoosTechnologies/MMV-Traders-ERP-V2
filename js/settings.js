/* ============================================================
   MMV TRADERS ERP V2
   SETTINGS SERVICE
   Production Firebase + Firestore
   ============================================================ */

"use strict";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from
"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
    db,
    auth
} from "./firebase.js";


/* ============================================================
   CONFIG
   ============================================================ */

const SETTINGS_COLLECTION =
    "settings";

const SETTINGS_DOCUMENT =
    "company";


/* ============================================================
   DEFAULT SETTINGS
   ============================================================ */

const DEFAULT_SETTINGS = {

    companyName:
        "MMV Traders",

    legalName:
        "",

    ownerName:
        "",

    gstNumber:
        "",

    panNumber:
        "",

    phone:
        "",

    email:
        "",

    website:
        "",

    addressLine1:
        "",

    addressLine2:
        "",

    city:
        "",

    state:
        "",

    pincode:
        "",

    country:
        "India",

    currency:
        "INR",

    currencySymbol:
        "₹",

    financialYearStart:
        "04-01",

    invoicePrefix:
        "INV-",

    invoiceNumberLength:
        6,

    quotationPrefix:
        "QT-",

    purchasePrefix:
        "PUR-",

    receiptPrefix:
        "REC-",

    supplierPaymentPrefix:
        "PAY-",

    defaultPaymentMode:
        "Cash",

    defaultTaxRate:
        18,

    lowStockDefaultLevel:
        5,

    enableLowStockAlerts:
        true,

    enableCustomerDueAlerts:
        true,

    enableSupplierDueAlerts:
        true,

    enablePaymentAlerts:
        true,

    enableDailySummary:
        true,

    invoiceTerms:
        "Goods once sold will not be taken back unless otherwise agreed.",

    invoiceFooter:
        "Thank you for your business.",

    showGSTOnInvoice:
        true,

    showCompanyGST:
        true,

    showCustomerGST:
        true,

    updatedAt:
        null,

    updatedBy:
        null

};


/* ============================================================
   STATE
   ============================================================ */

const settingsState = {

    data:
        {
            ...DEFAULT_SETTINGS
        },

    loaded:
        false,

    saving:
        false

};


/* ============================================================
   HELPERS
   ============================================================ */

function settingsEl(id) {

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


function currentUserId() {

    return (
        auth?.currentUser?.uid ||
        null
    );

}


function setValue(
    ids,
    value
) {

    if (!Array.isArray(ids)) {

        ids = [ids];

    }


    for (
        const id of ids
    ) {

        const node =
            settingsEl(id);


        if (node) {

            node.value =
                value ?? "";

            return;

        }

    }

}


function getValue(
    ids
) {

    if (!Array.isArray(ids)) {

        ids = [ids];

    }


    for (
        const id of ids
    ) {

        const node =
            settingsEl(id);


        if (node) {

            return clean(
                node.value
            );

        }

    }


    return "";

}


function setChecked(
    ids,
    checked
) {

    if (!Array.isArray(ids)) {

        ids = [ids];

    }


    for (
        const id of ids
    ) {

        const node =
            settingsEl(id);


        if (node) {

            node.checked =
                Boolean(
                    checked
                );

            return;

        }

    }

}


function getChecked(
    ids
) {

    if (!Array.isArray(ids)) {

        ids = [ids];

    }


    for (
        const id of ids
    ) {

        const node =
            settingsEl(id);


        if (node) {

            return Boolean(
                node.checked
            );

        }

    }


    return false;

}


/* ============================================================
   LOAD SETTINGS
   ============================================================ */

async function loadSettings() {

    try {

        const reference =
            doc(
                db,
                SETTINGS_COLLECTION,
                SETTINGS_DOCUMENT
            );


        const snapshot =
            await getDoc(
                reference
            );


        if (
            snapshot.exists()
        ) {

            settingsState.data = {

                ...DEFAULT_SETTINGS,

                ...snapshot.data()

            };

        }
        else {

            settingsState.data = {

                ...DEFAULT_SETTINGS

            };

        }


        settingsState.loaded =
            true;


        populateSettingsForm();


        applySettingsToApplication();


        return settingsState.data;

    }
    catch(error) {

        console.error(
            "Settings load error:",
            error
        );


        showSettingsMessage(
            getErrorMessage(error),
            "error"
        );


        return settingsState.data;

    }

}


/* ============================================================
   COLLECT FORM DATA
   ============================================================ */

function collectSettingsForm() {

    return {

        companyName:
            getValue([
                "companyName",
                "settingsCompanyName"
            ]),

        legalName:
            getValue([
                "legalName",
                "settingsLegalName"
            ]),

        ownerName:
            getValue([
                "ownerName",
                "settingsOwnerName"
            ]),

        gstNumber:
            getValue([
                "gstNumber",
                "settingsGSTNumber"
            ]).toUpperCase(),

        panNumber:
            getValue([
                "panNumber",
                "settingsPANNumber"
            ]).toUpperCase(),

        phone:
            getValue([
                "phone",
                "settingsPhone"
            ]),

        email:
            getValue([
                "email",
                "settingsEmail"
            ]),

        website:
            getValue([
                "website",
                "settingsWebsite"
            ]),

        addressLine1:
            getValue([
                "addressLine1",
                "settingsAddressLine1"
            ]),

        addressLine2:
            getValue([
                "addressLine2",
                "settingsAddressLine2"
            ]),

        city:
            getValue([
                "city",
                "settingsCity"
            ]),

        state:
            getValue([
                "state",
                "settingsState"
            ]),

        pincode:
            getValue([
                "pincode",
                "settingsPincode"
            ]),

        country:
            getValue([
                "country",
                "settingsCountry"
            ]) ||
            "India",

        currency:
            getValue([
                "currency",
                "settingsCurrency"
            ]) ||
            "INR",

        currencySymbol:
            getValue([
                "currencySymbol",
                "settingsCurrencySymbol"
            ]) ||
            "₹",

        financialYearStart:
            getValue([
                "financialYearStart",
                "settingsFinancialYearStart"
            ]) ||
            "04-01",

        invoicePrefix:
            getValue([
                "invoicePrefix",
                "settingsInvoicePrefix"
            ]) ||
            "INV-",

        invoiceNumberLength:
            numberValue(
                getValue([
                    "invoiceNumberLength",
                    "settingsInvoiceNumberLength"
                ])
            ) || 6,

        quotationPrefix:
            getValue([
                "quotationPrefix",
                "settingsQuotationPrefix"
            ]) ||
            "QT-",

        purchasePrefix:
            getValue([
                "purchasePrefix",
                "settingsPurchasePrefix"
            ]) ||
            "PUR-",

        receiptPrefix:
            getValue([
                "receiptPrefix",
                "settingsReceiptPrefix"
            ]) ||
            "REC-",

        supplierPaymentPrefix:
            getValue([
                "supplierPaymentPrefix",
                "settingsSupplierPaymentPrefix"
            ]) ||
            "PAY-",

        defaultPaymentMode:
            getValue([
                "defaultPaymentMode",
                "settingsDefaultPaymentMode"
            ]) ||
            "Cash",

        defaultTaxRate:
            numberValue(
                getValue([
                    "defaultTaxRate",
                    "settingsDefaultTaxRate"
                ])
            ),

        lowStockDefaultLevel:
            numberValue(
                getValue([
                    "lowStockDefaultLevel",
                    "settingsLowStockDefaultLevel"
                ])
            ),

        enableLowStockAlerts:
            getChecked([
                "enableLowStockAlerts",
                "settingsEnableLowStockAlerts"
            ]),

        enableCustomerDueAlerts:
            getChecked([
                "enableCustomerDueAlerts",
                "settingsEnableCustomerDueAlerts"
            ]),

        enableSupplierDueAlerts:
            getChecked([
                "enableSupplierDueAlerts",
                "settingsEnableSupplierDueAlerts"
            ]),

        enablePaymentAlerts:
            getChecked([
                "enablePaymentAlerts",
                "settingsEnablePaymentAlerts"
            ]),

        enableDailySummary:
            getChecked([
                "enableDailySummary",
                "settingsEnableDailySummary"
            ]),

        invoiceTerms:
            getValue([
                "invoiceTerms",
                "settingsInvoiceTerms"
            ]),

        invoiceFooter:
            getValue([
                "invoiceFooter",
                "settingsInvoiceFooter"
            ]),

        showGSTOnInvoice:
            getChecked([
                "showGSTOnInvoice",
                "settingsShowGSTOnInvoice"
            ]),

        showCompanyGST:
            getChecked([
                "showCompanyGST",
                "settingsShowCompanyGST"
            ]),

        showCustomerGST:
            getChecked([
                "showCustomerGST",
                "settingsShowCustomerGST"
            ])

    };

}


/* ============================================================
   VALIDATION
   ============================================================ */

function validateSettings(
    data
) {

    if (
        !data.companyName
    ) {

        throw new Error(
            "Company name is required."
        );

    }


    if (
        data.invoiceNumberLength <
        4 ||
        data.invoiceNumberLength >
        10
    ) {

        throw new Error(
            "Invoice number length must be between 4 and 10."
        );

    }


    if (
        data.defaultTaxRate <
        0 ||
        data.defaultTaxRate >
        100
    ) {

        throw new Error(
            "Default tax rate must be between 0 and 100."
        );

    }


    if (
        data.lowStockDefaultLevel <
        0
    ) {

        throw new Error(
            "Low stock level cannot be negative."
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

}


/* ============================================================
   SAVE SETTINGS
   ============================================================ */

async function saveSettings() {

    if (
        settingsState.saving
    ) {

        return false;

    }


    try {

        settingsState.saving =
            true;


        const data =
            collectSettingsForm();


        validateSettings(
            data
        );


        const userId =
            currentUserId();


        const finalData = {

            ...DEFAULT_SETTINGS,

            ...data,

            updatedAt:
                serverTimestamp(),

            updatedBy:
                userId

        };


        const reference =
            doc(
                db,
                SETTINGS_COLLECTION,
                SETTINGS_DOCUMENT
            );


        await setDoc(
            reference,
            finalData,
            {
                merge:
                    true
            }
        );


        settingsState.data = {

            ...settingsState.data,

            ...data

        };


        settingsState.loaded =
            true;


        applySettingsToApplication();


        showSettingsMessage(
            "Company settings saved successfully.",
            "success"
        );


        return true;

    }
    catch(error) {

        console.error(
            "Settings save error:",
            error
        );


        showSettingsMessage(
            getErrorMessage(error),
            "error"
        );


        return false;

    }
    finally {

        settingsState.saving =
            false;

    }

}


/* ============================================================
   POPULATE FORM
   ============================================================ */

function populateSettingsForm() {

    const data =
        settingsState.data;


    setValue(
        [
            "companyName",
            "settingsCompanyName"
        ],
        data.companyName
    );


    setValue(
        [
            "legalName",
            "settingsLegalName"
        ],
        data.legalName
    );


    setValue(
        [
            "ownerName",
            "settingsOwnerName"
        ],
        data.ownerName
    );


    setValue(
        [
            "gstNumber",
            "settingsGSTNumber"
        ],
        data.gstNumber
    );


    setValue(
        [
            "panNumber",
            "settingsPANNumber"
        ],
        data.panNumber
    );


    setValue(
        [
            "phone",
            "settingsPhone"
        ],
        data.phone
    );


    setValue(
        [
            "email",
            "settingsEmail"
        ],
        data.email
    );


    setValue(
        [
            "website",
            "settingsWebsite"
        ],
        data.website
    );


    setValue(
        [
            "addressLine1",
            "settingsAddressLine1"
        ],
        data.addressLine1
    );


    setValue(
        [
            "addressLine2",
            "settingsAddressLine2"
        ],
        data.addressLine2
    );


    setValue(
        [
            "city",
            "settingsCity"
        ],
        data.city
    );


    setValue(
        [
            "state",
            "settingsState"
        ],
        data.state
    );


    setValue(
        [
            "pincode",
            "settingsPincode"
        ],
        data.pincode
    );


    setValue(
        [
            "country",
            "settingsCountry"
        ],
        data.country
    );


    setValue(
        [
            "currency",
            "settingsCurrency"
        ],
        data.currency
    );


    setValue(
        [
            "currencySymbol",
            "settingsCurrencySymbol"
        ],
        data.currencySymbol
    );


    setValue(
        [
            "financialYearStart",
            "settingsFinancialYearStart"
        ],
        data.financialYearStart
    );


    setValue(
        [
            "invoicePrefix",
            "settingsInvoicePrefix"
        ],
        data.invoicePrefix
    );


    setValue(
        [
            "invoiceNumberLength",
            "settingsInvoiceNumberLength"
        ],
        data.invoiceNumberLength
    );


    setValue(
        [
            "quotationPrefix",
            "settingsQuotationPrefix"
        ],
        data.quotationPrefix
    );


    setValue(
        [
            "purchasePrefix",
            "settingsPurchasePrefix"
        ],
        data.purchasePrefix
    );


    setValue(
        [
            "receiptPrefix",
            "settingsReceiptPrefix"
        ],
        data.receiptPrefix
    );


    setValue(
        [
            "supplierPaymentPrefix",
            "settingsSupplierPaymentPrefix"
        ],
        data.supplierPaymentPrefix
    );


    setValue(
        [
            "defaultPaymentMode",
            "settingsDefaultPaymentMode"
        ],
        data.defaultPaymentMode
    );


    setValue(
        [
            "defaultTaxRate",
            "settingsDefaultTaxRate"
        ],
        data.defaultTaxRate
    );


    setValue(
        [
            "lowStockDefaultLevel",
            "settingsLowStockDefaultLevel"
        ],
        data.lowStockDefaultLevel
    );


    setChecked(
        [
            "enableLowStockAlerts",
            "settingsEnableLowStockAlerts"
        ],
        data.enableLowStockAlerts
    );


    setChecked(
        [
            "enableCustomerDueAlerts",
            "settingsEnableCustomerDueAlerts"
        ],
        data.enableCustomerDueAlerts
    );


    setChecked(
        [
            "enableSupplierDueAlerts",
            "settingsEnableSupplierDueAlerts"
        ],
        data.enableSupplierDueAlerts
    );


    setChecked(
        [
            "enablePaymentAlerts",
            "settingsEnablePaymentAlerts"
        ],
        data.enablePaymentAlerts
    );


    setChecked(
        [
            "enableDailySummary",
            "settingsEnableDailySummary"
        ],
        data.enableDailySummary
    );


    setValue(
        [
            "invoiceTerms",
            "settingsInvoiceTerms"
        ],
        data.invoiceTerms
    );


    setValue(
        [
            "invoiceFooter",
            "settingsInvoiceFooter"
        ],
        data.invoiceFooter
    );


    setChecked(
        [
            "showGSTOnInvoice",
            "settingsShowGSTOnInvoice"
        ],
        data.showGSTOnInvoice
    );


    setChecked(
        [
            "showCompanyGST",
            "settingsShowCompanyGST"
        ],
        data.showCompanyGST
    );


    setChecked(
        [
            "showCustomerGST",
            "settingsShowCustomerGST"
        ],
        data.showCustomerGST
    );

}


/* ============================================================
   APPLY SETTINGS GLOBALLY
   ============================================================ */

function applySettingsToApplication() {

    const data =
        settingsState.data;


    /*
     * Global company settings.
     */

    window.MMVSettings =
        data;


    /*
     * Currency helpers.
     */

    window.MMVCurrency = {

        code:
            data.currency,

        symbol:
            data.currencySymbol,

        format(
            amount
        ) {

            const value =
                numberValue(
                    amount
                );


            return (
                data.currencySymbol +
                value.toLocaleString(
                    "en-IN",
                    {
                        minimumFractionDigits:
                            2,

                        maximumFractionDigits:
                            2
                    }
                )
            );

        }

    };


    /*
     * Notification configuration.
     */

    if (
        window.MMVNotifications
    ) {

        /*
         * Keep settings available
         * without forcing internal
         * notification state changes.
         */

        window.MMVNotifications
            .settings = {

                lowStock:
                    data.enableLowStockAlerts,

                customerOutstanding:
                    data.enableCustomerDueAlerts,

                supplierPayable:
                    data.enableSupplierDueAlerts,

                recentPayment:
                    data.enablePaymentAlerts,

                dailySummary:
                    data.enableDailySummary

            };

    }


    /*
     * Update company name wherever
     * dashboard/header supports it.
     */

    document
        .querySelectorAll(
            "[data-company-name]"
        )
        .forEach(
            node => {

                node.textContent =
                    data.companyName;

            }
        );


    /*
     * Currency display elements.
     */

    document
        .querySelectorAll(
            "[data-currency-symbol]"
        )
        .forEach(
            node => {

                node.textContent =
                    data.currencySymbol;

            }
        );

}


/* ============================================================
   RESET FORM
   ============================================================ */

function resetSettingsForm() {

    settingsState.data = {

        ...DEFAULT_SETTINGS

    };


    populateSettingsForm();

    applySettingsToApplication();


    showSettingsMessage(
        "Settings form reset to defaults.",
        "info"
    );

}


/* ============================================================
   GET SETTINGS
   ============================================================ */

function getSettings() {

    return {

        ...settingsState.data

    };

}


/* ============================================================
   GET COMPANY PROFILE
   ============================================================ */

function getCompanyProfile() {

    const data =
        settingsState.data;


    return {

        companyName:
            data.companyName,

        legalName:
            data.legalName,

        ownerName:
            data.ownerName,

        gstNumber:
            data.gstNumber,

        panNumber:
            data.panNumber,

        phone:
            data.phone,

        email:
            data.email,

        website:
            data.website,

        addressLine1:
            data.addressLine1,

        addressLine2:
            data.addressLine2,

        city:
            data.city,

        state:
            data.state,

        pincode:
            data.pincode,

        country:
            data.country

    };

}


/* ============================================================
   GET INVOICE SETTINGS
   ============================================================ */

function getInvoiceSettings() {

    const data =
        settingsState.data;


    return {

        invoicePrefix:
            data.invoicePrefix,

        invoiceNumberLength:
            data.invoiceNumberLength,

        quotationPrefix:
            data.quotationPrefix,

        purchasePrefix:
            data.purchasePrefix,

        receiptPrefix:
            data.receiptPrefix,

        supplierPaymentPrefix:
            data.supplierPaymentPrefix,

        defaultPaymentMode:
            data.defaultPaymentMode,

        defaultTaxRate:
            data.defaultTaxRate,

        invoiceTerms:
            data.invoiceTerms,

        invoiceFooter:
            data.invoiceFooter,

        showGSTOnInvoice:
            data.showGSTOnInvoice,

        showCompanyGST:
            data.showCompanyGST,

        showCustomerGST:
            data.showCustomerGST

    };

}


/* ============================================================
   FINANCIAL YEAR
   ============================================================ */

function getFinancialYear(
    date = new Date()
) {

    const configured =
        clean(
            settingsState.data
                .financialYearStart
        ) ||
        "04-01";


    const parts =
        configured.split(
            "-"
        );


    const startMonth =
        numberValue(
            parts[0]
        );


    const startDay =
        numberValue(
            parts[1]
        );


    const month =
        date.getMonth() + 1;


    const day =
        date.getDate();


    let startYear =
        date.getFullYear();


    if (
        month < startMonth ||
        (
            month === startMonth &&
            day < startDay
        )
    ) {

        startYear -= 1;

    }


    const endYear =
        startYear + 1;


    return {

        startYear,

        endYear,

        label:
            `${startYear}-${String(
                endYear
            ).slice(-2)}`

    };

}


/* ============================================================
   GENERATE INVOICE PREFIX
   ============================================================ */

function getInvoicePrefix(
    type = "SALES"
) {

    const data =
        settingsState.data;


    switch (
        String(
            type
        ).toUpperCase()
    ) {

        case "PURCHASE":

            return data.purchasePrefix;

        case "QUOTATION":

            return data.quotationPrefix;

        case "RECEIPT":

            return data.receiptPrefix;

        case "PAYMENT":

            return data.supplierPaymentPrefix;

        default:

            return data.invoicePrefix;

    }

}


/* ============================================================
   MESSAGE
   ============================================================ */

function showSettingsMessage(
    message,
    type = "info"
) {

    let box =
        settingsEl(
            "mmvSettingsMessage"
        );


    if (!box) {

        box =
            document.createElement(
                "div"
            );


        box.id =
            "mmvSettingsMessage";


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

        return "You do not have permission to modify company settings.";

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
        "Unable to save settings."
    );

}


/* ============================================================
   DOM READY
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await loadSettings();


        const saveButton =
            settingsEl(
                "saveSettings"
            );


        if (saveButton) {

            saveButton.addEventListener(
                "click",
                saveSettings
            );

        }


        const resetButton =
            settingsEl(
                "resetSettings"
            );


        if (resetButton) {

            resetButton.addEventListener(
                "click",
                resetSettingsForm
            );

        }


        /*
         * Form submit support.
         */

        const form =
            settingsEl(
                "settingsForm"
            );


        if (form) {

            form.addEventListener(
                "submit",
                event => {

                    event.preventDefault();

                    saveSettings();

                }
            );

        }

    }
);


/* ============================================================
   GLOBAL API
   ============================================================ */

window.MMVSettingsAPI = {

    load:
        loadSettings,

    save:
        saveSettings,

    get:
        getSettings,

    getCompanyProfile,

    getInvoiceSettings,

    getFinancialYear,

    getInvoicePrefix,

    reset:
        resetSettingsForm,

    populate:
        populateSettingsForm,

    apply:
        applySettingsToApplication

};


window.loadSettings =
    loadSettings;

window.saveSettings =
    saveSettings;

window.getSettings =
    getSettings;

window.getCompanyProfile =
    getCompanyProfile;

window.getInvoiceSettings =
    getInvoiceSettings;

window.getFinancialYear =
    getFinancialYear;

window.getInvoicePrefix =
    getInvoicePrefix;


console.info(
    "%cMMV Settings V2%c ready",
    "font-weight:800;color:#0a3d91;",
    "color:inherit;"
);
