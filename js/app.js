/* ============================================================
   MMV TRADERS ERP V2
   COMMON APPLICATION CORE
   Production UI / Navigation / Session Helpers
   ============================================================ */

"use strict";

/* ============================================================
   GLOBAL APP CONFIG
   ============================================================ */

window.MMV_APP = Object.freeze({
    name: "MMV Traders ERP",
    version: "2.0",
    company: "MMV Traders",
    poweredBy: "VTOOS Software Solutions",

    routes: {
        dashboard: "../index.html",
        login: "../login.html",

        purchase: "../modules/purchase.html",
        sales: "../modules/sales.html",
        inventory: "../modules/inventory.html",
        customers: "../modules/customers.html",
        suppliers: "../modules/suppliers.html",
        payments: "../modules/payments.html",
        reports: "../modules/reports.html"
    }
});


/* ============================================================
   DOM READY
   ============================================================ */

document.addEventListener("DOMContentLoaded", function () {

    MMV.initNavigation();
    MMV.initMobileNavigation();
    MMV.initActivePage();
    MMV.initButtons();
    MMV.initKeyboardShortcuts();
    MMV.initDateFields();
    MMV.initNumberFormatting();
    MMV.initGlobalErrors();

});


/* ============================================================
   MAIN MMV OBJECT
   ============================================================ */

