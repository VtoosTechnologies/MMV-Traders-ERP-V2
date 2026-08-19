/* ============================================================
   MMV TRADERS ERP V2
   FIRESTORE DATA SERVICE
   Production Data Access Layer
   ============================================================ */

"use strict";

import {
    collection,
    doc,
    addDoc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
    db
} from "./firebase.js";


/* ============================================================
   COLLECTIONS
   ============================================================ */

export const COLLECTIONS = Object.freeze({

    customers: "customers",
    suppliers: "suppliers",
    materials: "materials",
    inventory: "inventory",
    purchases: "purchases",
    sales: "sales",
    payments: "payments",
    accounts: "accounts",
    users: "users",
    settings: "settings"

});


/* ============================================================
   COLLECTION REFERENCE
   ============================================================ */

function collectionRef(
    collectionName
) {

    return collection(
        db,
        collectionName
    );

}


/* ============================================================
   DOCUMENT REFERENCE
   ============================================================ */

function documentRef(
    collectionName,
    documentId
) {

    return doc(
        db,
        collectionName,
        documentId
    );

}


/* ============================================================
   GET SINGLE DOCUMENT
   ============================================================ */

export async function getDocument(
    collectionName,
    documentId
) {

    if (
        !collectionName ||
        !documentId
    ) {

        throw new Error(
            "Collection name and document ID are required."
        );

    }

    const snapshot =
        await getDoc(
            documentRef(
                collectionName,
                documentId
            )
        );


    if (!snapshot.exists()) {

        return null;

    }


    return {

        id: snapshot.id,

        ...snapshot.data()

    };

}


/* ============================================================
   CREATE DOCUMENT
   ============================================================ */

export async function createDocument(
    collectionName,
    data,
    customId = null
) {

    if (
        !collectionName ||
        !data
    ) {

        throw new Error(
            "Collection name and data are required."
        );

    }


    const payload = {

        ...data,

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp()

    };


    /*
     * Custom document ID
     */

    if (customId) {

        await setDoc(

            documentRef(
                collectionName,
                customId
            ),

            payload

        );

        return customId;

    }


    /*
     * Automatic Firestore ID
     */

    const reference =
        await addDoc(

            collectionRef(
                collectionName
            ),

            payload

        );


    return reference.id;

}


/* ============================================================
   UPDATE DOCUMENT
   ============================================================ */

export async function updateDocument(
    collectionName,
    documentId,
    data
) {

    if (
        !collectionName ||
        !documentId ||
        !data
    ) {

        throw new Error(
            "Collection, document ID and data are required."
        );

    }


    await updateDoc(

        documentRef(
            collectionName,
            documentId
        ),

        {

            ...data,

            updatedAt:
                serverTimestamp()

        }

    );


    return true;

}


/* ============================================================
   DELETE DOCUMENT
   ============================================================ */

export async function deleteDocument(
    collectionName,
    documentId
) {

    if (
        !collectionName ||
        !documentId
    ) {

        throw new Error(
            "Collection and document ID are required."
        );

    }


    await deleteDoc(

        documentRef(
            collectionName,
            documentId
        )

    );


    return true;

}


/* ============================================================
   GET COLLECTION
   ============================================================

   Use only for small/master collections.

   Do NOT use this blindly for large transaction collections.
   ============================================================ */

export async function getCollection(
    collectionName
) {

    const snapshot =
        await getDocs(

            collectionRef(
                collectionName
            )

        );


    return snapshot.docs.map(
        function (item) {

            return {

                id: item.id,

                ...item.data()

            };

        }
    );

}


/* ============================================================
   QUERY BY FIELD
   ============================================================ */

export async function queryByField(
    collectionName,
    field,
    operator,
    value,
    resultLimit = 50
) {

    const constraints = [

        where(
            field,
            operator,
            value
        ),

        limit(
            resultLimit
        )

    ];


    const q =
        query(

            collectionRef(
                collectionName
            ),

            ...constraints

        );


    const snapshot =
        await getDocs(q);


    return snapshot.docs.map(
        function (item) {

            return {

                id: item.id,

                ...item.data()

            };

        }
    );

}


