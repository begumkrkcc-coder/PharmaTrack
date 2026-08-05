sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment"
], function (
    Controller,
    JSONModel,
    MessageBox,
    MessageToast,
    Fragment
) {
    "use strict";

    return Controller.extend(
        "pharmatrack.login.controller.SalesHistory",
        {
            onInit: function () {
                var oHistoryModel = new JSONModel({
                    busy: false,
                    allSales: [],
                    filteredSales: [],
                    selectedSale: null,

                    summary: {
                        salesCount: 0,
                        totalQuantity: 0,
                        totalRevenue: 0,
                        insuranceCovered: 0
                    },

                    resultText: "Satış kayıtları yükleniyor...",
                    emptyText: "Satış kaydı bulunamadı."
                });

                this.getView().setModel(
                    oHistoryModel,
                    "history"
                );

                this._loadSessionUser();
                this._loadSalesHistory();
            },

            onBack: function () {
                this.getOwnerComponent()
                    .getRouter()
                    .navTo("sales");
            },

            onRefresh: function () {
                this._loadSalesHistory();
            },

            onFilterChange: function () {
                this._applyFilters();
            },

            onClearFilters: function () {
                this.byId("salesSearchInput")
                    .setValue("");

                this.byId("saleTypeFilter")
                    .setSelectedKey("ALL");

                this.byId("startDatePicker")
                    .setValue("");

                this.byId("endDatePicker")
                    .setValue("");

                this._applyFilters();

                MessageToast.show(
                    "Satış filtreleri temizlendi."
                );
            },

            onOpenInvoice: async function (oEvent) {
                var oSource = oEvent.getSource();

                var oContext =
                    oSource.getBindingContext("history");

                if (!oContext && oSource.getParent) {
                    oContext = oSource
                        .getParent()
                        .getBindingContext("history");
                }

                if (!oContext) {
                    MessageBox.error(
                        "Satış bilgisine ulaşılamadı."
                    );
                    return;
                }

                var oSale = oContext.getObject();

                this.getView()
                    .getModel("history")
                    .setProperty(
                        "/selectedSale",
                        oSale
                    );

                if (!this._oInvoiceDialog) {
                    this._oInvoiceDialog =
                        await Fragment.load({
                            id: this.getView().getId(),
                            name:
                               "pharmatrack.login.view.SalesInvoice",
                            controller: this
                        });

                    this.getView().addDependent(
                        this._oInvoiceDialog
                    );
                }

                this._oInvoiceDialog.open();
            },

            onCloseInvoice: function () {
                if (this._oInvoiceDialog) {
                    this._oInvoiceDialog.close();
                }
            },

            onPrintInvoice: function () {
                var oSale = this.getView()
                    .getModel("history")
                    .getProperty("/selectedSale");

                if (!oSale) {
                    MessageBox.warning(
                        "Yazdırılacak satış bulunamadı."
                    );
                    return;
                }

                var sItemsHtml = (
                    oSale.items || []
                ).map(function (oItem) {
                    return (
                        "<tr>" +
                            "<td>" +
                                this._escapeHtml(
                                    oItem.medicineName
                                ) +
                            "</td>" +
                            "<td>" +
                                this._escapeHtml(
                                    oItem.barcode
                                ) +
                            "</td>" +
                            "<td>" +
                                this._escapeHtml(
                                    oItem.lotNumber
                                ) +
                            "</td>" +
                            "<td class='center'>" +
                                Number(
                                    oItem.quantity || 0
                                ) +
                            "</td>" +
                            "<td class='right'>" +
                                this.formatCurrency(
                                    oItem.unitSalePrice
                                ) +
                                " ₺" +
                            "</td>" +
                            "<td class='right'>" +
                                this.formatCurrency(
                                    oItem.lineAmount
                                ) +
                                " ₺" +
                            "</td>" +
                        "</tr>"
                    );
                }.bind(this)).join("");

                var sHtml =
                    "<!DOCTYPE html>" +
                    "<html lang='tr'>" +
                    "<head>" +
                        "<meta charset='UTF-8'>" +
                        "<title>PharmaTrack Fatura</title>" +

                        "<style>" +
                            "body{" +
                                "font-family:Arial,sans-serif;" +
                                "color:#1f2937;" +
                                "margin:36px;" +
                            "}" +

                            ".header{" +
                                "display:flex;" +
                                "justify-content:space-between;" +
                                "border-bottom:3px solid #0f766e;" +
                                "padding-bottom:20px;" +
                                "margin-bottom:24px;" +
                            "}" +

                            ".brand{" +
                                "font-size:28px;" +
                                "font-weight:700;" +
                                "color:#0f766e;" +
                            "}" +

                            ".subtitle{" +
                                "font-size:13px;" +
                                "color:#6b7280;" +
                                "margin-top:5px;" +
                            "}" +

                            ".invoice-title{" +
                                "font-size:22px;" +
                                "font-weight:700;" +
                                "text-align:right;" +
                            "}" +

                            ".info-grid{" +
                                "display:grid;" +
                                "grid-template-columns:1fr 1fr;" +
                                "gap:12px 30px;" +
                                "margin-bottom:25px;" +
                            "}" +

                            ".info-box{" +
                                "background:#f8fafc;" +
                                "padding:12px;" +
                                "border-radius:8px;" +
                            "}" +

                            ".label{" +
                                "font-size:11px;" +
                                "color:#64748b;" +
                                "text-transform:uppercase;" +
                            "}" +

                            ".value{" +
                                "font-size:14px;" +
                                "font-weight:600;" +
                                "margin-top:4px;" +
                            "}" +

                            "table{" +
                                "width:100%;" +
                                "border-collapse:collapse;" +
                                "margin-top:20px;" +
                            "}" +

                            "th{" +
                                "background:#0f766e;" +
                                "color:white;" +
                                "padding:10px;" +
                                "font-size:12px;" +
                                "text-align:left;" +
                            "}" +

                            "td{" +
                                "border-bottom:1px solid #e5e7eb;" +
                                "padding:10px;" +
                                "font-size:12px;" +
                            "}" +

                            ".right{text-align:right;}" +
                            ".center{text-align:center;}" +

                            ".totals{" +
                                "width:360px;" +
                                "margin-left:auto;" +
                                "margin-top:24px;" +
                            "}" +

                            ".total-row{" +
                                "display:flex;" +
                                "justify-content:space-between;" +
                                "padding:8px 0;" +
                            "}" +

                            ".grand-total{" +
                                "border-top:2px solid #0f766e;" +
                                "font-size:18px;" +
                                "font-weight:700;" +
                                "color:#0f766e;" +
                                "padding-top:12px;" +
                            "}" +

                            ".footer{" +
                                "margin-top:42px;" +
                                "padding-top:15px;" +
                                "border-top:1px solid #e5e7eb;" +
                                "text-align:center;" +
                                "font-size:11px;" +
                                "color:#64748b;" +
                            "}" +

                            "@media print{" +
                                "body{margin:18px;}" +
                            "}" +
                        "</style>" +
                    "</head>" +

                    "<body>" +
                        "<div class='header'>" +
                            "<div>" +
                                "<div class='brand'>" +
                                    "PharmaTrack" +
                                "</div>" +

                                "<div class='subtitle'>" +
                                    "Eczane Otomasyon Sistemi" +
                                "</div>" +
                            "</div>" +

                            "<div>" +
                                "<div class='invoice-title'>" +
                                    "SATIŞ FATURASI" +
                                "</div>" +

                                "<div class='subtitle right'>" +
                                    this._escapeHtml(
                                        oSale.saleNumber
                                    ) +
                                "</div>" +
                            "</div>" +
                        "</div>" +

                        "<div class='info-grid'>" +
                            this._createPrintInfoBox(
                                "Satış Numarası",
                                oSale.saleNumber
                            ) +

                            this._createPrintInfoBox(
                                "Satış Tarihi",
                                this.formatDateTime(
                                    oSale.saleDate
                                )
                            ) +

                            this._createPrintInfoBox(
                                "Müşteri",
                                oSale.customerName
                            ) +

                            this._createPrintInfoBox(
                                "Satış Türü",
                                oSale.saleTypeText
                            ) +

                            this._createPrintInfoBox(
                                "Reçete Numarası",
                                oSale.prescriptionNo || "-"
                            ) +

                            this._createPrintInfoBox(
                                "Sigorta Planı",
                                oSale.insurancePlanCodeSnapshot ||
                                "-"
                            ) +
                        "</div>" +

                        "<table>" +
                            "<thead>" +
                                "<tr>" +
                                    "<th>İlaç</th>" +
                                    "<th>Barkod</th>" +
                                    "<th>Parti</th>" +
                                    "<th class='center'>Miktar</th>" +
                                    "<th class='right'>Birim Fiyat</th>" +
                                    "<th class='right'>Toplam</th>" +
                                "</tr>" +
                            "</thead>" +

                            "<tbody>" +
                                sItemsHtml +
                            "</tbody>" +
                        "</table>" +

                        "<div class='totals'>" +
                            this._createPrintTotalRow(
                                "Brüt Tutar",
                                oSale.grossAmount
                            ) +

                            this._createPrintTotalRow(
                                "SGK Karşılanan",
                                oSale.insuranceCoveredAmount
                            ) +

                            this._createPrintTotalRow(
                                "Hasta Katılım Payı",
                                oSale.patientContributionAmount
                            ) +

                            this._createPrintTotalRow(
                                "Fiyat Farkı",
                                oSale.priceDifferenceAmount
                            ) +

                            this._createPrintTotalRow(
                                "Reçete Ücreti",
                                oSale.prescriptionFeeAmount
                            ) +

                            "<div class='total-row grand-total'>" +
                                "<span>Ödenen Tutar</span>" +
                                "<span>" +
                                    this.formatCurrency(
                                        oSale.patientPayableAmount
                                    ) +
                                    " ₺" +
                                "</span>" +
                            "</div>" +
                        "</div>" +

                        "<div class='footer'>" +
                            "Bu belge PharmaTrack Eczane Otomasyon Sistemi tarafından oluşturulmuştur." +
                        "</div>" +

                        "<script>" +
                            "window.onload=function(){" +
                                "window.print();" +
                            "};" +
                        "</script>" +
                    "</body>" +
                    "</html>";

                var oPrintWindow = window.open(
                    "",
                    "_blank",
                    "width=1000,height=750"
                );

                if (!oPrintWindow) {
                    MessageBox.warning(
                        "Yazdırma penceresi açılamadı. Tarayıcı açılır pencere iznini kontrol edin."
                    );
                    return;
                }

                oPrintWindow.document.open();
                oPrintWindow.document.write(sHtml);
                oPrintWindow.document.close();
            },

            _loadSalesHistory: async function () {
                var oModel =
                    this.getView().getModel("history");

                oModel.setProperty("/busy", true);
                oModel.setProperty(
                    "/emptyText",
                    "Satış kayıtları yükleniyor..."
                );

                try {
                    var sExpand =
                        "customer," +
                        "items($expand=medicine,batch)";

                    var sUrl =
                        "/odata/v4/pharmacy/Sales" +
                        "?$expand=" +
                        encodeURIComponent(sExpand) +
                        "&$orderby=" +
                        encodeURIComponent(
                            "saleDate desc"
                        );

                    var oResponse = await fetch(
                        sUrl,
                        {
                            headers: {
                                Accept: "application/json"
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

                    var aSales = (
                        oResult.value || []
                    ).map(
                        this._normalizeSale.bind(this)
                    );

                    oModel.setProperty(
                        "/allSales",
                        aSales
                    );

                    this._applyFilters();
                } catch (oError) {
                    console.error(
                        "Sales history error:",
                        oError
                    );

                    oModel.setProperty(
                        "/allSales",
                        []
                    );

                    oModel.setProperty(
                        "/filteredSales",
                        []
                    );

                    oModel.setProperty(
                        "/emptyText",
                        "Satış geçmişi yüklenemedi."
                    );

                    this._updateSummary([]);

                    MessageBox.error(
                        oError.message ||
                        "Satış geçmişi yüklenirken bir hata oluştu."
                    );
                } finally {
                    oModel.setProperty(
                        "/busy",
                        false
                    );
                }
            },

            _normalizeSale: function (oSale) {
                var bPrescription =
                    oSale.saleType ===
                    "PRESCRIPTION";

                var aItems = (
                    oSale.items || []
                ).map(function (oItem) {
                    return {
                        ID: oItem.ID,

                        medicineName:
                            oItem.medicine &&
                            oItem.medicine.name
                                ? oItem.medicine.name
                                : "İlaç bilgisi yok",

                        barcode:
                            oItem.medicine &&
                            oItem.medicine.barcode
                                ? oItem.medicine.barcode
                                : "-",

                        lotNumber:
                            oItem.batch &&
                            oItem.batch.lotNumber
                                ? oItem.batch.lotNumber
                                : "-",

                        expiryDate:
                            oItem.batch &&
                            oItem.batch.expiryDate
                                ? oItem.batch.expiryDate
                                : null,

                        quantity: Number(
                            oItem.quantity || 0
                        ),

                        unitSalePrice: Number(
                            oItem.unitSalePrice || 0
                        ),

                        lineAmount: Number(
                            oItem.lineAmount || 0
                        ),

                        insuranceCoveredAmount:
                            Number(
                                oItem
                                    .insuranceCoveredAmount ||
                                0
                            ),

                        patientPayableAmount:
                            Number(
                                oItem
                                    .patientPayableAmount ||
                                0
                            )
                    };
                });

                return {
                    ID: oSale.ID,
                    saleNumber:
                        oSale.saleNumber || "-",

                    saleDate:
                        oSale.saleDate || null,

                    saleDateKey:
                        oSale.saleDate
                            ? String(
                                oSale.saleDate
                            ).substring(0, 10)
                            : "",

                    saleType:
                        oSale.saleType ||
                        "NON_PRESCRIPTION",

                    saleTypeText:
                        bPrescription
                            ? "Reçeteli"
                            : "Reçetesiz",

                    saleTypeState:
                        bPrescription
                            ? "Information"
                            : "Success",

                    status:
                        oSale.status ||
                        "COMPLETED",

                    statusText:
                        oSale.status ===
                        "COMPLETED"
                            ? "Tamamlandı"
                            : oSale.status || "-",

                    statusState:
                        oSale.status ===
                        "COMPLETED"
                            ? "Success"
                            : "Warning",

                    totalQuantity: Number(
                        oSale.totalQuantity || 0
                    ),

                    totalAmount: Number(
                        oSale.totalAmount || 0
                    ),

                    grossAmount: Number(
                        oSale.grossAmount ||
                        oSale.totalAmount ||
                        0
                    ),

                    sgkReferenceAmount:
                        Number(
                            oSale
                                .sgkReferenceAmount ||
                            0
                        ),

                    patientContributionAmount:
                        Number(
                            oSale
                                .patientContributionAmount ||
                            0
                        ),

                    priceDifferenceAmount:
                        Number(
                            oSale
                                .priceDifferenceAmount ||
                            0
                        ),

                    prescriptionFeeAmount:
                        Number(
                            oSale
                                .prescriptionFeeAmount ||
                            0
                        ),

                    insuranceCoveredAmount:
                        Number(
                            oSale
                                .insuranceCoveredAmount ||
                            0
                        ),

                    patientPayableAmount:
                        Number(
                            oSale
                                .patientPayableAmount ||
                            oSale.totalAmount ||
                            0
                        ),

                    insurancePlanCodeSnapshot:
                        oSale
                            .insurancePlanCodeSnapshot ||
                        "-",

                    contributionRateSnapshot:
                        Number(
                            oSale
                                .contributionRateSnapshot ||
                            0
                        ),

                    prescriptionNo:
                        oSale.prescriptionNo || "",

                    prescriptionDisplay:
                        oSale.prescriptionNo
                            ? "Reçete: " +
                              oSale.prescriptionNo
                            : "Reçetesiz satış",

                    customerName:
                        oSale.customer &&
                        oSale.customer.fullName
                            ? oSale.customer.fullName
                            : "Perakende Müşteri",

                    customerNationalId:
                        oSale.customer &&
                        oSale.customer.nationalId
                            ? oSale.customer.nationalId
                            : "",

                    items: aItems
                };
            },

            _applyFilters: function () {
                var oModel =
                    this.getView().getModel("history");

                var aSales =
                    oModel.getProperty(
                        "/allSales"
                    ) || [];

                var sSearch =
                    this.byId("salesSearchInput")
                        .getValue()
                        .trim()
                        .toLocaleLowerCase("tr-TR");

                var sSaleType =
                    this.byId("saleTypeFilter")
                        .getSelectedKey();

                var sStartDate =
                    this.byId("startDatePicker")
                        .getValue();

                var sEndDate =
                    this.byId("endDatePicker")
                        .getValue();

                if (
                    sStartDate &&
                    sEndDate &&
                    sStartDate > sEndDate
                ) {
                    MessageBox.warning(
                        "Başlangıç tarihi bitiş tarihinden sonra olamaz."
                    );
                    return;
                }

                var aFiltered =
                    aSales.filter(function (oSale) {
                        var sSearchableText = [
                            oSale.saleNumber,
                            oSale.customerName,
                            oSale.customerNationalId,
                            oSale.prescriptionNo
                        ].join(" ")
                            .toLocaleLowerCase(
                                "tr-TR"
                            );

                        var bSearchMatch =
                            !sSearch ||
                            sSearchableText.includes(
                                sSearch
                            );

                        var bTypeMatch =
                            sSaleType === "ALL" ||
                            oSale.saleType ===
                                sSaleType;

                        var bStartMatch =
                            !sStartDate ||
                            oSale.saleDateKey >=
                                sStartDate;

                        var bEndMatch =
                            !sEndDate ||
                            oSale.saleDateKey <=
                                sEndDate;

                        return (
                            bSearchMatch &&
                            bTypeMatch &&
                            bStartMatch &&
                            bEndMatch
                        );
                    });

                oModel.setProperty(
                    "/filteredSales",
                    aFiltered
                );

                oModel.setProperty(
                    "/resultText",
                    aFiltered.length +
                    " satış kaydı görüntüleniyor."
                );

                oModel.setProperty(
                    "/emptyText",
                    "Seçilen filtrelere uygun satış bulunamadı."
                );

                this._updateSummary(
                    aFiltered
                );
            },

            _updateSummary: function (aSales) {
                var oSummary = aSales.reduce(
                    function (oResult, oSale) {
                        oResult.salesCount += 1;

                        oResult.totalQuantity +=
                            Number(
                                oSale.totalQuantity ||
                                0
                            );

                        oResult.totalRevenue +=
                            Number(
                                oSale.grossAmount ||
                                0
                            );

                        oResult.insuranceCovered +=
                            Number(
                                oSale
                                    .insuranceCoveredAmount ||
                                0
                            );

                        return oResult;
                    },
                    {
                        salesCount: 0,
                        totalQuantity: 0,
                        totalRevenue: 0,
                        insuranceCovered: 0
                    }
                );

                this.getView()
                    .getModel("history")
                    .setProperty(
                        "/summary",
                        oSummary
                    );
            },

            formatCurrency: function (vValue) {
                return Number(
                    vValue || 0
                ).toLocaleString(
                    "tr-TR",
                    {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }
                );
            },

            formatDateTime: function (sValue) {
                if (!sValue) {
                    return "-";
                }

                var oDate = new Date(sValue);

                if (
                    Number.isNaN(
                        oDate.getTime()
                    )
                ) {
                    return sValue;
                }

                return oDate.toLocaleString(
                    "tr-TR",
                    {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                    }
                );
            },

            _createPrintInfoBox: function (
                sLabel,
                sValue
            ) {
                return (
                    "<div class='info-box'>" +
                        "<div class='label'>" +
                            this._escapeHtml(
                                sLabel
                            ) +
                        "</div>" +

                        "<div class='value'>" +
                            this._escapeHtml(
                                sValue || "-"
                            ) +
                        "</div>" +
                    "</div>"
                );
            },

            _createPrintTotalRow: function (
                sLabel,
                nValue
            ) {
                return (
                    "<div class='total-row'>" +
                        "<span>" +
                            this._escapeHtml(
                                sLabel
                            ) +
                        "</span>" +

                        "<span>" +
                            this.formatCurrency(
                                nValue
                            ) +
                            " ₺" +
                        "</span>" +
                    "</div>"
                );
            },

            _escapeHtml: function (vValue) {
                return String(
                    vValue === null ||
                    vValue === undefined
                        ? ""
                        : vValue
                )
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            },

            _getServiceErrorMessage: function (
                oResult
            ) {
                if (!oResult) {
                    return "Servisten geçerli bir cevap alınamadı.";
                }

                if (
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
                        return oResult
                            .error
                            .message
                            .value;
                    }
                }

                if (oResult.message) {
                    return oResult.message;
                }

                return "Satış geçmişi alınamadı.";
            },

            _loadSessionUser: function () {
                var sSession =
                    sessionStorage.getItem(
                        "pharmatrackUser"
                    );

                if (!sSession) {
                    return;
                }

                try {
                    var oUser =
                        JSON.parse(sSession);

                    var oUserName =
                        this.byId(
                            "historyUserName"
                        );

                    var oUserRole =
                        this.byId(
                            "historyUserRole"
                        );

                    if (oUserName) {
                        oUserName.setText(
                            oUser.fullName ||
                            "Kullanıcı"
                        );
                    }

                    if (oUserRole) {
                        oUserRole.setText(
                            this._getRoleText(
                                oUser.role
                            )
                        );
                    }
                } catch (oError) {
                    console.error(
                        "Session user error:",
                        oError
                    );
                }
            },

            _getRoleText: function (sRole) {
                var oRoles = {
                    ADMIN:
                        "Sistem Yöneticisi",

                    PHARMACIST:
                        "Eczacı",

                    WAREHOUSE:
                        "Depo Yetkilisi"
                };

                return (
                    oRoles[sRole] ||
                    sRole ||
                    "Kullanıcı"
                );
            },

            onExit: function () {
                if (this._oInvoiceDialog) {
                    this._oInvoiceDialog.destroy();
                    this._oInvoiceDialog = null;
                }
            }
        }
    );
});