window.MMV = {


    /* ========================================================
       INITIALIZATION
       ======================================================== */

    initNavigation: function () {

        document.querySelectorAll("[data-route]").forEach(function (element) {

            element.addEventListener("click", function (event) {

                const route = element.getAttribute("data-route");

                if (!route) {
                    return;
                }

                event.preventDefault();

                MMV.navigate(route);

            });

        });

    },


    /* ========================================================
       NAVIGATION
       ======================================================== */

    navigate: function (route) {

        if (!route) {
            return;
        }

        /*
         * Direct URL
         */
        if (
            route.includes(".html") ||
            route.startsWith("/") ||
            route.startsWith("http")
        ) {
            window.location.href = route;
            return;
        }


        /*
         * Named application route
         */
        if (
            MMV_APP.routes &&
            MMV_APP.routes[route]
        ) {

            window.location.href =
                MMV_APP.routes[route];

            return;
        }


        console.warn(
            "MMV: Unknown route:",
            route
        );

    },


    /* ========================================================
       BACK TO DASHBOARD
       ======================================================== */

    goDashboard: function () {

        MMV.navigate("dashboard");

    },


    /* ========================================================
       ACTIVE SIDEBAR PAGE
       ======================================================== */

    initActivePage: function () {

        const currentPath =
            window.location.pathname
                .split("/")
                .pop()
                .toLowerCase();


        document.querySelectorAll(
            ".nav-link, .sidebar-link, [data-route]"
        ).forEach(function (link) {

            const href =
                link.getAttribute("href") ||
                link.getAttribute("data-route") ||
                "";

            if (!href) {
                return;
            }

            const target =
                href
                    .split("/")
                    .pop()
                    .toLowerCase();

            if (
                target &&
                target === currentPath
            ) {

                link.classList.add("active");

            }

        });

    },


    /* ========================================================
       MOBILE NAVIGATION
       ======================================================== */

    initMobileNavigation: function () {

        const toggle =
            document.querySelector(
                "[data-mobile-menu]"
            );

        const sidebar =
            document.querySelector(
                ".sidebar"
            );

        const overlay =
            document.querySelector(
                ".sidebar-overlay"
            );


        if (!toggle || !sidebar) {
            return;
        }


        toggle.addEventListener(
            "click",
            function () {

                sidebar.classList.toggle(
                    "mobile-open"
                );

                if (overlay) {

                    overlay.classList.toggle(
                        "show"
                    );

                }

                document.body.classList.toggle(
                    "menu-open"
                );

            }
        );


        if (overlay) {

            overlay.addEventListener(
                "click",
                function () {

                    sidebar.classList.remove(
                        "mobile-open"
                    );

                    overlay.classList.remove(
                        "show"
                    );

                    document.body.classList.remove(
                        "menu-open"
                    );

                }
            );

        }


        /*
         * Close menu after selecting a page
         */

        sidebar
            .querySelectorAll("a")
            .forEach(function (link) {

                link.addEventListener(
                    "click",
                    function () {

                        sidebar.classList.remove(
                            "mobile-open"
                        );

                        if (overlay) {

                            overlay.classList.remove(
                                "show"
                            );

                        }

                        document.body.classList.remove(
                            "menu-open"
                        );

                    }
                );

            });

    },


    /* ========================================================
       COMMON BUTTONS
       ======================================================== */

    initButtons: function () {

        document.querySelectorAll(
            "[data-dashboard]"
        ).forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    MMV.goDashboard();

                }
            );

        });


        document.querySelectorAll(
            "[data-back]"
        ).forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    if (
                        window.history.length > 1
                    ) {

                        window.history.back();

                    } else {

                        MMV.goDashboard();

                    }

                }
            );

        });

    },


    /* ========================================================
       DATE HELPERS
       ======================================================== */

    initDateFields: function () {

        const today =
            new Date();

        const localDate =
            today.getFullYear() +
            "-" +
            String(
                today.getMonth() + 1
            ).padStart(2, "0") +
            "-" +
            String(
                today.getDate()
            ).padStart(2, "0");


        document.querySelectorAll(
            'input[type="date"][data-today]'
        ).forEach(function (input) {

            if (!input.value) {

                input.value =
                    localDate;

            }

        });


        document.querySelectorAll(
            "[data-current-date]"
        ).forEach(function (element) {

            element.textContent =
                today.toLocaleDateString(
                    "en-IN",
                    {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    }
                );

        });

    },


    /* ========================================================
       NUMBER FORMATTING
       ======================================================== */

    initNumberFormatting: function () {

        document.querySelectorAll(
            "[data-number]"
        ).forEach(function (element) {

            const value =
                Number(
                    element.textContent
                        .replace(/[^\d.-]/g, "")
                );

            if (
                Number.isFinite(value)
            ) {

                element.textContent =
                    value.toLocaleString(
                        "en-IN"
                    );

            }

        });

    },


    /* ========================================================
       KEYBOARD SHORTCUTS
       ======================================================== */

    initKeyboardShortcuts: function () {

        document.addEventListener(
            "keydown",
            function (event) {

                /*
                 * ESC
                 */

                if (
                    event.key === "Escape"
                ) {

                    document
                        .querySelectorAll(
                            ".modal.open, .modal.show"
                        )
                        .forEach(function (modal) {

                            modal.classList.remove(
                                "open"
                            );

                            modal.classList.remove(
                                "show"
                            );

                        });

                }


                /*
                 * Ctrl + K
                 * Focus first search field
                 */

                if (
                    event.ctrlKey &&
                    event.key.toLowerCase() === "k"
                ) {

                    event.preventDefault();

                    const search =
                        document.querySelector(
                            'input[type="search"], input[placeholder*="Search"], input[id*="Search"]'
                        );

                    if (search) {

                        search.focus();

                    }

                }

            }
        );

    },


    /* ========================================================
       LOADING STATE
       ======================================================== */

    showLoading: function (
        element,
        text = "Loading..."
    ) {

        if (!element) {
            return;
        }

        element.dataset.previousText =
            element.textContent;

        element.disabled = true;

        element.textContent =
            text;

        element.classList.add(
            "is-loading"
        );

    },


    hideLoading: function (
        element
    ) {

        if (!element) {
            return;
        }

        if (
            element.dataset.previousText
        ) {

            element.textContent =
                element.dataset.previousText;

        }

        element.disabled = false;

        element.classList.remove(
            "is-loading"
        );

    },


    /* ========================================================
       TOAST
       ======================================================== */

    toast: function (
        message,
        type = "info"
    ) {

        let container =
            document.querySelector(
                ".mmv-toast-container"
            );


        if (!container) {

            container =
                document.createElement(
                    "div"
                );

            container.className =
                "mmv-toast-container";

            document.body.appendChild(
                container
            );

        }


        const toast =
            document.createElement(
                "div"
            );

        toast.className =
            "mmv-toast mmv-toast-" +
            type;

        toast.textContent =
            message;


        container.appendChild(
            toast
        );


        requestAnimationFrame(
            function () {

                toast.classList.add(
                    "show"
                );

            }
        );


        setTimeout(
            function () {

                toast.classList.remove(
                    "show"
                );

                setTimeout(
                    function () {

                        toast.remove();

                    },
                    250
                );

            },
            3000
        );

    },


    /* ========================================================
       CONFIRM
       ======================================================== */

    confirm: function (
        message
    ) {

        return window.confirm(
            message
        );

    },


    /* ========================================================
       SAFE TEXT
       ======================================================== */

    escapeHTML: function (
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";

        }

        return String(value)
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

    },


    /* ========================================================
       CURRENCY
       ======================================================== */

    currency: function (
        amount
    ) {

        const value =
            Number(amount) || 0;

        return value.toLocaleString(
            "en-IN",
            {
                style: "currency",
                currency: "INR",
                minimumFractionDigits: 2
            }
        );

    },


    /* ========================================================
       NUMBER
       ======================================================== */

    number: function (
        value
    ) {

        const amount =
            Number(value) || 0;

        return amount.toLocaleString(
            "en-IN"
        );

    },


    /* ========================================================
       MODULE COMING SOON
       ======================================================== */

    moduleComingSoon: function (
        moduleName
    ) {

        MMV.toast(
            moduleName +
            " module is not connected yet.",
            "info"
        );

    },


    /* ========================================================
       GLOBAL ERROR HANDLER
       ======================================================== */

    initGlobalErrors: function () {

        window.addEventListener(
            "error",
            function (event) {

                console.error(
                    "MMV Application Error:",
                    event.error ||
                    event.message
                );

            }
        );


        window.addEventListener(
            "unhandledrejection",
            function (event) {

                console.error(
                    "MMV Promise Error:",
                    event.reason
                );

            }
        );

    }

};


/* ============================================================
   BACKWARD COMPATIBILITY
   Existing HTML pages already use these names.
   ============================================================ */

window.openPage =
    function (page) {

        MMV.navigate(page);

    };


window.goTo =
    function (page) {

        MMV.navigate(page);

    };


window.moduleComingSoon =
    function (moduleName) {

        MMV.moduleComingSoon(
            moduleName
        );

    };


/* ============================================================
   MOBILE MENU HELPER
   ============================================================ */

window.toggleMobileMenu =
    function () {

        const sidebar =
            document.querySelector(
                ".sidebar"
            );

        if (!sidebar) {
            return;
        }

        sidebar.classList.toggle(
            "mobile-open"
        );

    };


/* ============================================================
   VERSION LOG
   ============================================================ */

console.info(
    "%cMMV Traders ERP V2%c loaded",
    "font-weight:700;color:#0a3d91;",
    "color:inherit;"
);
