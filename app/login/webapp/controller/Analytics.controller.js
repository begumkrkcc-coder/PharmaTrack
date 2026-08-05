sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (
    Controller,
    JSONModel,
    MessageBox,
    MessageToast
) {
    "use strict";

    return Controller.extend(
        "pharmatrack.login.controller.Analytics",
        {
            onInit: function () {
                var oModel = new JSONModel({
                    busy: false,

                    branchName: "Şube",
                    reportCreated: false,

                    summary: {
                        reportDate: "",
                        totalSalesCount: 0,
                        totalItemsSold: 0,
                        totalRevenue: "0,00",
                        totalCost: "0,00",
                        totalProfit: "0,00",
                        averageProfitMargin: "0,00",
                        topSellingMedicine: "-",
                        criticalStockCount: 0,
                        nearExpiryBatchCount: 0,
                        expiredBatchCount: 0
                    },

                    report: {
                        branchName: "",
                        reportDate: "",
                        createdAt: "",
                        createdBy: "",
                        totalSalesCount: 0,
                        totalItemsSold: 0,
                        totalRevenue: "0,00",
                        totalCost: "0,00",
                        totalProfit: "0,00",
                        averageProfitMargin: "0,00",
                        topSellingMedicine: "-",
                        criticalStockCount: 0,
                        nearExpiryBatchCount: 0,
                        expiredBatchCount: 0
                    },

                    message: "",
                    messageType: "Information",
                    messageVisible: false
                });

                this.getView().setModel(
                    oModel,
                    "analytics"
                );

                this._loadSessionUser();
                this._loadAnalytics();
            },

            onBack: function () {
                this.getOwnerComponent()
                    .getRouter()
                    .navTo("");
            },

            onRefresh: function () {
                this._loadAnalytics();
            },

            onGenerateDailyReport: function () {
                if (
                    !this._sessionUser ||
                    !this._sessionUser.branchID
                ) {
                    MessageBox.error(
                        "Gün sonu raporu için aktif şube bilgisi bulunamadı."
                    );
                    return;
                }

                MessageBox.confirm(
                    this._sessionUser.branchName +
                    " için bugünün gün sonu raporu oluşturulacak.\n\n" +
                    "Satış, ciro, maliyet, kâr ve stok bilgileri rapora kaydedilecek.",
                    {
                        title: "Gün Sonu Kapanışı",

                        emphasizedAction:
                            MessageBox.Action.OK,

                        actions: [
                            MessageBox.Action.OK,
                            MessageBox.Action.CANCEL
                        ],

                        onClose: function (sAction) {
                            if (
                                sAction ===
                                MessageBox.Action.OK
                            ) {
                                this._generateDailyReport();
                            }
                        }.bind(this)
                    }
                );
            },

            _generateDailyReport: async function () {
                var oModel =
                    this.getView().getModel(
                        "analytics"
                    );

                var sToday =
                    this._getTodayDateString();

                oModel.setProperty(
                    "/busy",
                    true
                );

                try {
                    var oResponse = await fetch(
                        "/odata/v4/pharmacy/generateDailyReport",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                Accept:
                                    "application/json"
                            },

                            body: JSON.stringify({
                                reportDate:
                                    sToday,

                                branchID:
                                    this._sessionUser
                                        .branchID
                            })
                        }
                    );

                    var oResult =
                        await oResponse.json();

                    if (!oResponse.ok) {
                        throw new Error(
                            this._getServiceErrorMessage(
                                oResult
                            )
                        );
                    }

                    var oSummary =
                        oResult.value ||
                        oResult;

                    oModel.setProperty(
                        "/report",
                        {
                            branchName:
                                this._sessionUser
                                    .branchName ||
                                "Şube",

                            reportDate:
                                this._formatDate(
                                    oSummary.reportDate ||
                                    sToday
                                ),

                            createdAt:
                                new Date()
                                    .toLocaleString(
                                        "tr-TR"
                                    ),

                            createdBy:
                                this._sessionUser
                                    .fullName ||
                                "Şube Kullanıcısı",

                            totalSalesCount:
                                Number(
                                    oSummary
                                        .totalSalesCount ||
                                    0
                                ),

                            totalItemsSold:
                                Number(
                                    oSummary
                                        .totalItemsSold ||
                                    0
                                ),

                            totalRevenue:
                                this._formatNumber(
                                    oSummary
                                        .totalRevenue
                                ),

                            totalCost:
                                this._formatNumber(
                                    oSummary
                                        .totalCost
                                ),

                            totalProfit:
                                this._formatNumber(
                                    oSummary
                                        .totalProfit
                                ),

                            averageProfitMargin:
                                this._formatNumber(
                                    oSummary
                                        .averageProfitMargin
                                ),

                            topSellingMedicine:
                                oSummary
                                    .topSellingMedicine ||
                                "Henüz satış yok",

                            criticalStockCount:
                                Number(
                                    oSummary
                                        .criticalStockCount ||
                                    0
                                ),

                            nearExpiryBatchCount:
                                Number(
                                    oSummary
                                        .nearExpiryBatchCount ||
                                    0
                                ),

                            expiredBatchCount:
                                Number(
                                    oSummary
                                        .expiredBatchCount ||
                                    0
                                )
                        }
                    );

                    oModel.setProperty(
                        "/reportCreated",
                        true
                    );

                    oModel.setProperty(
                        "/message",
                        "Gün sonu raporu başarıyla oluşturuldu ve kaydedildi."
                    );

                    oModel.setProperty(
                        "/messageType",
                        "Success"
                    );

                    oModel.setProperty(
                        "/messageVisible",
                        true
                    );

                    MessageBox.success(
                        "Gün sonu raporu başarıyla oluşturuldu.\n\n" +
                        "Şube: " +
                        this._sessionUser.branchName +
                        "\n" +
                        "Satış Sayısı: " +
                        Number(
                            oSummary.totalSalesCount ||
                            0
                        ) +
                        "\n" +
                        "Toplam Ciro: " +
                        this._formatNumber(
                            oSummary.totalRevenue
                        ) +
                        " ₺\n" +
                        "Toplam Kâr: " +
                        this._formatNumber(
                            oSummary.totalProfit
                        ) +
                        " ₺",
                        {
                            title:
                                "Gün Sonu Tamamlandı"
                        }
                    );

                    await this._loadAnalytics(
                        false
                    );
                } catch (oError) {
                    console.error(
                        "Daily report error:",
                        oError
                    );

                    oModel.setProperty(
                        "/message",
                        oError.message ||
                        "Gün sonu raporu oluşturulamadı."
                    );

                    oModel.setProperty(
                        "/messageType",
                        "Error"
                    );

                    oModel.setProperty(
                        "/messageVisible",
                        true
                    );

                    MessageBox.error(
                        oError.message ||
                        "Gün sonu raporu oluşturulurken hata oluştu."
                    );
                } finally {
                    oModel.setProperty(
                        "/busy",
                        false
                    );
                }
            },

            _loadAnalytics: async function (
                bShowToast
            ) {
                var oModel =
                    this.getView().getModel(
                        "analytics"
                    );

                if (
                    !this._sessionUser ||
                    !this._sessionUser.branchID
                ) {
                    oModel.setProperty(
                        "/message",
                        "Aktif şube bilgisi bulunamadı."
                    );

                    oModel.setProperty(
                        "/messageType",
                        "Error"
                    );

                    oModel.setProperty(
                        "/messageVisible",
                        true
                    );

                    return;
                }

                oModel.setProperty(
                    "/busy",
                    true
                );

                oModel.setProperty(
                    "/messageVisible",
                    false
                );

                try {
                    var sToday =
                        this._getTodayDateString();

                    var sUrl =
                        "/odata/v4/pharmacy/getDashboardSummary" +
                        "(reportDate='" +
                        sToday +
                        "',branchID=" +
                        this._sessionUser.branchID +
                        ")";

                    var oResponse =
                        await fetch(
                            sUrl,
                            {
                                headers: {
                                    Accept:
                                        "application/json"
                                }
                            }
                        );

                    var oResult =
                        await oResponse.json();

                    if (!oResponse.ok) {
                        throw new Error(
                            this._getServiceErrorMessage(
                                oResult
                            )
                        );
                    }

                    var oSummary =
                        oResult.value ||
                        oResult;

                    oModel.setProperty(
                        "/summary",
                        {
                            reportDate:
                                oSummary.reportDate ||
                                sToday,

                            totalSalesCount:
                                Number(
                                    oSummary
                                        .totalSalesCount ||
                                    0
                                ),

                            totalItemsSold:
                                Number(
                                    oSummary
                                        .totalItemsSold ||
                                    0
                                ),

                            totalRevenue:
                                this._formatNumber(
                                    oSummary
                                        .totalRevenue
                                ),

                            totalCost:
                                this._formatNumber(
                                    oSummary
                                        .totalCost
                                ),

                            totalProfit:
                                this._formatNumber(
                                    oSummary
                                        .totalProfit
                                ),

                            averageProfitMargin:
                                this._formatNumber(
                                    oSummary
                                        .averageProfitMargin
                                ),

                            topSellingMedicine:
                                oSummary
                                    .topSellingMedicine ||
                                "Henüz satış yok",

                            criticalStockCount:
                                Number(
                                    oSummary
                                        .criticalStockCount ||
                                    0
                                ),

                            nearExpiryBatchCount:
                                Number(
                                    oSummary
                                        .nearExpiryBatchCount ||
                                    0
                                ),

                            expiredBatchCount:
                                Number(
                                    oSummary
                                        .expiredBatchCount ||
                                    0
                                )
                        }
                    );

                    oModel.setProperty(
                        "/message",
                        this._sessionUser.branchName +
                        " analiz verileri başarıyla güncellendi."
                    );

                    oModel.setProperty(
                        "/messageType",
                        "Success"
                    );

                    oModel.setProperty(
                        "/messageVisible",
                        true
                    );

                    if (bShowToast !== false) {
                        MessageToast.show(
                            "Analiz paneli güncellendi."
                        );
                    }
                } catch (oError) {
                    console.error(
                        "Analytics load error:",
                        oError
                    );

                    oModel.setProperty(
                        "/message",
                        oError.message ||
                        "Analiz verileri yüklenemedi."
                    );

                    oModel.setProperty(
                        "/messageType",
                        "Error"
                    );

                    oModel.setProperty(
                        "/messageVisible",
                        true
                    );

                    MessageBox.error(
                        oError.message ||
                        "Analiz verileri yüklenirken hata oluştu."
                    );
                } finally {
                    oModel.setProperty(
                        "/busy",
                        false
                    );
                }
            },

            _loadSessionUser: function () {
                var sSession =
                    sessionStorage.getItem(
                        "pharmatrackUser"
                    );

                if (!sSession) {
                    this._sessionUser = null;
                    return;
                }

                try {
                    this._sessionUser =
                        JSON.parse(
                            sSession
                        );

                    var oModel =
                        this.getView()
                            .getModel(
                                "analytics"
                            );

                    oModel.setProperty(
                        "/branchName",
                        this._sessionUser
                            .branchName ||
                        "Şube"
                    );
                } catch (oError) {
                    console.error(
                        "Session user error:",
                        oError
                    );

                    this._sessionUser = null;
                }
            },

            _getTodayDateString: function () {
                var oToday =
                    new Date();

                var iYear =
                    oToday.getFullYear();

                var sMonth =
                    String(
                        oToday.getMonth() + 1
                    ).padStart(
                        2,
                        "0"
                    );

                var sDay =
                    String(
                        oToday.getDate()
                    ).padStart(
                        2,
                        "0"
                    );

                return (
                    iYear +
                    "-" +
                    sMonth +
                    "-" +
                    sDay
                );
            },

            _formatDate: function (
                sDate
            ) {
                if (!sDate) {
                    return "-";
                }

                var aParts =
                    String(sDate)
                        .substring(0, 10)
                        .split("-");

                if (
                    aParts.length !== 3
                ) {
                    return sDate;
                }

                return (
                    aParts[2] +
                    "." +
                    aParts[1] +
                    "." +
                    aParts[0]
                );
            },

            _formatNumber: function (
                vValue
            ) {
                return Number(
                    vValue || 0
                ).toLocaleString(
                    "tr-TR",
                    {
                        minimumFractionDigits:
                            2,

                        maximumFractionDigits:
                            2
                    }
                );
            },

            _getServiceErrorMessage: function (
                oResult
            ) {
                if (
                    oResult &&
                    oResult.error &&
                    oResult.error.message
                ) {
                    if (
                        typeof oResult
                            .error
                            .message ===
                        "string"
                    ) {
                        return oResult
                            .error
                            .message;
                    }

                    if (
                        oResult.error
                            .message.value
                    ) {
                        return oResult
                            .error
                            .message
                            .value;
                    }
                }

                if (
                    oResult &&
                    oResult.message
                ) {
                    return oResult.message;
                }

                return "Analiz servisine ulaşılamadı.";
            }
        }
    );
});