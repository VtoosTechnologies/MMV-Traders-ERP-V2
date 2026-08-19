/* ============================================================
   MMV TRADERS ERP V2
   AUTHENTICATION SERVICE
   Production Authentication Layer
   ============================================================ */

"use strict";

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    setPersistence,
    browserLocalPersistence
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
   APPLICATION SETTINGS
   ============================================================ */

export const AUTH_CONFIG = Object.freeze({

    loginPage: "/login.html",

    homePage: "/index.html",

    defaultRole: "owner",

    sessionKey: "mmv_auth_session"

});


/* ============================================================
   ENABLE LOCAL SESSION
   ============================================================ */

export async function initializeAuth() {

    try {

        await setPersistence(
            auth,
            browserLocalPersistence
        );

        return true;

    } catch (error) {

        console.error(
            "MMV Auth persistence error:",
            error
        );

        return false;

    }

}


/* ============================================================
   GET USER PROFILE
   ============================================================ */

export async function getUserProfile(
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


        if (
            snapshot.exists()
        ) {

            return {

                uid: user.uid,

                email:
                    user.email || "",

                ...snapshot.data()

            };

        }


        /*
         * If profile document does not exist,
         * create a safe default application profile
         * in memory only.
         */

        return {

            uid: user.uid,

            email:
                user.email || "",

            role:
                AUTH_CONFIG.defaultRole,

            name:
                user.displayName ||
                "MMV Owner",

            status:
                "Active"

        };

    } catch (error) {

        console.error(
            "Unable to load user profile:",
            error
        );


        return {

            uid: user.uid,

            email:
                user.email || "",

            role:
                AUTH_CONFIG.defaultRole,

            name:
                user.displayName ||
                "MMV Owner",

            status:
                "Active"

        };

    }

}


/* ============================================================
   LOGIN
   ============================================================ */

export async function login(
    email,
    password
) {

    if (!email || !password) {

        return {

            success: false,

            message:
                "Email and password are required."

        };

    }


    try {

        await initializeAuth();


        const credential =
            await signInWithEmailAndPassword(

                auth,

                email.trim(),

                password

            );


        const user =
            credential.user;


        const profile =
            await getUserProfile(
                user
            );


        /*
         * Application-level status check
         */

        if (
            profile &&
            profile.status &&
            profile.status !== "Active"
        ) {

            await signOut(auth);


            return {

                success: false,

                message:
                    "Your account is inactive. Please contact the owner."

            };

        }


        /*
         * Save lightweight session information.
         *
         * Do NOT store password.
         */

        localStorage.setItem(

            AUTH_CONFIG.sessionKey,

            JSON.stringify({

                uid:
                    user.uid,

                email:
                    user.email || "",

                role:
                    profile?.role ||
                    AUTH_CONFIG.defaultRole,

                name:
                    profile?.name ||
                    "MMV Owner",

                loginAt:
                    Date.now()

            })

        );


        return {

            success: true,

            user,

            profile

        };

    } catch (error) {

        console.error(
            "MMV Login Error:",
            error
        );


        return {

            success: false,

            message:
                getAuthErrorMessage(
                    error
                )

        };

    }

}


/* ============================================================
   LOGOUT
   ============================================================ */

export async function logout() {

    try {

        await signOut(
            auth
        );

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

    } finally {

        localStorage.removeItem(
            AUTH_CONFIG.sessionKey
        );

        sessionStorage.clear();

        window.location.href =
            AUTH_CONFIG.loginPage;

    }

}


/* ============================================================
   CURRENT USER
   ============================================================ */

export function getCurrentUser() {

    return auth.currentUser || null;

}


/* ============================================================
   WAIT FOR AUTH STATE
   ============================================================ */

