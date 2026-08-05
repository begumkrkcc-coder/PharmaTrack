sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/TextArea",
    "sap/m/Button",
    "sap/m/Label"
], function (
    Controller,
    JSONModel,
    MessageBox,
    MessageToast,
    Dialog,
    TextArea,
    Button,
    Label
) {
    "use strict";

    return Controller.extend(
        "pharmatrack.login.controller.ApprovalCenter",
        {
            onInit: function () {
                var oModel = new JSONModel({
                    allRequests: [],
                    pendingRequests: [],
                    pendingCount: 0,
                    approvedCount: 0,
                    rejectedCount: 0,
                    totalCount: 0,
                    pendingStatusText: "Talepler yükleniyor...",
                    loading: false,
                    error: false,
                    errorMessage: "",
                    empty: false
                });

                this.getView().setModel(
                    oModel,
                    "approval"
                );

                var oRoute = this.getOwnerComponent()
                    .getRouter()
                    .getRoute("approvalCenter");

                if (oRoute) {
                    oRoute.attachPatternMatched(
                        this._onRouteMatched,
                        this
                    );
                }
            },

            _onRouteMatched: function () {
                this._loadRequests();
            },

            _loadRequests: async function () {
                var oModel = this.getView()
                    .getModel("approval");

                oModel.setProperty("/loading", true);
                oModel.setProperty("/error", false);
                oModel.setProperty("/errorMessage", "");
                oModel.setProperty("/empty", false);

                try {
                    var sExpand =
                        "medicine,branch";

                    var sUrl =
                        "/odata/v4/pharmacy/StockEntryRequests" +
                        "?$expand=" +
                        encodeURIComponent(sExpand) +
                        "&$orderby=" +
                        encodeURIComponent(
                            "createdAt desc"
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
                            this._getErrorMessage(
                                oResult
                            )
                        );
                    }

                    var aRequests = (
                        oResult.value || []
                    ).map(
                        this._normalizeRequest.bind(this)
                    );

                    var aPending =
                        aRequests.filter(
                            function (oRequest) {
                                return (
                                    oRequest.status ===
                                    "PENDING"
                                );
                            }
                        );

                    var iApproved =
                        aRequests.filter(
                            function (oRequest) {
                                return (
                                    oRequest.status ===
                                    "APPROVED"
                                );
                            }
                        ).length;

                    var iRejected =
                        aRequests.filter(
                            function (oRequest) {
                                return (
                                    oRequest.status ===
                                    "REJECTED"
                                );
                            }
                        ).length;

                    oModel.setProperty(
                        "/allRequests",
                        aRequests
                    );

                    oModel.setProperty(
                        "/pendingRequests",
                        aPending
                    );

                    oModel.setProperty(
                        "/pendingCount",
                        aPending.length
                    );

                    oModel.setProperty(
                        "/approvedCount",
                        iApproved
                    );

                    oModel.setProperty(
                        "/rejectedCount",
                        iRejected
                    );

                    oModel.setProperty(
                        "/totalCount",
                        aRequests.length
                    );

                    oModel.setProperty(
                        "/pendingStatusText",
                        aPending.length +
                        " Bekleyen Talep"
                    );

                    oModel.setProperty(
                        "/empty",
                        aPending.length === 0
                    );
                } catch (oError) {
                    console.error(
                        "Approval requests error:",
                        oError
                    );

                    oModel.setProperty(
                        "/pendingRequests",
                        []
                    );

                    oModel.setProperty(
                        "/error",
                        true
                    );

                    oModel.setProperty(
                        "/empty",
                        false
                    );

                    oModel.setProperty(
                        "/errorMessage",
                        oError.message ||
                        "Onay talepleri yüklenemedi."
                    );

                    oModel.setProperty(
                        "/pendingStatusText",
                        "Veri alınamadı"
                    );
                } finally {
                    oModel.setProperty(
                        "/loading",
                        false
                    );
                }
            },

            _normalizeRequest: function (oRequest) {
                return {
                    ID: oRequest.ID,

                    requestNumber:
                        oRequest.requestNumber ||
                        "-",

                    status:
                        oRequest.status ||
                        "PENDING",

                    medicineName:
                        oRequest.medicine &&
                        oRequest.medicine.name
                            ? oRequest.medicine.name
                            : "İlaç bilgisi yok",

                    branchName:
                        oRequest.branch &&
                        oRequest.branch.name
                            ? oRequest.branch.name
                            : "Şube bilgisi yok",

                   

                    requestedQuantity:
                        Number(
                            oRequest.requestedQuantity ||
                            0
                        ),

                    quantityText:
                        Number(
                            oRequest.requestedQuantity ||
                            0
                        ) + " adet",

                    lotNumber:
                        oRequest.lotNumber ||
                        "-",

                    expiryDate:
                        oRequest.expiryDate,

                    formattedExpiryDate:
                        this._formatDate(
                            oRequest.expiryDate
                        ),

                    purchasePrice:
                        Number(
                            oRequest.purchasePrice ||
                            0
                        ),

                    formattedPurchasePrice:
                        this._formatCurrency(
                            oRequest.purchasePrice
                        ),

                    proposedSalePrice:
                        Number(
                            oRequest.proposedSalePrice ||
                            0
                        ),

                    formattedSalePrice:
                        this._formatCurrency(
                            oRequest.proposedSalePrice
                        ),

                    createdAt:
                        oRequest.createdAt,

                    createdText:
                        "Talep tarihi: " +
                        this._formatDateTime(
                            oRequest.createdAt
                        )
                };
            },

            onApprove: function (oEvent) {
                var oRequest =
                    this._getRequestFromEvent(
                        oEvent
                    );

                if (!oRequest) {
                    return;
                }

                MessageBox.confirm(
                    oRequest.medicineName +
                    " için oluşturulan " +
                    oRequest.quantityText +
                    " stok girişini onaylamak istiyor musunuz?",
                    {
                        title: "Stok Girişini Onayla",
                        emphasizedAction:
                            MessageBox.Action.OK,

                        actions: [
                            MessageBox.Action.OK,
                            MessageBox.Action.CANCEL
                        ],

                        onClose:
                            function (sAction) {
                                if (
                                    sAction ===
                                    MessageBox.Action.OK
                                ) {
                                    this._approveRequest(
                                        oRequest
                                    );
                                }
                            }.bind(this)
                    }
                );
            },

            _approveRequest: async function (
                oRequest
            ) {
                var oUser =
                    this._getLoggedInUser();

                if (!oUser || !oUser.userID) {
                    MessageBox.error(
                        "Aktif yönetici oturumu bulunamadı."
                    );
                    return;
                }

                this.getView().setBusy(true);

                try {
                    var oResponse = await fetch(
                        "/odata/v4/pharmacy/approveStockEntry",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json",
                                Accept:
                                    "application/json"
                            },
                            body: JSON.stringify({
                                requestID:
                                    oRequest.ID,

                                adminUserID:
                                    oUser.userID,

                                adminNote:
                                    "Onay Merkezi üzerinden onaylandı."
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

                    MessageToast.show(
                        oResult.message ||
                        "Stok girişi onaylandı."
                    );

                    await this._loadRequests();
                } catch (oError) {
                    console.error(
                        "Approve error:",
                        oError
                    );

                    MessageBox.error(
                        oError.message ||
                        "Talep onaylanamadı."
                    );
                } finally {
                    this.getView().setBusy(false);
                }
            },

            onReject: function (oEvent) {
                var oRequest =
                    this._getRequestFromEvent(
                        oEvent
                    );

                if (!oRequest) {
                    return;
                }

                var oReasonInput =
                    new TextArea({
                        width: "100%",
                        rows: 4,
                        maxLength: 500,
                        placeholder:
                            "Talebin reddedilme nedenini yazın..."
                    });

                var oDialog = new Dialog({
                    title:
                        "Stok Giriş Talebini Reddet",

                    contentWidth:
                        "30rem",

                    content: [
                        new Label({
                            text:
                                oRequest.medicineName +
                                " • " +
                                oRequest.branchName
                        }),

                        oReasonInput
                    ],

                    beginButton:
                        new Button({
                            text: "Reddet",
                            type: "Reject",

                            press:
                                async function () {
                                    var sReason =
                                        oReasonInput
                                            .getValue()
                                            .trim();

                                    if (!sReason) {
                                        MessageToast.show(
                                            "Ret nedeni zorunludur."
                                        );
                                        return;
                                    }

                                    oDialog.close();

                                    await this._rejectRequest(
                                        oRequest,
                                        sReason
                                    );
                                }.bind(this)
                        }),

                    endButton:
                        new Button({
                            text: "Vazgeç",
                            press: function () {
                                oDialog.close();
                            }
                        }),

                    afterClose: function () {
                        oDialog.destroy();
                    }
                });

                oDialog.addStyleClass(
                    "sapUiContentPadding"
                );

                oDialog.open();
            },

            _rejectRequest: async function (
                oRequest,
                sReason
            ) {
                var oUser =
                    this._getLoggedInUser();

                if (!oUser || !oUser.userID) {
                    MessageBox.error(
                        "Aktif yönetici oturumu bulunamadı."
                    );
                    return;
                }

                this.getView().setBusy(true);

                try {
                    var oResponse = await fetch(
                        "/odata/v4/pharmacy/rejectStockEntry",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json",
                                Accept:
                                    "application/json"
                            },
                            body: JSON.stringify({
                                requestID:
                                    oRequest.ID,

                                adminUserID:
                                    oUser.userID,

                                reason:
                                    sReason
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

                    MessageToast.show(
                        oResult.message ||
                        "Talep reddedildi."
                    );

                    await this._loadRequests();
                } catch (oError) {
                    console.error(
                        "Reject error:",
                        oError
                    );

                    MessageBox.error(
                        oError.message ||
                        "Talep reddedilemedi."
                    );
                } finally {
                    this.getView().setBusy(false);
                }
            },

            _getRequestFromEvent: function (
                oEvent
            ) {
                var oContext =
                    oEvent.getSource()
                        .getBindingContext(
                            "approval"
                        );

                if (!oContext) {
                    MessageToast.show(
                        "Talep bilgisi bulunamadı."
                    );
                    return null;
                }

                return oContext.getObject();
            },

            _getLoggedInUser: function () {
                var sUser =
                    sessionStorage.getItem(
                        "pharmatrackUser"
                    );

                if (!sUser) {
                    return null;
                }

                try {
                    return JSON.parse(sUser);
                } catch (oError) {
                    return null;
                }
            },

            _formatCurrency: function (vValue) {
                return new Intl.NumberFormat(
                    "tr-TR",
                    {
                        style: "currency",
                        currency: "TRY",
                        minimumFractionDigits: 2
                    }
                ).format(
                    Number(vValue || 0)
                );
            },

            _formatDate: function (sDate) {
                if (!sDate) {
                    return "-";
                }

                return new Intl.DateTimeFormat(
                    "tr-TR"
                ).format(
                    new Date(
                        sDate + "T00:00:00"
                    )
                );
            },

            _formatDateTime: function (
                sDateTime
            ) {
                if (!sDateTime) {
                    return "-";
                }

                return new Intl.DateTimeFormat(
                    "tr-TR",
                    {
                        dateStyle: "medium",
                        timeStyle: "short"
                    }
                ).format(
                    new Date(sDateTime)
                );
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
                            .message === "string"
                    ) {
                        return oResult.error.message;
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
                this._loadRequests();
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