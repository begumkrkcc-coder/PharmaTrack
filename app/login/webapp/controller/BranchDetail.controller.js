sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (
    Controller,
    JSONModel,
    MessageToast
) {
    "use strict";

    return Controller.extend(
        "pharmatrack.login.controller.BranchDetail",
        {
            onInit: function () {
                var oModel = new JSONModel({
                    branchID: null,
                    branchCode: "",
                    branchName: "Şube",
                    district: "",
                    subtitle: "",
                    statusText: "Aktif",
                    statusState: "Success",
                    formattedRevenue: "₺0,00",
                    todaySalesCount: 0,
                    todayItemsSold: 0,
                    criticalStockCount: 0,
                    pendingRequestCount: 0
                });

                this.getView().setModel(
                    oModel,
                    "branchDetail"
                );

                this.getOwnerComponent()
                    .getRouter()
                    .getRoute("branchDetail")
                    .attachPatternMatched(
                        this._onRouteMatched,
                        this
                    );
            },

            _onRouteMatched: function (oEvent) {
                var oArguments =
                    oEvent.getParameter("arguments");

                var sBranchID =
                    oArguments.branchID;

                var sStoredBranch =
                    sessionStorage.getItem(
                        "pharmatrackSelectedBranch"
                    );

                if (!sStoredBranch) {
                    MessageToast.show(
                        "Şube bilgisi bulunamadı."
                    );

                    this.getOwnerComponent()
                        .getRouter()
                        .navTo("branches");

                    return;
                }

                try {
                    var oBranch =
                        JSON.parse(sStoredBranch);

                    if (
                        String(oBranch.branchID) !==
                        String(sBranchID)
                    ) {
                        MessageToast.show(
                            "Seçilen şube bilgisi eşleşmedi."
                        );

                        this.getOwnerComponent()
                            .getRouter()
                            .navTo("branches");

                        return;
                    }

                    this.getView()
                        .getModel("branchDetail")
                        .setData({
                            branchID:
                                oBranch.branchID,

                            branchCode:
                                oBranch.branchCode || "",

                            branchName:
                                oBranch.branchName ||
                                "Şube",

                            district:
                                oBranch.district || "",

                            subtitle:
                                (oBranch.district ||
                                    oBranch.branchName ||
                                    "Seçilen") +
                                " şubesinin güncel satış, stok ve operasyon özeti.",

                            statusText:
                                oBranch.statusText ||
                                "Aktif",

                            statusState:
                                oBranch.statusState ||
                                "Success",

                            formattedRevenue:
                                oBranch.formattedRevenue ||
                                "₺0,00",

                            todaySalesCount:
                                Number(
                                    oBranch.todaySalesCount ||
                                    0
                                ),

                            todayItemsSold:
                                Number(
                                    oBranch.todayItemsSold ||
                                    0
                                ),

                            criticalStockCount:
                                Number(
                                    oBranch.criticalStockCount ||
                                    0
                                ),

                            pendingRequestCount:
                                Number(
                                    oBranch.pendingRequestCount ||
                                    0
                                )
                        });

                    this._saveSelectedBranchContext(
                        "BRANCH_DETAIL"
                    );
                } catch (oError) {
                    console.error(
                        "Şube bilgisi okunamadı:",
                        oError
                    );

                    MessageToast.show(
                        "Şube bilgisi okunamadı."
                    );
                }
            },

            onNavBack: function () {
                this._clearTargetFilter();

                this.getOwnerComponent()
                    .getRouter()
                    .navTo("branches");
            },

            /*
             * Seçilen şubenin satış geçmişini açar.
             */
            onOpenSales: function () {
                if (
                    !this._saveSelectedBranchContext(
                        "SALES_HISTORY"
                    )
                ) {
                    return;
                }

                this.getOwnerComponent()
                    .getRouter()
                    .navTo("salesHistory");
            },

            /*
             * Seçilen şubenin tüm parti ve stoklarını açar.
             */
            onOpenStock: function () {
                if (
                    !this._saveSelectedBranchContext(
                        "STOCK"
                    )
                ) {
                    return;
                }

                sessionStorage.setItem(
                    "pharmatrackStockFilterMode",
                    "ALL"
                );

                window.location.href =
                    "/project2/webapp/index.html";
            },

            /*
             * Seçilen şubenin kritik stoklarını açar.
             */
            onOpenCriticalStock: function () {
                if (
                    !this._saveSelectedBranchContext(
                        "CRITICAL_STOCK"
                    )
                ) {
                    return;
                }

                sessionStorage.setItem(
                    "pharmatrackStockFilterMode",
                    "CRITICAL"
                );

                window.location.href =
                    "/project2/webapp/index.html";
            },

            /*
             * Seçilen şubenin bekleyen stok taleplerini açar.
             */
            onOpenRequests: function () {
                if (
                    !this._saveSelectedBranchContext(
                        "REQUESTS"
                    )
                ) {
                    return;
                }

                sessionStorage.setItem(
                    "pharmatrackRequestStatusFilter",
                    "PENDING"
                );

                this.getOwnerComponent()
                    .getRouter()
                    .navTo("approvalCenter");
            },

            /*
             * Detay modelindeki şube bilgisini hedef ekranların
             * okuyabileceği ortak oturum alanına kaydeder.
             */
            _saveSelectedBranchContext: function (
                sTarget
            ) {
                var oModel =
                    this.getView().getModel(
                        "branchDetail"
                    );

                var oBranch =
                    oModel.getData();

                if (!oBranch.branchID) {
                    MessageToast.show(
                        "Seçilen şube bilgisi bulunamadı."
                    );

                    return false;
                }

                var oContext = {
                    branchID:
                        oBranch.branchID,

                    branchCode:
                        oBranch.branchCode || "",

                    branchName:
                        oBranch.branchName || "Şube",

                    district:
                        oBranch.district || "",

                    target:
                        sTarget || "",

                    createdAt:
                        new Date().toISOString()
                };

                sessionStorage.setItem(
                    "pharmatrackAdminBranchContext",
                    JSON.stringify(oContext)
                );

                return true;
            },

            _clearTargetFilter: function () {
                sessionStorage.removeItem(
                    "pharmatrackStockFilterMode"
                );

                sessionStorage.removeItem(
                    "pharmatrackRequestStatusFilter"
                );
            }
        }
    );
});