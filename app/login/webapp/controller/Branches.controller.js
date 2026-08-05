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
        "pharmatrack.login.controller.Branches",
        {
            onInit: function () {
                var oBranchesModel = new JSONModel({
                    branches: [],
                    activeBranchText: "Şubeler yükleniyor...",
                    loading: false,
                    error: false,
                    errorMessage: ""
                });

                this.getView().setModel(
                    oBranchesModel,
                    "branches"
                );

                var oRoute = this.getOwnerComponent()
                    .getRouter()
                    .getRoute("branches");

                if (oRoute) {
                    oRoute.attachPatternMatched(
                        this._onRouteMatched,
                        this
                    );
                }
            },

            _onRouteMatched: function () {
                this._loadBranchSummaries();
            },

            _loadBranchSummaries: async function () {
                var oModel = this.getView()
                    .getModel("branches");

                oModel.setProperty("/loading", true);
                oModel.setProperty("/error", false);
                oModel.setProperty("/errorMessage", "");
                oModel.setProperty(
                    "/activeBranchText",
                    "Şubeler yükleniyor..."
                );

                try {
                    var oResponse = await fetch(
                        "/odata/v4/pharmacy/getBranchSummaries",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json",
                                "Accept":
                                    "application/json"
                            },
                            body: JSON.stringify({})
                        }
                    );

                    var oResult;

                    try {
                        oResult = await oResponse.json();
                    } catch (oJsonError) {
                        throw new Error(
                            "Sunucudan geçerli bir cevap alınamadı."
                        );
                    }

                    if (!oResponse.ok) {
                        throw new Error(
                            this._getErrorMessage(oResult)
                        );
                    }

                    var aBranches =
                        this._extractBranches(oResult);

                    var aFormattedBranches =
                        aBranches.map(
                            function (oBranch) {
                                var bIsActive =
                                    Boolean(
                                        oBranch.isActive
                                    );

                                return {
                                    branchID:
                                        oBranch.branchID,

                                    branchCode:
                                        oBranch.branchCode,

                                    branchName:
                                        oBranch.branchName,

                                    district:
                                        oBranch.district ||
                                        oBranch.branchName,

                                    isActive:
                                        bIsActive,

                                    statusText:
                                        bIsActive
                                            ? "Aktif"
                                            : "Pasif",

                                    statusState:
                                        bIsActive
                                            ? "Success"
                                            : "Error",

                                    todayRevenue:
                                        Number(
                                            oBranch.todayRevenue ||
                                            0
                                        ),

                                    formattedRevenue:
                                        this._formatCurrency(
                                            oBranch.todayRevenue
                                        ),

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

                                    todayItemsText:
                                        "Bugün " +
                                        Number(
                                            oBranch.todayItemsSold ||
                                            0
                                        ) +
                                        " ürün satıldı",

                                    criticalStockCount:
                                        Number(
                                            oBranch
                                                .criticalStockCount ||
                                            0
                                        ),

                                    pendingRequestCount:
                                        Number(
                                            oBranch
                                                .pendingRequestCount ||
                                            0
                                        )
                                };
                            }.bind(this)
                        );

                    oModel.setProperty(
                        "/branches",
                        aFormattedBranches
                    );

                    var iActiveBranchCount =
                        aFormattedBranches.filter(
                            function (oBranch) {
                                return oBranch.isActive;
                            }
                        ).length;

                    oModel.setProperty(
                        "/activeBranchText",
                        iActiveBranchCount +
                        " Şube Aktif"
                    );

                    if (
                        aFormattedBranches.length === 0
                    ) {
                        MessageToast.show(
                            "Aktif şube kaydı bulunamadı."
                        );
                    }
                } catch (oError) {
                    console.error(
                        "Şube özetleri alınamadı:",
                        oError
                    );

                    oModel.setProperty(
                        "/branches",
                        []
                    );

                    oModel.setProperty(
                        "/activeBranchText",
                        "Şube verisi alınamadı"
                    );

                    oModel.setProperty(
                        "/error",
                        true
                    );

                    oModel.setProperty(
                        "/errorMessage",
                        oError.message ||
                        "Şube verileri alınamadı."
                    );
                } finally {
                    oModel.setProperty(
                        "/loading",
                        false
                    );
                }
            },

            _extractBranches: function (oResult) {
                if (Array.isArray(oResult)) {
                    return oResult;
                }

                if (
                    oResult &&
                    Array.isArray(oResult.value)
                ) {
                    return oResult.value;
                }

                if (
                    oResult &&
                    oResult.value &&
                    Array.isArray(
                        oResult.value.value
                    )
                ) {
                    return oResult.value.value;
                }

                return [];
            },

            _formatCurrency: function (vValue) {
                return new Intl.NumberFormat(
                    "tr-TR",
                    {
                        style: "currency",
                        currency: "TRY",
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }
                ).format(
                    Number(vValue || 0)
                );
            },

            _getErrorMessage: function (oResult) {
                if (
                    oResult &&
                    oResult.error &&
                    oResult.error.message
                ) {
                    if (
                        typeof oResult.error.message ===
                        "string"
                    ) {
                        return oResult.error.message;
                    }

                    if (
                        oResult.error.message.value
                    ) {
                        return oResult.error
                            .message.value;
                    }
                }

                if (
                    oResult &&
                    oResult.message
                ) {
                    return oResult.message;
                }

                return "Şube servisi geçerli bir cevap vermedi.";
            },

            onRefresh: function () {
                this._loadBranchSummaries();
            },

            onNavBack: function () {
                var oApp = this.getView()
                    .getParent();

                if (
                    oApp &&
                    oApp.getPages
                ) {
                    var aPages = oApp.getPages();

                    if (aPages.length > 0) {
                        oApp.to(
                            aPages[0].getId()
                        );
                    }
                }

                this.getOwnerComponent()
                    .getRouter()
                    .getHashChanger()
                    .replaceHash("");
            },

            onOpenBranch: function (oEvent) {
                var oSource = oEvent.getSource();

                var oContext = oSource
                    .getBindingContext(
                        "branches"
                    );

                if (!oContext) {
                    MessageToast.show(
                        "Şube kartı bağlantısı bulunamadı."
                    );
                    return;
                }

                var oBranch =
                    oContext.getObject();

                if (
                    !oBranch ||
                    !oBranch.branchID
                ) {
                    console.error(
                        "Eksik şube bilgisi:",
                        oBranch
                    );

                    MessageToast.show(
                        "Şube kimliği bulunamadı."
                    );
                    return;
                }

                sessionStorage.setItem(
                    "pharmatrackSelectedBranch",
                    JSON.stringify(oBranch)
                );

                console.log(
                    "Açılacak şube:",
                    oBranch
                );

                this.getOwnerComponent()
                    .getRouter()
                    .navTo(
                        "branchDetail",
                        {
                            branchID:
                                String(
                                    oBranch.branchID
                                )
                        }
                    );
            }
        }
    );
});