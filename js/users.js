/* ============================================================
   MMV TRADERS ERP V2
   USERS & ROLE MANAGEMENT SERVICE
   ============================================================ */

"use strict";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    serverTimestamp
} from
"https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
    auth,
    db
} from "./firebase.js";

import {
    onAuthStateChanged
} from
"https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";


/* ============================================================
   CONFIG
   ============================================================ */

const USERS_COLLECTION =
    "users";


/* ============================================================
   ROLES
   ============================================================ */

const USER_ROLES = {

    ADMIN:
        "ADMIN",

    MANAGER:
        "MANAGER",

    STAFF:
        "STAFF"

};


/* ============================================================
   DEFAULT PERMISSIONS
   ============================================================ */

const DEFAULT_PERMISSIONS = {

    dashboard:
        true,

    customers:
        true,

    suppliers:
        true,

    inventory:
        true,

    sales:
        true,

    purchases:
        true,

    payments:
        true,

    reports:
        false,

    settings:
        false,

    users:
        false,

    deleteRecords:
        false,

    exportData:
        false

};


/* ============================================================
   ROLE PERMISSIONS
   ============================================================ */

const ROLE_PERMISSIONS = {

    ADMIN: {

        dashboard:
            true,

        customers:
            true,

        suppliers:
            true,

        inventory:
            true,

        sales:
            true,

        purchases:
            true,

        payments:
            true,

        reports:
            true,

        settings:
            true,

        users:
            true,

        deleteRecords:
            true,

        exportData:
            true

    },


    MANAGER: {

        dashboard:
            true,

        customers:
            true,

        suppliers:
            true,

        inventory:
            true,

        sales:
            true,

        purchases:
            true,

        payments:
            true,

        reports:
            true,

        settings:
            false,

        users:
            false,

        deleteRecords:
            false,

        exportData:
            true

    },


    STAFF: {

        dashboard:
            true,

        customers:
            true,

        suppliers:
            true,

        inventory:
            true,

        sales:
            true,

        purchases:
            true,

        payments:
            true,

        reports:
            false,

        settings:
            false,

        users:
            false,

        deleteRecords:
            false,

        exportData:
            false

    }

};


/* ============================================================
   STATE
   ============================================================ */

const usersState = {

    users:
        [],

    currentUser:
        null,

    loaded:
        false,

    loading:
        false

};


/* ============================================================
   HELPERS
   ============================================================ */

function userEl(id) {

    return document.getElementById(
        id
    );

}


function clean(value) {

    return String(
        value ?? ""
    ).trim();

}


function currentUID() {

    return (
        auth?.currentUser?.uid ||
        null
    );

}


function escapeHTML(value) {

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
   ROLE NORMALIZATION
   ============================================================ */

function normalizeRole(
    role
) {

    const normalized =
        clean(
            role
        ).toUpperCase();


    if (
        USER_ROLES[
            normalized
        ]
    ) {

        return normalized;

    }


    return USER_ROLES.STAFF;

}


/* ============================================================
   GET ROLE PERMISSIONS
   ============================================================ */

function getRolePermissions(
    role
) {

    const normalizedRole =
        normalizeRole(
            role
        );


    return {

        ...DEFAULT_PERMISSIONS,

        ...(
            ROLE_PERMISSIONS[
                normalizedRole
            ] ||
            ROLE_PERMISSIONS.STAFF
        )

    };

}


/* ============================================================
   GET CURRENT USER
   ============================================================ */

async function loadCurrentUser() {

    const uid =
        currentUID();


    if (!uid) {

        usersState.currentUser =
            null;

        return null;

    }


    try {

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
            snapshot.exists()
        ) {

            const data =
                snapshot.data();


            const role =
                normalizeRole(
                    data.role
                );


            usersState.currentUser = {

                id:
                    snapshot.id,

                ...data,

                role,

                permissions:
                    data.permissions ||
                    getRolePermissions(
                        role
                    )

            };

        }
        else {

            /*
             * First login fallback.
             * Firebase Authentication user
             * exists but Firestore profile
             * has not been created yet.
             */

            usersState.currentUser = {

                id:
                    uid,

                uid,

                email:
                    auth.currentUser
                        ?.email ||
                    "",

                displayName:
                    auth.currentUser
                        ?.displayName ||
                    "",

                role:
                    USER_ROLES.STAFF,

                status:
                    "ACTIVE",

                permissions:
                    getRolePermissions(
                        USER_ROLES.STAFF
                    )

            };

        }


        applyCurrentUser();


        return usersState.currentUser;

    }
    catch(error) {

        console.error(
            "Current user loading error:",
            error
        );


        return null;

    }

}


