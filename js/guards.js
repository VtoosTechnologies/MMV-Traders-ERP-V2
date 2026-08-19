/* ============================================================
   MMV TRADERS ERP V2
   PAGE & PERMISSION GUARD
   ------------------------------------------------------------
   Protects:
   - Dashboard
   - Customers
   - Suppliers
   - Inventory
   - Sales
   - Purchases
   - Payments
   - Reports
   - Settings
   - Users
   ============================================================ */

"use strict";

import {
    protectPage,
    getCurrentUser,
    getCurrentRole
} from "./auth.js";


/* ============================================================
   PAGE PERMISSION MAP
   ============================================================ */

const PAGE_PERMISSIONS = {

    "dashboard.html":
        "dashboard",

    "customers.html":
        "customers",

    "suppliers.html":
        "suppliers",

    "inventory.html":
        "inventory",

    "products.html":
        "inventory",

    "sales.html":
        "sales",

    "purchase.html":
        "purchases",

    "purchases.html":
        "purchases",

    "payments.html":
        "payments",

    "receipts.html":
        "payments",

    "reports.html":
        "reports",

    "settings.html":
        "settings",

    "users.html":
        "users",

    "quotations.html":
        "sales",

    "expenses.html":
        "payments"

};


/* ============================================================
   ACCESS DENIED PAGE
   ============================================================ */

const ACCESS_DENIED_PAGE =
    "access-denied.html";


/* ============================================================
   GET CURRENT PAGE
   ============================================================ */

function getCurrentPage() {

    const path =
        window.location.pathname;


    const filename =
        path
            .split("/")
            .pop();


    return filename ||
        "index.html";

}


/* ============================================================
   GET USER PERMISSIONS
   ============================================================ */

function getUserPermissions(
    user
) {

    if (!user) {

        return {};

    }


    /*
     * Admin always gets full access.
     */

    if (
        String(
            user.profile?.role ||
            ""
        ).toUpperCase() ===
        "ADMIN"
    ) {

        return {

            dashboard: true,

            customers: true,

            suppliers: true,

            inventory: true,

            sales: true,

            purchases: true,

            payments: true,

            reports: true,

            settings: true,

            users: true,

            deleteRecords: true,

            exportData: true

        };

    }


    return (
        user.profile?.permissions ||
        {}
    );

}


/* ============================================================
   CHECK PERMISSION
   ============================================================ */

function hasPagePermission(
    permission
) {

    const user =
        getCurrentUser();


    if (!user) {

        return false;

    }


    const status =
        String(
            user.profile?.status ||
            ""
        ).toUpperCase();


    if (
        status !==
        "ACTIVE"
    ) {

        return false;

    }


    const permissions =
        getUserPermissions(
            user
        );


    return (
        permissions[
            permission
        ] === true
    );

}


/* ============================================================
   PAGE ACCESS CHECK
   ============================================================ */

function canAccessCurrentPage() {

    const page =
        getCurrentPage();


    const permission =
        PAGE_PERMISSIONS[
            page
        ];


    /*
     * Unknown pages are not
     * automatically blocked.
     */

    if (!permission) {

        return true;

    }


    return hasPagePermission(
        permission
    );

}


/* ============================================================
   REDIRECT ACCESS DENIED
   ============================================================ */

function redirectAccessDenied() {

    if (
        window.location.pathname
            .endsWith(
                ACCESS_DENIED_PAGE
            )
    ) {

        return;

    }


    window.location.href =
        ACCESS_DENIED_PAGE;

}


/* ============================================================
   GUARD CURRENT PAGE
   ============================================================ */

async function guardCurrentPage() {

    /*
     * First make sure Firebase
     * authentication is valid.
     */

    const authenticated =
        await protectPage();


    if (!authenticated) {

        return false;

    }


    const allowed =
        canAccessCurrentPage();


    if (!allowed) {

        redirectAccessDenied();

        return false;

    }


    applyPermissionVisibility();


    return true;

}


/* ============================================================
   PERMISSION-BASED UI
   ============================================================ */