export function waitForAuth() {

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
   REQUIRE LOGIN
   ============================================================

   Use this on protected ERP pages.
   ============================================================ */

export async function requireAuth(
    options = {}
) {

    const {

        redirect = true,

        allowedRoles = null

    } = options;


    await initializeAuth();


    const user =
        await waitForAuth();


    if (!user) {

        if (redirect) {

            window.location.href =
                AUTH_CONFIG.loginPage;

        }

        return null;

    }


    const profile =
        await getUserProfile(
            user
        );


    /*
     * Check account status
     */

    if (
        profile &&
        profile.status &&
        profile.status !== "Active"
    ) {

        await logout();

        return null;

    }


    /*
     * Role protection
     */

    if (
        Array.isArray(
            allowedRoles
        ) &&
        allowedRoles.length > 0
    ) {

        const userRole =
            profile?.role ||
            AUTH_CONFIG.defaultRole;


        if (
            !allowedRoles.includes(
                userRole
            )
        ) {

            showAccessDenied();

            return null;

        }

    }


    return {

        user,

        profile

    };

}


/* ============================================================
   REQUIRE OWNER
   ============================================================ */

export async function requireOwner() {

    return requireAuth({

        allowedRoles: [
            "owner",
            "admin"
        ]

    });

}


/* ============================================================
   ACCESS DENIED
   ============================================================ */

function showAccessDenied() {

    document.body.innerHTML = `

        <div style="
            min-height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:24px;
            background:#f4f7fb;
            font-family:Inter,Arial,sans-serif;
        ">

            <div style="
                width:min(420px,100%);
                padding:36px;
                background:#ffffff;
                border:1px solid #e2e8f0;
                border-radius:18px;
                text-align:center;
                box-shadow:0 18px 50px rgba(15,23,42,.10);
            ">

                <div style="
                    width:58px;
                    height:58px;
                    margin:0 auto 18px;
                    border-radius:16px;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    background:#eff6ff;
                    color:#0a3d91;
                    font-size:28px;
                    font-weight:700;
                ">
                    !
                </div>

                <h2 style="
                    margin:0 0 10px;
                    color:#0f172a;
                ">
                    Access Restricted
                </h2>

                <p style="
                    margin:0 0 22px;
                    color:#64748b;
                    line-height:1.6;
                ">
                    You do not have permission to access
                    this section of MMV Traders ERP.
                </p>

                <button
                    onclick="history.back()"
                    style="
                        border:0;
                        border-radius:10px;
                        padding:11px 20px;
                        background:#0a3d91;
                        color:#ffffff;
                        font-weight:700;
                        cursor:pointer;
                    "
                >
                    Go Back
                </button>

            </div>

        </div>

    `;

}


/* ============================================================
   AUTH ERROR MESSAGES
   ============================================================ */

function getAuthErrorMessage(
    error
) {

    const code =
        error?.code || "";


    const messages = {

        "auth/invalid-credential":
            "Invalid email or password.",

        "auth/invalid-email":
            "Please enter a valid email address.",

        "auth/user-disabled":
            "This account has been disabled.",

        "auth/user-not-found":
            "Invalid email or password.",

        "auth/wrong-password":
            "Invalid email or password.",

        "auth/too-many-requests":
            "Too many attempts. Please try again later.",

        "auth/network-request-failed":
            "Network error. Please check your internet connection."

    };


    return (

        messages[code] ||

        "Unable to sign in. Please try again."

    );

}


/* ============================================================
   SESSION INFORMATION
   ============================================================ */

export function getStoredSession() {

    try {

        const data =
            localStorage.getItem(
                AUTH_CONFIG.sessionKey
            );


        if (!data) {

            return null;

        }


        return JSON.parse(
            data
        );

    } catch {

        localStorage.removeItem(
            AUTH_CONFIG.sessionKey
        );

        return null;

    }

}


/* ============================================================
   AUTO LOGOUT HELPER
   ============================================================ */

export function clearLocalSession() {

    localStorage.removeItem(
        AUTH_CONFIG.sessionKey
    );

    sessionStorage.clear();

}


/* ============================================================
   SERVICE EXPORT
   ============================================================ */

export default {

    initializeAuth,

    login,

    logout,

    getCurrentUser,

    getUserProfile,

    waitForAuth,

    requireAuth,

    requireOwner,

    getStoredSession,

    clearLocalSession

};


/* ============================================================
   READY
   ============================================================ */

console.info(
    "%cMMV Auth Service%c ready",
    "font-weight:700;color:#0a3d91;",
    "color:inherit;"
);