/* ============================================================
   CREATE USER PROFILE
   ============================================================ */

async function createUserProfile(
    userData
) {

    if (!userData) {

        throw new Error(
            "User information is required."
        );

    }


    const uid =
        clean(
            userData.uid
        );


    if (!uid) {

        throw new Error(
            "Firebase User ID is required."
        );

    }


    const role =
        normalizeRole(
            userData.role
        );


    const permissions =
        userData.permissions
            ? {
                ...getRolePermissions(
                    role
                ),
                ...userData.permissions
            }
            : getRolePermissions(
                role
            );


    const profile = {

        uid,

        name:
            clean(
                userData.name ||
                userData.displayName
            ),

        email:
            clean(
                userData.email
            ),

        phone:
            clean(
                userData.phone
            ),

        employeeCode:
            clean(
                userData.employeeCode
            ),

        department:
            clean(
                userData.department
            ),

        role,

        status:
            clean(
                userData.status
            ).toUpperCase() ||
            "ACTIVE",

        permissions,

        photoURL:
            clean(
                userData.photoURL
            ),

        createdAt:
            serverTimestamp(),

        updatedAt:
            serverTimestamp(),

        createdBy:
            currentUID()

    };


    await setDoc(
        doc(
            db,
            USERS_COLLECTION,
            uid
        ),
        profile,
        {
            merge:
                true
        }
    );


    return profile;

}


/* ============================================================
   UPDATE USER
   ============================================================ */

async function updateUser(
    uid,
    changes
) {

    if (!uid) {

        throw new Error(
            "User ID is required."
        );

    }


    if (!changes) {

        throw new Error(
            "Update information is required."
        );

    }


    const updateData = {

        ...changes,

        updatedAt:
            serverTimestamp(),

        updatedBy:
            currentUID()

    };


    if (
        changes.role
    ) {

        const role =
            normalizeRole(
                changes.role
            );


        updateData.role =
            role;


        /*
         * If permissions are not
         * explicitly supplied,
         * regenerate from role.
         */

        if (
            !changes.permissions
        ) {

            updateData.permissions =
                getRolePermissions(
                    role
                );

        }

    }


    await updateDoc(
        doc(
            db,
            USERS_COLLECTION,
            uid
        ),
        updateData
    );


    await loadUsers();


    return true;

}


/* ============================================================
   ACTIVATE USER
   ============================================================ */

async function activateUser(
    uid
) {

    return updateUser(
        uid,
        {
            status:
                "ACTIVE"
        }
    );

}


/* ============================================================
   DEACTIVATE USER
   ============================================================ */

async function deactivateUser(
    uid
) {

    return updateUser(
        uid,
        {
            status:
                "INACTIVE"
        }
    );

}


/* ============================================================
   LOAD USERS
   ============================================================ */

async function loadUsers() {

    if (
        usersState.loading
    ) {

        return usersState.users;

    }


    try {

        usersState.loading =
            true;


        const snapshot =
            await getDocs(
                collection(
                    db,
                    USERS_COLLECTION
                )
            );


        usersState.users =
            snapshot.docs
                .map(
                    item => {

                        const data =
                            item.data();


                        const role =
                            normalizeRole(
                                data.role
                            );


                        return {

                            id:
                                item.id,

                            ...data,

                            role,

                            permissions:
                                data.permissions ||
                                getRolePermissions(
                                    role
                                )

                        };

                    }
                );


        usersState.loaded =
            true;


        renderUsers();


        return usersState.users;

    }
    catch(error) {

        console.error(
            "Users loading error:",
            error
        );


        showUserMessage(
            error.message ||
            "Unable to load users.",
            "error"
        );


        return [];

    }
    finally {

        usersState.loading =
            false;

    }

}


/* ============================================================
   GET USER
   ============================================================ */

function getUser(
    uid
) {

    return usersState.users
        .find(
            user =>
                user.id === uid ||
                user.uid === uid
        ) ||
        null;

}


/* ============================================================
   GET USERS BY ROLE
   ============================================================ */

function getUsersByRole(
    role
) {

    const normalized =
        normalizeRole(
            role
        );


    return usersState.users
        .filter(
            user =>
                normalizeRole(
                    user.role
                ) === normalized
        );

}


/* ============================================================
   PERMISSION CHECK
   ============================================================ */

