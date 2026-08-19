/* ============================================================
   MMV TRADERS ERP V2
   SECURITY SERVICE
   Route Protection / Role Checks / Safe Access
   ============================================================ */

"use strict";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
    auth,
    db
} from "./firebase.js";


/* ============================================================
   SECURITY CONFIG
   ============================================================ */

export const SECURITY_CONFIG = Object.freeze({

    loginPage: "../login.html",

    dashboardPage: "../index.html",

    defaultRole: "owner",

    allowedStatuses: [
        "Active"
    ]

});


/* ============================================================
   GET CURRENT FIREBASE USER
   ============================================================ */

export function getFirebaseUser() {

    return auth.currentUser || null;

}


/* ============================================================
   WAIT FOR FIREBASE AUTH STATE
   ============================================================ */

export function waitForUser() {

    return new Promise(
        function(resolve) {

            const unsubscribe =
                onAuthStateChanged(

                    auth,

                    function(user) {

                        unsubscribe();

                        resolve(
                            user
                        );

                    }

                );

        }
    );

}


/* ============================================================
   LOAD USER SECURITY PROFILE
   ============================================================ */

export async function getSecurityProfile(
    user
) {

    if (!user) {

        return null;

    }


    try {

        const reference =
            doc(
                db,
                "users",
                user.uid
            );


        const snapshot =
            await getDoc(
                reference
            );


        if (!snapshot.exists()) {

            return {

                uid:
                    user.uid,

                email:
                    user.email || "",

                name:
                    user.displayName ||
                    "MMV User",

                role:
                    SECURITY_CONFIG.defaultRole,

                status:
                    "Active"

            };

        }


        return {

            uid:
                user.uid,

            email:
                user.email || "",

            ...snapshot.data()

        };

    }
    catch(error) {

        console.error(
            "MMV Security Profile Error:",
            error
        );


        return {

            uid:
                user.uid,

            email:
                user.email || "",

            name:
                user.displayName ||
                "MMV User",

            role:
                SECURITY_CONFIG.defaultRole,

            status:
                "Active"

        };

    }

}


/* ============================================================
   CHECK ACCOUNT STATUS
   ============================================================ */

export function isAccountActive(
    profile
) {

    if (!profile) {

        return false;

    }


    const status =
        profile.status ||
        "Active";


    return SECURITY_CONFIG
        .allowedStatuses
        .includes(
            status
        );

}


/* ============================================================
   ROLE CHECK
   ============================================================ */

export function hasRole(
    profile,
    allowedRoles
) {

    if (
        !profile ||
        !Array.isArray(allowedRoles)
    ) {

        return false;

    }


    const role =
        String(
            profile.role ||
            ""
        )
        .trim()
        .toLowerCase();


    return allowedRoles.some(
        function(item) {

            return (
                String(item)
                    .trim()
                    .toLowerCase()
                ===
                role
            );

        }
    );

}


/* ============================================================
   OWNER CHECK
   ============================================================ */

export function isOwner(
    profile
) {

    return hasRole(
        profile,
        [
            "owner"
        ]
    );

}


/* ============================================================
   ADMIN CHECK
   ============================================================ */

export function isAdmin(
    profile
) {

    return hasRole(
        profile,
        [
            "admin",
            "owner"
        ]
    );

}


/* ============================================================
   STAFF CHECK
   ============================================================ */

export function isStaff(
    profile
) {

    return hasRole(
        profile,
        [
            "staff",
            "manager",
            "admin",
            "owner"
        ]
    );

}


/* ============================================================
   PROTECTED PAGE
   ============================================================ */

