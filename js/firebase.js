/* ============================================================
   MMV TRADERS ERP V2
   FIREBASE CORE CONFIGURATION
   ============================================================ */

"use strict";


/* ============================================================
   FIREBASE APP
   ============================================================ */

import {
    initializeApp
} from
    "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";


/* ============================================================
   FIREBASE AUTHENTICATION
   ============================================================ */

import {
    getAuth
} from
    "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";


/* ============================================================
   FIRESTORE
   ============================================================ */

import {
    getFirestore
} from
    "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


/* ============================================================
   FIREBASE CONFIGURATION
   ============================================================ */

const firebaseConfig = {

    apiKey:
        "AIzaSyDYU43yaApPBU-GFxfMtnfST-ZJRu8Vg_E",

    authDomain:
        "mmv-traders-erp-v2.firebaseapp.com",

    projectId:
        "mmv-traders-erp-v2",

    storageBucket:
        "mmv-traders-erp-v2.firebasestorage.app",

    messagingSenderId:
        "345950984944",

    appId:
        "1:345950984944:web:2a456b89f42f31ea2bc035"

};


/* ============================================================
   INITIALIZE FIREBASE
   ============================================================ */

const app =
    initializeApp(
        firebaseConfig
    );


/* ============================================================
   INITIALIZE AUTH
   ============================================================ */

const auth =
    getAuth(
        app
    );


/* ============================================================
   INITIALIZE FIRESTORE
   ============================================================ */

const db =
    getFirestore(
        app
    );


/* ============================================================
   GLOBAL DEBUG REFERENCE
   ------------------------------------------------------------
   Useful during development.
   ============================================================ */

window.MMVFirebase = {

    app,

    auth,

    db

};


/* ============================================================
   EXPORTS
   ============================================================ */

export {

    app,

    auth,

    db,

    firebaseConfig

};


console.info(
    "%cMMV Traders ERP V2%c Firebase initialized successfully.",
    "font-weight:800;color:#0b3b82;",
    "color:inherit;"
);
