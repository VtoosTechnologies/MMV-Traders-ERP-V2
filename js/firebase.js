/* ============================================================
   MMV TRADERS ERP V2
   FIREBASE CORE
   Production Firebase Configuration
   ============================================================ */

"use strict";

import {
    initializeApp,
    getApps,
    getApp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


/* ============================================================
   FIREBASE PROJECT CONFIG
   ============================================================

   IMPORTANT:
   Keezh irukkura values-la
   NAMMA ALREADY EXISTING FIREBASE PROJECT
   config values-ai exactly paste pannunga.

   Firebase Console:
   Project Settings
   → General
   → Your apps
   → Web app
   → SDK setup and configuration
   ============================================================ */

const firebaseConfig = {

    apiKey: "PASTE_EXISTING_API_KEY",

    authDomain:
        "PASTE_EXISTING_AUTH_DOMAIN",

    projectId:
        "PASTE_EXISTING_PROJECT_ID",

    storageBucket:
        "PASTE_EXISTING_STORAGE_BUCKET",

    messagingSenderId:
        "PASTE_EXISTING_MESSAGING_SENDER_ID",

    appId:
        "PASTE_EXISTING_APP_ID"

};


/* ============================================================
   INITIALIZE FIREBASE
   ============================================================ */

const app =
    getApps().length > 0
        ? getApp()
        : initializeApp(
            firebaseConfig
        );


/* ============================================================
   FIREBASE SERVICES
   ============================================================ */

const auth =
    getAuth(app);

const db =
    getFirestore(app);


/* ============================================================
   EXPORT
   ============================================================ */

export {
    app,
    auth,
    db,
    firebaseConfig
};


/* ============================================================
   GLOBAL DEBUG
   ============================================================ */

console.info(
    "%cMMV Traders ERP V2%c Firebase initialized",
    "font-weight:700;color:#0a3d91;",
    "color:inherit;"
);