export async function protectPage(
    options = {}
) {

    const {

        allowedRoles = null,

        redirectToLogin = true,

        showLoading = true

    } = options;


    /*
     * Optional loading state
     */

    if (
        showLoading
    ) {

        showSecurityLoader();

    }


    /*
     * Wait for Firebase
     */

    const user =
        await waitForUser();


    /*
     * Not logged in
     */

    if (!user) {

        if (
            redirectToLogin
        ) {

            redirectToLoginPage();

        }

        return {

            allowed: false,

            reason: "not-authenticated"

        };

    }


    /*
     * Load profile
     */

    const profile =
        await getSecurityProfile(
            user
        );


    /*
     * Account disabled
     */

    if (
        !isAccountActive(
            profile
        )
    ) {

        showSecurityError(
            "Account Inactive",
            "Your account is currently inactive. Please contact the owner."
        );


        return {

            allowed: false,

            reason: "inactive-account",

            user,

            profile

        };

    }


    /*
     * Role validation
     */

    if (
        Array.isArray(
            allowedRoles
        ) &&
        allowedRoles.length > 0
    ) {

        if (
            !hasRole(
                profile,
                allowedRoles
            )
        ) {

            showSecurityError(
                "Access Restricted",
                "You do not have permission to access this section."
            );


            return {

                allowed: false,

                reason: "insufficient-role",

                user,

                profile

            };

        }

    }


    /*
     * Access granted
     */

    removeSecurityLoader();


    return {

        allowed: true,

        user,

        profile

    };

}


/* ============================================================
   REDIRECT LOGIN
   ============================================================ */

export function redirectToLoginPage() {

    const currentPath =
        window.location.pathname;


    /*
     * Avoid redirect loop if already on login.
     */

    if (
        currentPath
            .toLowerCase()
            .endsWith(
                "login.html"
            )
    ) {

        return;

    }


    window.location.href =
        SECURITY_CONFIG.loginPage;

}


/* ============================================================
   REDIRECT DASHBOARD
   ============================================================ */

export function redirectToDashboard() {

    window.location.href =
        SECURITY_CONFIG.dashboardPage;

}


/* ============================================================
   SECURITY LOADER
   ============================================================ */

function showSecurityLoader() {

    if (
        document.getElementById(
            "mmvSecurityLoader"
        )
    ) {

        return;

    }


    const loader =
        document.createElement(
            "div"
        );


    loader.id =
        "mmvSecurityLoader";


    loader.innerHTML = `

        <div class="mmv-security-loader-box">

            <div class="mmv-security-spinner"></div>

            <strong>
                Securing MMV Traders ERP
            </strong>

            <span>
                Verifying your access...
            </span>

        </div>

    `;


    document.body.appendChild(
        loader
    );


    addSecurityStyles();

}


/* ============================================================
   REMOVE LOADER
   ============================================================ */

function removeSecurityLoader() {

    const loader =
        document.getElementById(
            "mmvSecurityLoader"
        );


    if (loader) {

        loader.remove();

    }

}


/* ============================================================
   SECURITY ERROR SCREEN
   ============================================================ */

function showSecurityError(
    title,
    message
) {

    removeSecurityLoader();


    document.body.innerHTML = `

        <div class="mmv-security-page">

            <div class="mmv-security-card">

                <div class="mmv-security-icon">
                    !
                </div>

                <h1>
                    ${escapeHTML(title)}
                </h1>

                <p>
                    ${escapeHTML(message)}
                </p>

                <div class="mmv-security-actions">

                    <button
                        id="mmvSecurityBack"
                        type="button"
                    >
                        Go Back
                    </button>

                    <button
                        id="mmvSecurityHome"
                        type="button"
                    >
                        Dashboard
                    </button>

                </div>

                <small>
                    MMV Traders ERP V2
                </small>

            </div>

        </div>

    `;


    document
        .getElementById(
            "mmvSecurityBack"
        )
        ?.addEventListener(
            "click",
            function() {

                if (
                    window.history.length > 1
                ) {

                    window.history.back();

                }
                else {

                    redirectToDashboard();

                }

            }
        );


    document
        .getElementById(
            "mmvSecurityHome"
        )
        ?.addEventListener(
            "click",
            redirectToDashboard
        );


    addSecurityStyles();

}


/* ============================================================
   SECURITY STYLES
   Added dynamically so existing page CSS is untouched.
   ============================================================ */

