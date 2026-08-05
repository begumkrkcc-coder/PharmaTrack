sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/m/MessageToast"
], function (
    ControllerExtension,
    MessageToast
) {
    "use strict";

    return ControllerExtension.extend(
        "pharmatrack.project2.ext.controller.ListReportExt",
        {
            override: {
                onAfterRendering: function () {
                    if (this._filtersApplied) {
                        return;
                    }

                    this._applyStockFilters();
                }
            },

            _applyStockFilters: function () {
                var oExtensionAPI =
                    this.base.getExtensionAPI();

                if (
                    !oExtensionAPI ||
                    !oExtensionAPI.setFilterValues
                ) {
                    console.error(
                        "Fiori Elements filtre API bulunamadı."
                    );
                    return;
                }

                var oBranchContext =
                    this._getActiveBranchContext();

                if (
                    !oBranchContext ||
                    !oBranchContext.branchID
                ) {
                    MessageToast.show(
                        "Şube bilgisi bulunamadı."
                    );
                    return;
                }

                /*
                 * Önce yalnızca seçilen şubeyi göster.
                 */
                oExtensionAPI.setFilterValues(
                    "branch_ID",
                    "EQ",
                    oBranchContext.branchID
                );

                var sFilterMode =
                    sessionStorage.getItem(
                        "pharmatrackStockFilterMode"
                    ) || "ALL";

                /*
                 * Kritik stok ekranından gelindiyse:
                 * miktarı 3 ve altında olan kayıtları göster.
                 */
                if (sFilterMode === "CRITICAL") {
                    oExtensionAPI.setFilterValues(
                        "quantity",
                        "LE",
                        3
                    );

                    MessageToast.show(
                        oBranchContext.branchName +
                        " kritik stokları gösteriliyor."
                    );
                } else {
                    /*
                     * Önceden kritik filtre uygulanmışsa temizle.
                     */
                    oExtensionAPI.setFilterValues(
                        "quantity"
                    );

                    MessageToast.show(
                        oBranchContext.branchName +
                        " stokları gösteriliyor."
                    );
                }

                this._filtersApplied = true;
            },

            _getActiveBranchContext: function () {
                /*
                 * Admin, Şube Detay ekranından geldiyse
                 * seçtiği şubeyi kullan.
                 */
                var sAdminContext =
                    sessionStorage.getItem(
                        "pharmatrackAdminBranchContext"
                    );

                if (sAdminContext) {
                    try {
                        var oAdminContext =
                            JSON.parse(sAdminContext);

                        if (oAdminContext.branchID) {
                            return oAdminContext;
                        }
                    } catch (oError) {
                        console.error(
                            "Admin şube bilgisi okunamadı:",
                            oError
                        );
                    }
                }

                /*
                 * Normal şube kullanıcısı giriş yaptıysa
                 * kendi branchID bilgisini kullan.
                 */
                var sUserSession =
                    sessionStorage.getItem(
                        "pharmatrackUser"
                    );

                if (sUserSession) {
                    try {
                        var oUser =
                            JSON.parse(sUserSession);

                        if (oUser.branchID) {
                            return {
                                branchID:
                                    oUser.branchID,

                                branchCode:
                                    oUser.branchCode || "",

                                branchName:
                                    oUser.branchName || "Şube"
                            };
                        }
                    } catch (oError) {
                        console.error(
                            "Kullanıcı şube bilgisi okunamadı:",
                            oError
                        );
                    }
                }

                return null;
            }
        }
    );
});