function hasPermission(
    permission
) {

    const user =
        usersState.currentUser;


    if (!user) {

        return false;

    }


    /*
     * Admin always has access.
     */

    if (
        normalizeRole(
            user.role
        ) ===
        USER_ROLES.ADMIN
    ) {

        return true;

    }


    return Boolean(
        user.permissions?.[
            permission
        ]
    );

}


/* ============================================================
   ROLE CHECK
   ============================================================ */

function hasRole(
    role
) {

    const user =
        usersState.currentUser;


    if (!user) {

        return false;

    }


    return (
        normalizeRole(
            user.role
        ) ===
        normalizeRole(
            role
        )
    );

}


/* ============================================================
   ANY ROLE
   ============================================================ */

function hasAnyRole(
    roles
) {

    if (
        !Array.isArray(
            roles
        )
    ) {

        return false;

    }


    return roles.some(
        role =>
            hasRole(
                role
            )
    );

}


/* ============================================================
   ACTIVE USER CHECK
   ============================================================ */

function isCurrentUserActive() {

    const user =
        usersState.currentUser;


    if (!user) {

        return false;

    }


    return (
        clean(
            user.status
        ).toUpperCase() !==
        "INACTIVE"
    );

}


/* ============================================================
   APPLY CURRENT USER
   ============================================================ */

function applyCurrentUser() {

    const user =
        usersState.currentUser;


    if (!user) {

        return;

    }


    /*
     * Global user object.
     */

    window.MMVCurrentUser =
        user;


    /*
     * Name.
     */

    document
        .querySelectorAll(
            "[data-user-name]"
        )
        .forEach(
            node => {

                node.textContent =
                    user.name ||
                    user.displayName ||
                    user.email ||
                    "User";

            }
        );


    /*
     * Email.
     */

    document
        .querySelectorAll(
            "[data-user-email]"
        )
        .forEach(
            node => {

                node.textContent =
                    user.email ||
                    "";

            }
        );


    /*
     * Role.
     */

    document
        .querySelectorAll(
            "[data-user-role]"
        )
        .forEach(
            node => {

                node.textContent =
                    user.role;

            }
        );


    /*
     * Permission based UI.
     */

    document
        .querySelectorAll(
            "[data-permission]"
        )
        .forEach(
            node => {

                const permission =
                    node.getAttribute(
                        "data-permission"
                    );


                const allowed =
                    hasPermission(
                        permission
                    );


                node.style.display =
                    allowed
                        ? ""
                        : "none";

            }
        );


    /*
     * Role based UI.
     */

    document
        .querySelectorAll(
            "[data-role]"
        )
        .forEach(
            node => {

                const requiredRole =
                    node.getAttribute(
                        "data-role"
                    );


                const allowed =
                    hasRole(
                        requiredRole
                    );


                node.style.display =
                    allowed
                        ? ""
                        : "none";

            }
        );

}


/* ============================================================
   RENDER USERS
   ============================================================ */

function renderUsers() {

    const table =
        userEl(
            "usersTableBody"
        );


    if (!table) {

        return;

    }


    if (
        usersState.users.length ===
        0
    ) {

        table.innerHTML = `

            <tr>

                <td colspan="100%">

                    No users found.

                </td>

            </tr>

        `;

        return;

    }


    table.innerHTML =
        usersState.users
            .map(
                user => {

                    const active =
                        clean(
                            user.status
                        ).toUpperCase() !==
                        "INACTIVE";


                    return `

                        <tr>

                            <td>

                                <strong>
                                    ${escapeHTML(
                                        user.name ||
                                        user.displayName ||
                                        "-"
                                    )}
                                </strong>

                            </td>


                            <td>
                                ${escapeHTML(
                                    user.email ||
                                    "-"
                                )}
                            </td>


                            <td>
                                ${escapeHTML(
                                    user.employeeCode ||
                                    "-"
                                )}
                            </td>


                            <td>
                                ${escapeHTML(
                                    user.role
                                )}
                            </td>


                            <td>

                                <span
                                    class="
                                        user-status
                                        ${active
                                            ? "active"
                                            : "inactive"}
                                    "
                                >

                                    ${
                                        active
                                            ? "Active"
                                            : "Inactive"
                                    }

                                </span>

                            </td>


                            <td>

                                <button
                                    type="button"
                                    data-user-edit="${escapeHTML(
                                        user.id
                                    )}"
                                >
                                    Edit
                                </button>


                                ${
                                    active
                                        ? `

                                            <button
                                                type="button"
                                                data-user-deactivate="${escapeHTML(
                                                    user.id
                                                )}"
                                            >
                                                Deactivate
                                            </button>

                                        `
                                        : `

                                            <button
                                                type="button"
                                                data-user-activate="${escapeHTML(
                                                    user.id
                                                )}"
                                            >
                                                Activate
                                            </button>

                                        `
                                }

                            </td>

                        </tr>

                    `;

                }
            )
            .join("");


    bindUserTableActions();

}