function addSecurityStyles() {

    if (
        document.getElementById(
            "mmvSecurityStyles"
        )
    ) {

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "mmvSecurityStyles";


    style.textContent = `

        #mmvSecurityLoader{

            position:fixed;

            inset:0;

            z-index:99999;

            display:flex;

            align-items:center;

            justify-content:center;

            background:#f5f8fc;

        }


        .mmv-security-loader-box{

            width:min(
                340px,
                calc(100% - 30px)
            );

            padding:28px;

            border:1px solid #e2e8f0;

            border-radius:17px;

            background:#ffffff;

            box-shadow:
                0 20px 55px
                rgba(15,23,42,.10);

            text-align:center;

            font-family:
                Inter,
                system-ui,
                sans-serif;

        }


        .mmv-security-spinner{

            width:34px;

            height:34px;

            margin:
                0 auto 17px;

            border:
                3px solid
                #dbeafe;

            border-top-color:
                #0b3b82;

            border-radius:50%;

            animation:
                mmvSecuritySpin
                .75s
                linear
                infinite;

        }


        .mmv-security-loader-box strong{

            display:block;

            color:#14213d;

            font-size:14px;

        }


        .mmv-security-loader-box span{

            display:block;

            margin-top:6px;

            color:#64748b;

            font-size:10px;

        }


        .mmv-security-page{

            min-height:100vh;

            display:flex;

            align-items:center;

            justify-content:center;

            padding:20px;

            background:#f5f8fc;

            font-family:
                Inter,
                system-ui,
                sans-serif;

        }


        .mmv-security-card{

            width:min(
                430px,
                100%
            );

            padding:34px;

            border:
                1px solid
                #e2e8f0;

            border-radius:18px;

            background:#ffffff;

            box-shadow:
                0 20px 55px
                rgba(15,23,42,.09);

            text-align:center;

        }


        .mmv-security-icon{

            width:58px;

            height:58px;

            margin:
                0 auto 17px;

            display:flex;

            align-items:center;

            justify-content:center;

            border-radius:16px;

            background:#eff6ff;

            color:#0b3b82;

            font-size:25px;

            font-weight:800;

        }


        .mmv-security-card h1{

            margin:0;

            color:#14213d;

            font-size:22px;

            letter-spacing:-.025em;

        }


        .mmv-security-card p{

            margin:
                10px 0 22px;

            color:#64748b;

            font-size:11px;

            line-height:1.7;

        }


        .mmv-security-actions{

            display:grid;

            grid-template-columns:
                repeat(2,minmax(0,1fr));

            gap:8px;

        }


        .mmv-security-actions button{

            min-height:42px;

            border:
                1px solid
                #dbe3ed;

            border-radius:9px;

            background:#ffffff;

            color:#334155;

            font-size:10px;

            font-weight:800;

            cursor:pointer;

        }


        .mmv-security-actions button:last-child{

            border-color:#0b3b82;

            background:#0b3b82;

            color:#ffffff;

        }


        .mmv-security-card small{

            display:block;

            margin-top:20px;

            color:#94a3b8;

            font-size:8px;

        }


        @keyframes mmvSecuritySpin{

            to{

                transform:
                    rotate(360deg);

            }

        }


        @media(max-width:480px){

            .mmv-security-card{

                padding:25px;

            }

            .mmv-security-actions{

                grid-template-columns:1fr;

            }

        }

    `;


    document.head.appendChild(
        style
    );

}


/* ============================================================
   SAFE HTML
   ============================================================ */

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


/* ============================================================
   PAGE PROTECTION HELPERS
   ============================================================ */

/*
 * Normal authenticated page
 */

export async function protectAuthenticatedPage() {

    return protectPage();

}


/*
 * Owner only page
 */

export async function protectOwnerPage() {

    return protectPage({

        allowedRoles: [
            "owner"
        ]

    });

}


/*
 * Admin + Owner page
 */

export async function protectAdminPage() {

    return protectPage({

        allowedRoles: [
            "admin",
            "owner"
        ]

    });

}


/*
 * Staff + Manager + Admin + Owner
 */

export async function protectStaffPage() {

    return protectPage({

        allowedRoles: [
            "staff",
            "manager",
            "admin",
            "owner"
        ]

    });

}


/* ============================================================
   EXPORT SERVICE
   ============================================================ */

export default {

    getFirebaseUser,

    waitForUser,

    getSecurityProfile,

    isAccountActive,

    hasRole,

    isOwner,

    isAdmin,

    isStaff,

    protectPage,

    protectAuthenticatedPage,

    protectOwnerPage,

    protectAdminPage,

    protectStaffPage,

    redirectToLoginPage,

    redirectToDashboard

};


/* ============================================================
   READY
   ============================================================ */

console.info(
    "%cMMV Security Service%c ready",
    "font-weight:700;color:#0a3d91;",
    "color:inherit;"
);
