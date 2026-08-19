/* ============================================================
   MMV TRADERS ERP V2
   CUSTOMER SERVICE
   ============================================================ */

"use strict";

import {
    COLLECTIONS,
    createDocument,
    getDocument,
    updateDocument,
    deleteDocument,
    queryByField,
    getPaginated,
    getFirestoreError
} from "./firestore.js";


/* ============================================================
   CUSTOMER STATUS
   ============================================================ */

export const CUSTOMER_STATUS = Object.freeze({

    ACTIVE: "Active",

    INACTIVE: "Inactive"

});


/* ============================================================
   CREATE CUSTOMER
   ============================================================ */

export async function createCustomer(
    customerData
) {

    validateCustomer(
        customerData
    );


    const data = {

        customerCode:
            clean(
                customerData.customerCode
            ),

        name:
            clean(
                customerData.name
            ),

        mobile:
            clean(
                customerData.mobile
            ),

        alternateMobile:
            clean(
                customerData.alternateMobile
            ),

        email:
            clean(
                customerData.email
            ),

        address:
            clean(
                customerData.address
            ),

        city:
            clean(
                customerData.city
            ),

        state:
            clean(
                customerData.state
            ),

        gstNumber:
            clean(
                customerData.gstNumber
            ),

        creditLimit:
            numberValue(
                customerData.creditLimit
            ),

        creditDays:
            numberValue(
                customerData.creditDays
            ),

        openingBalance:
            numberValue(
                customerData.openingBalance
            ),

        balanceType:
            clean(
                customerData.balanceType
            ) || "Receivable",

        status:
            customerData.status ||
            CUSTOMER_STATUS.ACTIVE

    };


    try {

        /*
         * Prevent duplicate mobile number.
         */

        if (data.mobile) {

            const existing =
                await findCustomerByMobile(
                    data.mobile
                );


            if (existing) {

                throw new Error(
                    "A customer with this mobile number already exists."
                );

            }

        }


        const id =
            await createDocument(

                COLLECTIONS.customers,

                data

            );


        return {

            success: true,

            id

        };

    }
    catch(error) {

        console.error(
            "Create customer error:",
            error
        );


        return {

            success: false,

            message:
                getFirestoreError(
                    error
                )

        };

    }

}


/* ============================================================
   GET CUSTOMER
   ============================================================ */

export async function getCustomer(
    customerId
) {

    if (!customerId) {

        return null;

    }


    try {

        return await getDocument(

            COLLECTIONS.customers,

            customerId

        );

    }
    catch(error) {

        console.error(
            "Get customer error:",
            error
        );

        return null;

    }

}


/* ============================================================
   UPDATE CUSTOMER
   ============================================================ */

export async function updateCustomer(
    customerId,
    customerData
) {

    if (!customerId) {

        throw new Error(
            "Customer ID is required."
        );

    }


    validateCustomer(
        customerData
    );


    const data = {

        customerCode:
            clean(
                customerData.customerCode
            ),

        name:
            clean(
                customerData.name
            ),

        mobile:
            clean(
                customerData.mobile
            ),

        alternateMobile:
            clean(
                customerData.alternateMobile
            ),

        email:
            clean(
                customerData.email
            ),

        address:
            clean(
                customerData.address
            ),

        city:
            clean(
                customerData.city
            ),

        state:
            clean(
                customerData.state
            ),

        gstNumber:
            clean(
                customerData.gstNumber
            ),

        creditLimit:
            numberValue(
                customerData.creditLimit
            ),

        creditDays:
            numberValue(
                customerData.creditDays
            ),

        openingBalance:
            numberValue(
                customerData.openingBalance
            ),

        balanceType:
            clean(
                customerData.balanceType
            ) || "Receivable",

        status:
            customerData.status ||
            CUSTOMER_STATUS.ACTIVE

    };


    try {

        await updateDocument(

            COLLECTIONS.customers,

            customerId,

            data

        );


        return {

            success: true,

            id: customerId

        };

    }
    catch(error) {

        console.error(
            "Update customer error:",
            error
        );


        return {

            success: false,

            message:
                getFirestoreError(
                    error
                )

        };

    }

}


/* ============================================================
   DELETE CUSTOMER
   ============================================================ */

