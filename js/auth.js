/* ============================================================
   MMV TRADERS ERP V2
   AUTHENTICATION SERVICE
   ------------------------------------------------------------
   Firebase Authentication
   User Profile Validation
   Active / Inactive Check
   Login
   Logout
   Session State
   Role Redirect
   ============================================================ */

"use strict";

import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from
"https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    doc,
    getDoc
} from
"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
    auth,
    db
} from "./firebase.js";


/* ============================================================
   CONFIG
   ============================================================ */

const USERS_COLLECTION =
    "users";

const LOGIN_PAGE =
    "index.html";

const DASHBOARD_PAGE =
    "dashboard.html";


/* ============================================================
   STATE
   ============================================================ */

const authState = {

    user:
        null,

    profile:
        null,

    initialized:
        false,

    loading:
        false

};


/* ============================================================
   HELPERS
   ============================================================ */

function authEl(id) {

    return document.getElementById(
        id
    );

}


function clean(value) {

    return String(
        value ?? ""
    ).trim();

}


function getCurrentFirebaseUser() {

    return auth?.currentUser ||
        null;

}


/* ============================================================
   GET USER PROFILE
   ============================================================ */

async function getUserProfile(
    uid
) {

    if (!uid) {

        return null;

    }


    const reference =
        doc(
            db,
            USERS_COLLECTION,
            uid
        );


    const snapshot =
        await getDoc(
            reference
        );


    if (
        !snapshot.exists()
    ) {

        return null;

    }


    return {

        id:
            snapshot.id,

        ...snapshot.data()

    };

}


/* ============================================================
   CHECK USER ACCESS
   ============================================================ */

function isProfileActive(
    profile
) {

    if (!profile) {

        return false;

    }


    return (
        clean(
            profile.status
        ).toUpperCase() ===
        "ACTIVE"
    );

}


/* ============================================================
   LOGIN
   ============================================================ */

async function login(
    email,
    password
) {

    if (
        authState.loading
    ) {

        return false;

    }


    const loginEmail =
        clean(
            email
        ).toLowerCase();


    const loginPassword =
        String(
            password ?? ""
        );


    if (!loginEmail) {

        showAuthMessage(
            "Please enter your email address.",
            "error"
        );

        return false;

    }


    if (!loginPassword) {

        showAuthMessage(
            "Please enter your password.",
            "error"
        );

        return false;

    }


    try {

        authState.loading =
            true;


        setLoginLoading(
            true
        );


        const credential =
            await signInWithEmailAndPassword(
                auth,
                loginEmail,
                loginPassword
            );


        const firebaseUser =
            credential.user;


        const profile =
            await getUserProfile(
                firebaseUser.uid
            );


        /*
         * Firebase account exists,
         * but ERP profile does not.
         */

        if (!profile) {

            await signOut(
                auth
            );


            showAuthMessage(
                "Your account is not configured for MMV Traders ERP. Please contact the administrator.",
                "error"
            );


            return false;

        }


        /*
         * Inactive users cannot access ERP.
         */

        if (
            !isProfileActive(
                profile
            )
        ) {

            await signOut(
                auth
            );


            showAuthMessage(
                "Your ERP account is inactive. Please contact the administrator.",
                "error"
            );


            return false;

        }


        authState.user =
            firebaseUser;


        authState.profile =
            profile;


        window.MMVAuthUser = {

            firebaseUser,

            profile

        };


        showAuthMessage(
            "Login successful. Opening dashboard...",
            "success"
        );


        setTimeout(
            () => {

                redirectToDashboard();

            },
            400
        );


        return true;

    }
    catch(error) {

        console.error(
            "Login error:",
            error
        );


        showAuthMessage(
            getAuthErrorMessage(
                error
            ),
            "error"
        );


        return false;

    }
    finally {

        authState.loading =
            false;


        setLoginLoading(
            false
        );

    }

}


/* ============================================================
   LOGOUT
   ============================================================ */

async function logout() {

    try {

        await signOut(
            auth
        );


        authState.user =
            null;


        authState.profile =
            null;


        window.MMVAuthUser =
            null;


        redirectToLogin();


    }
    catch(error) {

        console.error(
            "Logout error:",
            error
        );


        showAuthMessage(
            "Unable to logout. Please try again.",
            "error"
        );

    }

}


/* ============================================================
   SESSION CHECK
   ============================================================ */

async function checkSession() {

    const firebaseUser =
        getCurrentFirebaseUser();


    if (!firebaseUser) {

        return null;

    }


    try {

        const profile =
            await getUserProfile(
                firebaseUser.uid
            );


        if (!profile) {

            await signOut(
                auth
            );


            return null;

        }


        if (
            !isProfileActive(
                profile
            )
        ) {

            await signOut(
                auth
            );


            return null;

        }


        authState.user =
            firebaseUser;


        authState.profile =
            profile;


        window.MMVAuthUser = {

            firebaseUser,

            profile

        };


        return {

            firebaseUser,

            profile

        };

    }
    catch(error) {

        console.error(
            "Session validation error:",
            error
        );


        return null;

    }

}


/* ============================================================
   PROTECTED PAGE
   ============================================================ */

async function protectPage() {

    /*
     * Wait until Firebase resolves
     * its authentication state.
     */

    return new Promise(
        resolve => {

            const unsubscribe =
                onAuthStateChanged(
                    auth,
                    async firebaseUser => {

                        unsubscribe();


                        if (!firebaseUser) {

                            redirectToLogin();

                            resolve(
                                false
                            );

                            return;

                        }


                        const session =
                            await checkSession();


                        if (!session) {

                            redirectToLogin();

                            resolve(
                                false
                            );

                            return;

                        }


                        resolve(
                            true
                        );

                    }
                );

        }
    );

}