function applyPermissionVisibility() {

    const user =
        getCurrentUser();


    if (!user) {

        return;

    }


    const permissions =
        getUserPermissions(
            user
        );


    /*
     * Example:
     *
     * <button data-permission="reports">
     *     Reports
     * </button>
     */

    document
        .querySelectorAll(
            "[data-permission]"
        )
        .forEach(
            element => {

                const permission =
                    element.getAttribute(
                        "data-permission"
                    );


                const allowed =
                    permissions[
                        permission
                    ] === true;


                if (
                    allowed
                ) {

                    element.style.display =
                        "";

                    element.removeAttribute(
                        "aria-hidden"
                    );

                }
                else {

                    element.style.display =
                        "none";

                    element.setAttribute(
                        "aria-hidden",
                        "true"
                    );

                }

            }
        );


    /*
     * Role based elements.
     *
     * Example:
     *
     * <div data-role="ADMIN">
     */

    const role =
        getCurrentRole();


    document
        .querySelectorAll(
            "[data-role]"
        )
        .forEach(
            element => {

                const requiredRole =
                    String(
                        element.getAttribute(
                            "data-role"
                        )
                    )
                    .toUpperCase();


                const allowed =
                    requiredRole ===
                    String(
                        role
                    ).toUpperCase();


                element.style.display =
                    allowed
                        ? ""
                        : "none";

            }
        );

}


/* ============================================================
   GUARD BUTTON ACTION
   ============================================================ */

function guardAction(
    permission,
    callback
) {

    if (
        !hasPagePermission(
            permission
        )
    ) {

        showGuardMessage(
            "You do not have permission to perform this action.",
            "error"
        );


        return false;

    }


    if (
        typeof callback ===
        "function"
    ) {

        return callback();

    }


    return true;

}


/* ============================================================
   DELETE GUARD
   ============================================================ */

function canDelete() {

    return hasPagePermission(
        "deleteRecords"
    );

}


/* ============================================================
   EXPORT GUARD
   ============================================================ */

function canExport() {

    return hasPagePermission(
        "exportData"
    );

}


/* ============================================================
   REPORT GUARD
   ============================================================ */

function canViewReports() {

    return hasPagePermission(
        "reports"
    );

}


/* ============================================================
   SETTINGS GUARD
   ============================================================ */

function canManageSettings() {

    return hasPagePermission(
        "settings"
    );

}


/* ============================================================
   USER MANAGEMENT GUARD
   ============================================================ */

function canManageUsers() {

    return hasPagePermission(
        "users"
    );

}


/* ============================================================
   MESSAGE
   ============================================================ */

function showGuardMessage(
    message,
    type = "info"
) {

    let box =
        document.getElementById(
            "mmvGuardMessage"
        );


    if (!box) {

        box =
            document.createElement(
                "div"
            );


        box.id =
            "mmvGuardMessage";


        Object.assign(
            box.style,
            {

                position:
                    "fixed",

                left:
                    "50%",

                bottom:
                    "24px",

                transform:
                    "translateX(-50%)",

                zIndex:
                    "99999",

                maxWidth:
                    "420px",

                padding:
                    "13px 18px",

                borderRadius:
                    "12px",

                fontSize:
                    "13px",

                fontWeight:
                    "700",

                boxShadow:
                    "0 12px 30px rgba(0,0,0,.18)"

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
            3000
        );

}


/* ============================================================
   DISABLE PROTECTED ACTIONS
   ============================================================ */

function initializeActionGuards() {

    document
        .querySelectorAll(
            "[data-requires-permission]"
        )
        .forEach(
            element => {

                const permission =
                    element.getAttribute(
                        "data-requires-permission"
                    );


                if (
                    !hasPagePermission(
                        permission
                    )
                ) {

                    element.disabled =
                        true;

                    element.setAttribute(
                        "aria-disabled",
                        "true"
                    );

                    element.title =
                        "You do not have permission for this action.";

                }

            }
        );

}


/* ============================================================
   INITIALIZE
   ============================================================ */

async function initializeGuards() {

    const allowed =
        await guardCurrentPage();


    if (!allowed) {

        return false;

    }


    initializeActionGuards();


    return true;

}


/* ============================================================
   GLOBAL API
   ============================================================ */

window.MMVGuards = {

    initialize:
        initializeGuards,

    guardCurrentPage,

    canAccessCurrentPage,

    hasPagePermission,

    applyPermissionVisibility,

    guardAction,

    canDelete,

    canExport,

    canViewReports,

    canManageSettings,

    canManageUsers

};


window.hasPagePermission =
    hasPagePermission;


window.canDelete =
    canDelete;


window.canExport =
    canExport;


console.info(
    "%cMMV Guards V2%c ready",
    "font-weight:800;color:#0a3d91;",
    "color:inherit;"
);
export {
    initializeGuards,
    guardCurrentPage,
    canAccessCurrentPage,
    hasPagePermission,
    applyPermissionVisibility,
    guardAction,
    canDelete,
    canExport,
    canViewReports,
    canManageSettings,
    canManageUsers
};