export async function deleteCustomer(
    customerId
) {

    if (!customerId) {

        throw new Error(
            "Customer ID is required."
        );

    }


    try {

        await deleteDocument(

            COLLECTIONS.customers,

            customerId

        );


        return {

            success: true

        };

    }
    catch(error) {

        console.error(
            "Delete customer error:",
            error
        );


        return {

            success: false,

            message:
                getFirestoreError(
                    error
                )

        };

    }

}


/* ============================================================
   FIND BY MOBILE
   ============================================================ */

export async function findCustomerByMobile(
    mobile
) {

    if (!mobile) {

        return null;

    }


    try {

        const results =
            await queryByField(

                COLLECTIONS.customers,

                "mobile",

                "==",

                clean(mobile),

                5

            );


        return results.length
            ? results[0]
            : null;

    }
    catch(error) {

        console.error(
            "Customer mobile search error:",
            error
        );


        return null;

    }

}


/* ============================================================
   FIND BY CUSTOMER CODE
   ============================================================ */

export async function findCustomerByCode(
    customerCode
) {

    if (!customerCode) {

        return null;

    }


    try {

        const results =
            await queryByField(

                COLLECTIONS.customers,

                "customerCode",

                "==",

                clean(customerCode),

                5

            );


        return results.length
            ? results[0]
            : null;

    }
    catch(error) {

        console.error(
            "Customer code search error:",
            error
        );


        return null;

    }

}


/* ============================================================
   ACTIVE CUSTOMERS
   ============================================================ */

export async function getActiveCustomers(
    limitCount = 100
) {

    try {

        return await queryByField(

            COLLECTIONS.customers,

            "status",

            "==",

            CUSTOMER_STATUS.ACTIVE,

            limitCount

        );

    }
    catch(error) {

        console.error(
            "Active customers error:",
            error
        );


        return [];

    }

}


/* ============================================================
   PAGINATED CUSTOMERS
   ============================================================ */

export async function getCustomersPage(
    options = {}
) {

    try {

        return await getPaginated(

            COLLECTIONS.customers,

            {

                pageSize:
                    options.pageSize ||
                    25,

                orderField:
                    options.orderField ||
                    "createdAt",

                direction:
                    options.direction ||
                    "desc",

                lastDocument:
                    options.lastDocument ||
                    null

            }

        );

    }
    catch(error) {

        console.error(
            "Customer pagination error:",
            error
        );


        return {

            records: [],

            lastDocument: null,

            hasMore: false,

            error:
                getFirestoreError(
                    error
                )

        };

    }

}


/* ============================================================
   CUSTOMER VALIDATION
   ============================================================ */

function validateCustomer(
    data
) {

    if (!data) {

        throw new Error(
            "Customer information is required."
        );

    }


    if (
        !clean(
            data.name
        )
    ) {

        throw new Error(
            "Customer name is required."
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
        data.email &&
        !isValidEmail(
            data.email
        )
    ) {

        throw new Error(
            "Please enter a valid email address."
        );

    }


    if (
        data.creditLimit !== undefined &&
        Number(data.creditLimit) < 0
    ) {

        throw new Error(
            "Credit limit cannot be negative."
        );

    }


    if (
        data.creditDays !== undefined &&
        Number(data.creditDays) < 0
    ) {

        throw new Error(
            "Credit days cannot be negative."
        );

    }

}


/* ============================================================
   HELPERS
   ============================================================ */

function clean(
    value
) {

    return String(
        value ?? ""
    ).trim();

}


function numberValue(
    value
) {

    const number =
        Number(
            value
        );


    return Number.isFinite(
        number
    )
        ? number
        : 0;

}


function isValidMobile(
    mobile
) {

    const value =
        clean(mobile)
        .replace(
            /\s+/g,
            ""
        );


    return /^[6-9]\d{9}$/.test(
        value
    );

}


function isValidEmail(
    email
) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        clean(email)
    );

}


/* ============================================================
   DEFAULT EXPORT
   ============================================================ */

export default {

    createCustomer,

    getCustomer,

    updateCustomer,

    deleteCustomer,

    findCustomerByMobile,

    findCustomerByCode,

    getActiveCustomers,

    getCustomersPage

};


/* ============================================================
   READY
   ============================================================ */

console.info(
    "%cMMV Customer Service%c ready",
    "font-weight:700;color:#0b3b82;",
    "color:inherit;"
);
