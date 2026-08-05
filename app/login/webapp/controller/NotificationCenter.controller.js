sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (
    Controller,
    JSONModel
) {
    "use strict";

    return Controller.extend(
        "pharmatrack.login.controller.NotificationCenter",
        {
            onInit: function () {
                var oModel = new JSONModel({
                    criticalStockCount: 0,
                    nearExpiryCount: 0,
                    expiredCount: 0,
                    orderSuggestionCount: 0,
                    totalAlertCount: 0,

                    statusText:
                        "Bildirimler yükleniyor...",

                    statusState:
                        "Information",

                    notifications: [],

                    loading: false,
                    error: false,
                    errorMessage: "",
                    empty: false
                });

                this.getView().setModel(
                    oModel,
                    "notification"
                );

                var oRoute = this.getOwnerComponent()
                    .getRouter()
                    .getRoute(
                        "notificationCenter"
                    );

                if (oRoute) {
                    oRoute.attachPatternMatched(
                        this._onRouteMatched,
                        this
                    );
                }
            },

            _onRouteMatched: function () {
                this._loadNotifications();
            },

            _loadNotifications:
                async function () {
                    var oModel = this.getView()
                        .getModel(
                            "notification"
                        );

                    oModel.setProperty(
                        "/loading",
                        true
                    );

                    oModel.setProperty(
                        "/error",
                        false
                    );

                    oModel.setProperty(
                        "/errorMessage",
                        ""
                    );

                    oModel.setProperty(
                        "/empty",
                        false
                    );

                    try {
                        var oResponse =
                            await fetch(
                                "/odata/v4/pharmacy/getNotificationSummary",
                                {
                                    method: "POST",

                                    headers: {
                                        "Content-Type":
                                            "application/json",

                                        Accept:
                                            "application/json"
                                    },

                                    body:
                                        JSON.stringify({
                                            expiryDays: 30,
                                            analysisDays: 30,
                                            leadTimeDays: 7
                                        })
                                }
                            );

                        var oResult =
                            await oResponse.json();

                        if (!oResponse.ok) {
                            throw new Error(
                                this._getErrorMessage(
                                    oResult
                                )
                            );
                        }

                        var oSummary =
                            this._extractResult(
                                oResult
                            );

                        var iCritical =
                            Number(
                                oSummary
                                    .criticalStockCount ||
                                0
                            );

                        var iNearExpiry =
                            Number(
                                oSummary
                                    .nearExpiryCount ||
                                0
                            );

                        var iExpired =
                            Number(
                                oSummary
                                    .expiredCount ||
                                0
                            );

                        var iSuggestions =
                            Number(
                                oSummary
                                    .orderSuggestionCount ||
                                0
                            );

                        var iTotal =
                            Number(
                                oSummary
                                    .totalAlertCount ||
                                (
                                    iCritical +
                                    iNearExpiry +
                                    iExpired +
                                    iSuggestions
                                )
                            );

                        var aNotifications = [];

                        if (iExpired > 0) {
                            aNotifications.push({
                                title:
                                    "Tarihi geçmiş partiler",

                                description:
                                    "Satışı engellenmesi gereken son kullanma tarihi geçmiş partiler bulunuyor.",

                                countText:
                                    iExpired +
                                    " parti",

                                priorityText:
                                    "Acil",

                                state:
                                    "Error",

                                icon:
                                    "sap-icon://error"
                            });
                        }

                        if (iCritical > 0) {
                            aNotifications.push({
                                title:
                                    "Kritik stok uyarısı",

                                description:
                                    "Minimum stok seviyesine düşen ilaçlar bulunuyor.",

                                countText:
                                    iCritical +
                                    " ilaç",

                                priorityText:
                                    "Yüksek",

                                state:
                                    "Error",

                                icon:
                                    "sap-icon://alert"
                            });
                        }

                        if (iNearExpiry > 0) {
                            aNotifications.push({
                                title:
                                    "Yaklaşan son kullanma tarihi",

                                description:
                                    "Önümüzdeki 30 gün içinde son kullanma tarihi dolacak partiler bulunuyor.",

                                countText:
                                    iNearExpiry +
                                    " parti",

                                priorityText:
                                    "Orta",

                                state:
                                    "Warning",

                                icon:
                                    "sap-icon://history"
                            });
                        }

                        if (iSuggestions > 0) {
                            aNotifications.push({
                                title:
                                    "Satın alma önerileri",

                                description:
                                    "Stok ve satış hızına göre satın alınması önerilen ilaçlar bulunuyor.",

                                countText:
                                    iSuggestions +
                                    " öneri",

                                priorityText:
                                    "Bilgi",

                                state:
                                    "Information",

                                icon:
                                    "sap-icon://shipping-status"
                            });
                        }

                        oModel.setProperty(
                            "/criticalStockCount",
                            iCritical
                        );

                        oModel.setProperty(
                            "/nearExpiryCount",
                            iNearExpiry
                        );

                        oModel.setProperty(
                            "/expiredCount",
                            iExpired
                        );

                        oModel.setProperty(
                            "/orderSuggestionCount",
                            iSuggestions
                        );

                        oModel.setProperty(
                            "/totalAlertCount",
                            iTotal
                        );

                        oModel.setProperty(
                            "/notifications",
                            aNotifications
                        );

                        oModel.setProperty(
                            "/empty",
                            aNotifications.length ===
                            0
                        );

                        oModel.setProperty(
                            "/statusText",
                            iTotal +
                            " Aktif Bildirim"
                        );

                        oModel.setProperty(
                            "/statusState",
                            iExpired > 0 ||
                            iCritical > 0
                                ? "Error"
                                : iNearExpiry > 0
                                    ? "Warning"
                                    : "Success"
                        );
                    } catch (oError) {
                        console.error(
                            "Notification error:",
                            oError
                        );

                        oModel.setProperty(
                            "/notifications",
                            []
                        );

                        oModel.setProperty(
                            "/error",
                            true
                        );

                        oModel.setProperty(
                            "/errorMessage",
                            oError.message ||
                            "Bildirim verileri yüklenemedi."
                        );

                        oModel.setProperty(
                            "/statusText",
                            "Veri alınamadı"
                        );

                        oModel.setProperty(
                            "/statusState",
                            "Error"
                        );
                    } finally {
                        oModel.setProperty(
                            "/loading",
                            false
                        );
                    }
                },

            _extractResult: function (
                oResult
            ) {
                if (
                    oResult &&
                    oResult.value &&
                    !Array.isArray(
                        oResult.value
                    )
                ) {
                    return oResult.value;
                }

                return oResult || {};
            },

            _getErrorMessage: function (
                oResult
            ) {
                if (
                    oResult &&
                    oResult.error &&
                    oResult.error.message
                ) {
                    if (
                        typeof oResult.error
                            .message ===
                        "string"
                    ) {
                        return oResult.error
                            .message;
                    }

                    if (
                        oResult.error.message
                            .value
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

                return "Servisten geçerli bir cevap alınamadı.";
            },

            onRefresh: function () {
                this._loadNotifications();
            },

            onNavBack: function () {
                var oApp =
                    this.getView().getParent();

                if (
                    oApp &&
                    oApp.getPages
                ) {
                    var aPages =
                        oApp.getPages();

                    if (
                        aPages.length > 0
                    ) {
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