/* ============================================================
   GET ACTIVE RECORDS
   ============================================================ */

export async function getActiveRecords(
    collectionName,
    resultLimit = 100
) {

    return queryByField(

        collectionName,

        "status",

        "==",

        "Active",

        resultLimit

    );

}


/* ============================================================
   SEARCH BY EXACT FIELD
   ============================================================ */

export async function findByField(
    collectionName,
    field,
    value
) {

    const results =
        await queryByField(

            collectionName,

            field,

            "==",

            value,

            10

        );


    return results.length > 0
        ? results[0]
        : null;

}


/* ============================================================
   PAGINATED COLLECTION
   ============================================================ */

export async function getPaginated(
    collectionName,
    options = {}
) {

    const {

        pageSize = 25,

        orderField = "createdAt",

        direction = "desc",

        lastDocument = null

    } = options;


    const constraints = [];


    /*
     * Ordering
     */

    constraints.push(

        orderBy(
            orderField,
            direction
        )

    );


    /*
     * Continue from previous page
     */

    if (lastDocument) {

        constraints.push(

            startAfter(
                lastDocument
            )

        );

    }


    /*
     * Limit
     */

    constraints.push(

        limit(
            pageSize
        )

    );


    const q =
        query(

            collectionRef(
                collectionName
            ),

            ...constraints

        );


    const snapshot =
        await getDocs(q);


    const records =
        snapshot.docs.map(
            function (item) {

                return {

                    id: item.id,

                    ...item.data()

                };

            }
        );


    const lastVisible =
        snapshot.docs.length > 0
            ? snapshot.docs[
                snapshot.docs.length - 1
            ]
            : null;


    return {

        records,

        lastDocument:
            lastVisible,

        hasMore:
            snapshot.docs.length ===
            pageSize

    };

}


/* ============================================================
   BATCH WRITE
   ============================================================ */

export async function batchWrite(
    operations
) {

    if (
        !Array.isArray(operations) ||
        operations.length === 0
    ) {

        throw new Error(
            "Batch operations are required."
        );

    }


    const batch =
        writeBatch(db);


    operations.forEach(
        function (operation) {

            if (
                !operation.collection ||
                !operation.id ||
                !operation.data
            ) {

                throw new Error(
                    "Invalid batch operation."
                );

            }


            const reference =
                documentRef(

                    operation.collection,

                    operation.id

                );


            if (
                operation.type ===
                "delete"
            ) {

                batch.delete(
                    reference
                );

                return;

            }


            if (
                operation.type ===
                "update"
            ) {

                batch.update(

                    reference,

                    {

                        ...operation.data,

                        updatedAt:
                            serverTimestamp()

                    }

                );

                return;

            }


            batch.set(

                reference,

                {

                    ...operation.data,

                    createdAt:
                        serverTimestamp(),

                    updatedAt:
                        serverTimestamp()

                },

                {
                    merge: true
                }

            );

        }
    );


    await batch.commit();


    return true;

}


/* ============================================================
   SAFE ERROR HANDLER
   ============================================================ */

export function getFirestoreError(
    error
) {

    if (!error) {

        return "Unknown database error.";

    }


    console.error(
        "MMV Firestore Error:",
        error
    );


    const code =
        error.code || "";


    const messages = {

        "permission-denied":
            "You do not have permission to perform this action.",

        "not-found":
            "The requested record was not found.",

        "already-exists":
            "This record already exists.",

        "unavailable":
            "Database temporarily unavailable. Please try again.",

        "failed-precondition":
            "This operation requires additional database configuration."

    };


    return (
        messages[code] ||
        "Unable to complete the database operation."
    );

}


/* ============================================================
   EXPORT DEFAULT SERVICE
   ============================================================ */

export default {

    COLLECTIONS,

    getDocument,

    createDocument,

    updateDocument,

    deleteDocument,

    getCollection,

    queryByField,

    findByField,

    getActiveRecords,

    getPaginated,

    batchWrite,

    getFirestoreError

};


/* ============================================================
   READY
   ============================================================ */

console.info(
    "%cMMV Firestore Service%c ready",
    "font-weight:700;color:#0a3d91;",
    "color:inherit;"
);
