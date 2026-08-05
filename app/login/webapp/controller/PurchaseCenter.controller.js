sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (
    Controller,
    JSONModel
) {
    "use strict";

    return Controller.extend(
        "pharmatrack.login.controller.PurchaseCenter",
        {
            onInit: function () {
                var oModel = new JSONModel({
                    pendingOrders: 12,
                    deliveredOrders: 86,
                    supplierCount: 24,
                    monthlyPurchase: "₺482.000"
                });

                this.getView().setModel(
                    oModel,
                    "purchase"
                );
            },

            onNavBack: function () {
                var oApp = this.getView()
                    .getParent();

                if (oApp && oApp.getPages) {
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
            }
        }
    );
});