/* ============================================================
   LOGIN PAGE GUARD
   ============================================================ */

async function protectLoginPage() {

    return new Promise(
        resolve => {

            const unsubscribe =
                onAuthStateChanged(
                    auth,
                    async firebaseUser => {

                        unsubscribe();


                        if (!firebaseUser) {

                            resolve(
                                false
                            );

                            return;

                        }


                        const session =
                            await checkSession();


                        if (session) {

                            redirectToDashboard();

                            resolve(
                                true
                            );

                            return;

                        }


                        resolve(
                            false
                        );

                    }
                );

        }
    );

}


/* ============================================================
   REDIRECT DASHBOARD
   ============================================================ */

function redirectToDashboard() {

    if (
        window.location.pathname
            .endsWith(
                "dashboard.html"
            )
    ) {

        return;

    }


    window.location.href =
        DASHBOARD_PAGE;

}


/* ============================================================
   REDIRECT LOGIN
   ============================================================ */

function redirectToLogin() {

    if (
        window.location.pathname
            .endsWith(
                LOGIN_PAGE
            ) ||
        window.location.pathname ===
        "/"
    ) {

        return;

    }


    window.location.href =
        LOGIN_PAGE;

}


/* ============================================================
   LOGIN FORM
   ============================================================ */

function bindLoginForm() {

    const form =
        authEl(
            "loginForm"
        );


    if (!form) {

        return;

    }


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const email =
                authEl(
                    "email"
                )?.value ||
                authEl(
                    "loginEmail"
                )?.value ||
                "";


            const password =
                authEl(
                    "password"
                )?.value ||
                authEl(
                    "loginPassword"
                )?.value ||
                "";


            await login(
                email,
                password
            );

        }
    );

}


/* ============================================================
   LOGOUT BUTTONS
   ============================================================ */

function bindLogoutButtons() {

    document
        .querySelectorAll(
            "[data-logout]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async event => {

                        event.preventDefault();

                        await logout();

                    }
                );

            }
        );

}


/* ============================================================
   LOGIN LOADING
   ============================================================ */

function setLoginLoading(
    loading
) {

    const buttons =
        document.querySelectorAll(
            "[data-login-submit]"
        );


    buttons.forEach(
        button => {

            button.disabled =
                loading;


            if (
                loading
            ) {

                button.dataset
                    .originalText =
                    button.textContent;


                button.textContent =
                    "Signing in...";

            }
            else {

                button.textContent =
                    button.dataset
                        .originalText ||
                    "Sign In";

            }

        }
    );

}


/* ============================================================
   AUTH MESSAGE
   ============================================================ */

function showAuthMessage(
    message,
    type = "info"
) {

    let box =
        authEl(
            "authMessage"
        );


    if (!box) {

        box =
            document.createElement(
                "div"
            );


        box.id =
            "authMessage";


        Object.assign(
            box.style,
            {

                marginTop:
                    "14px",

                padding:
                    "12px 14px",

                borderRadius:
                    "10px",

                fontSize:
                    "13px",

                fontWeight:
                    "600"

            }
        );


        const form =
            authEl(
                "loginForm"
            );


        if (form) {

            form.appendChild(
                box
            );

        }
        else {

            document.body.appendChild(
                box
            );

        }

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

}


/* ============================================================
   FIREBASE AUTH ERROR MESSAGES
   ============================================================ */

function getAuthErrorMessage(
    error
) {

    const code =
        String(
            error?.code ||
            ""
        );


    switch (
        code
    ) {

        case
        "auth/invalid-credential":

            return "Invalid email or password.";

        case
        "auth/invalid-email":

            return "Please enter a valid email address.";

        case
        "auth/user-disabled":

            return "This Firebase account has been disabled.";

        case
        "auth/too-many-requests":

            return "Too many unsuccessful attempts. Please try again later.";

        case
        "auth/network-request-failed":

            return "Network error. Please check your internet connection.";

        default:

            return (
                error?.message ||
                "Unable to sign in."
            );

    }

}


/* ============================================================
   CURRENT USER API
   ============================================================ */

function getCurrentUser() {

    return {

        firebaseUser:
            authState.user,

        profile:
            authState.profile

    };

}


/* ============================================================
   ROLE
   ============================================================ */

function getCurrentRole() {

    return (
        authState
            .profile
            ?.role ||
        null
    );

}


/* ============================================================
   AUTHENTICATED CHECK
   ============================================================ */

function isAuthenticated() {

    return Boolean(
        authState.user &&
        authState.profile
    );

}


/* ============================================================
   DOM READY
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        bindLoginForm();

        bindLogoutButtons();


        /*
         * Login page:
         * don't allow already logged-in
         * users to remain on login screen.
         */

        const isLoginPage =
            window.location.pathname
                .endsWith(
                    LOGIN_PAGE
                ) ||
            window.location.pathname ===
            "/";


        if (
            isLoginPage
        ) {

            await protectLoginPage();

        }

    }
);


/* ============================================================
   GLOBAL AUTH API
   ============================================================ */

window.MMAuth = {

    login,

    logout,

    checkSession,

    protectPage,

    protectLoginPage,

    getCurrentUser,

    getCurrentRole,

    isAuthenticated,

    getUserProfile,

    isProfileActive

};


window.login =
    login;


window.logout =
    logout;


window.protectPage =
    protectPage;


console.info(
    "%cMMV Authentication V2%c ready",
    "font-weight:800;color:#0a3d91;",
    "color:inherit;"
);
export {
    login,
    logout,
    checkSession,
    protectPage,
    protectLoginPage,
    getCurrentUser,
    getCurrentRole,
    isAuthenticated,
    getUserProfile,
    isProfileActive
};