/* ============================================================
   TABLE ACTIONS
   ============================================================ */

function bindUserTableActions() {

    document
        .querySelectorAll(
            "[data-user-deactivate]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const uid =
                            button.getAttribute(
                                "data-user-deactivate"
                            );


                        if (
                            !confirm(
                                "Deactivate this user?"
                            )
                        ) {

                            return;

                        }


                        try {

                            await deactivateUser(
                                uid
                            );


                            showUserMessage(
                                "User deactivated.",
                                "success"
                            );

                        }
                        catch(error) {

                            showUserMessage(
                                error.message,
                                "error"
                            );

                        }

                    }
                );

            }
        );


    document
        .querySelectorAll(
            "[data-user-activate]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const uid =
                            button.getAttribute(
                                "data-user-activate"
                            );


                        try {

                            await activateUser(
                                uid
                            );


                            showUserMessage(
                                "User activated.",
                                "success"
                            );

                        }
                        catch(error) {

                            showUserMessage(
                                error.message,
                                "error"
                            );

                        }

                    }
                );

            }
        );

}


/* ============================================================
   SAVE USER FORM
   ============================================================ */

async function saveUserFromForm() {

    const uid =
        clean(
            userEl(
                "userId"
            )?.value
        );


    const data = {

        uid,

        name:
            userEl(
                "userName"
            )?.value,

        email:
            userEl(
                "userEmail"
            )?.value,

        phone:
            userEl(
                "userPhone"
            )?.value,

        employeeCode:
            userEl(
                "employeeCode"
            )?.value,

        department:
            userEl(
                "userDepartment"
            )?.value,

        role:
            userEl(
                "userRole"
            )?.value,

        status:
            userEl(
                "userStatus"
            )?.value ||
            "ACTIVE"

    };


    if (!data.uid) {

        showUserMessage(
            "Firebase User ID is required.",
            "error"
        );

        return false;

    }


    try {

        if (usersState.users.some(
            user =>
                user.id === data.uid
        )) {

            await updateUser(
                data.uid,
                data
            );

        }
        else {

            await createUserProfile(
                data
            );


            await loadUsers();

        }


        showUserMessage(
            "User profile saved successfully.",
            "success"
        );


        return true;

    }
    catch(error) {

        console.error(
            "User save error:",
            error
        );


        showUserMessage(
            error.message ||
            "Unable to save user.",
            "error"
        );


        return false;

    }

}


/* ============================================================
   USER MESSAGE
   ============================================================ */

function showUserMessage(
    message,
    type = "info"
) {

    let box =
        userEl(
            "mmvUserMessage"
        );


    if (!box) {

        box =
            document.createElement(
                "div"
            );


        box.id =
            "mmvUserMessage";


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
   AUTH STATE
   ============================================================ */

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            usersState.currentUser =
                null;

            window.MMVCurrentUser =
                null;

            return;

        }


        await loadCurrentUser();

    }
);


/* ============================================================
   DOM READY
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await loadCurrentUser();

        await loadUsers();


        const form =
            userEl(
                "userForm"
            );


        if (form) {

            form.addEventListener(
                "submit",
                event => {

                    event.preventDefault();

                    saveUserFromForm();

                }
            );

        }

    }
);


/* ============================================================
   GLOBAL API
   ============================================================ */

window.MMVUsers = {

    load:
        loadUsers,

    get:
        getUser,

    getByRole:
        getUsersByRole,

    create:
        createUserProfile,

    update:
        updateUser,

    activate:
        activateUser,

    deactivate:
        deactivateUser,

    getCurrentUser:
        () =>
            usersState.currentUser,

    hasPermission,

    hasRole,

    hasAnyRole,

    isActive:
        isCurrentUserActive,

    getRolePermissions,

    render:
        renderUsers

};


window.MMVUserRoles =
    USER_ROLES;


window.MMVRolePermissions =
    ROLE_PERMISSIONS;


window.hasPermission =
    hasPermission;


window.hasRole =
    hasRole;


console.info(
    "%cMMV Users V2%c ready",
    "font-weight:800;color:#0a3d91;",
    "color:inherit;"
);
