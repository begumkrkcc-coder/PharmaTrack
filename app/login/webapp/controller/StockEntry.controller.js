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
        "pharmatrack.login.controller.StockEntry",
        {
            onInit: function () {
                this._selectedMedicine = null;
                this._loadSessionUser();

                var oMedicineModel =
                    new JSONModel({
                        items: []
                    });

                this.getView().setModel(
                    oMedicineModel,
                    "medicine"
                );
            },

            onBack: function () {
                this.getOwnerComponent()
                    .getRouter()
                    .navTo("");
            },

            _loadSessionUser: function () {
                var sSession =
                    sessionStorage.getItem(
                        "pharmatrackUser"
                    );

                if (!sSession) {
                    MessageBox.error(
                        "Oturum bilgisi bulunamadı."
                    );

                    return;
                }

                try {
                    this._sessionUser =
                        JSON.parse(sSession);
                } catch (oError) {
                    MessageBox.error(
                        "Oturum bilgisi okunamadı."
                    );
                }
            },

            onMedicineLiveChange: function (
                oEvent
            ) {
                var sValue =
                    oEvent.getParameter(
                        "newValue"
                    );

                if (
                    !sValue ||
                    sValue.trim().length < 2
                ) {
                    this.byId(
                        "medicineResultList"
                    ).setVisible(false);

                    return;
                }

                this._searchMedicines(
                    sValue.trim()
                );
            },

            onSearchMedicine: function (
                oEvent
            ) {
                var sQuery =
                    oEvent.getParameter(
                        "query"
                    );

                if (!sQuery) {
                    MessageToast.show(
                        "İlaç adı veya barkod girin."
                    );

                    return;
                }

                this._searchMedicines(
                    sQuery.trim()
                );
            },

            _searchMedicines: async function (
                sQuery
            ) {
                try {
                    var sSafeQuery =
                        sQuery.replace(
                            /'/g,
                            "''"
                        );

                    var sFilter =
                        "contains(name,'" +
                        sSafeQuery +
                        "') or contains(barcode,'" +
                        sSafeQuery +
                        "')";

                    var sUrl =
                        "/odata/v4/pharmacy/Medicines" +
                        "?$filter=" +
                        encodeURIComponent(
                            sFilter
                        ) +
                        "&$top=20";

                    var oResponse =
                        await fetch(sUrl);

                    if (!oResponse.ok) {
                        throw new Error(
                            "İlaç kataloğuna erişilemedi."
                        );
                    }

                    var oData =
                        await oResponse.json();

                    var aMedicines =
                        oData.value || [];

                    this.getView()
                        .getModel("medicine")
                        .setProperty(
                            "/items",
                            aMedicines
                        );

                    this.byId(
                        "medicineResultList"
                    ).setVisible(
                        aMedicines.length > 0
                    );

                    if (
                        aMedicines.length === 0
                    ) {
                        this._showMessage(
                            "Aramanıza uygun ilaç bulunamadı.",
                            "Warning"
                        );
                    }
                } catch (oError) {
                    this._showMessage(
                        oError.message,
                        "Error"
                    );
                }
            },

            onMedicineSelected: function (
                oEvent
            ) {
                var oItem =
                    oEvent.getParameter(
                        "listItem"
                    );

                if (!oItem) {
                    return;
                }

                var oContext =
                    oItem.getBindingContext(
                        "medicine"
                    );

                this._selectedMedicine =
                    oContext.getObject();

                this.byId(
                    "selectedMedicineStatus"
                )
                    .setText(
                        "Seçilen ilaç: " +
                        this._selectedMedicine
                            .name +
                        " • " +
                        this._selectedMedicine
                            .barcode
                    )
                    .setVisible(true);

                this.byId(
                    "medicineResultList"
                ).setVisible(false);
            },

            onSubmit: async function () {
                if (
                    !this._sessionUser ||
                    !this._sessionUser.branchID
                ) {
                    MessageBox.error(
                        "Bu kullanıcıya bağlı şube bulunamadı."
                    );

                    return;
                }

                if (!this._selectedMedicine) {
                    MessageBox.warning(
                        "Önce katalogdan bir ilaç seçin."
                    );

                    return;
                }

                var sLot =
                    this.byId(
                        "lotNumberInput"
                    ).getValue().trim();

                var sExpiry =
                    this.byId(
                        "expiryDateInput"
                    ).getValue();

                var iQuantity =
                    Number(
                        this.byId(
                            "quantityInput"
                        ).getValue()
                    );

                var nPurchasePrice =
                    Number(
                        this.byId(
                            "purchasePriceInput"
                        ).getValue()
                    );

                var nSalePrice =
                    Number(
                        this.byId(
                            "salePriceInput"
                        ).getValue()
                    );

                if (
                    !sLot ||
                    !sExpiry ||
                    iQuantity <= 0 ||
                    nPurchasePrice <= 0 ||
                    nSalePrice <= 0
                ) {
                    MessageBox.warning(
                        "Tüm zorunlu alanları doğru şekilde doldurun."
                    );

                    return;
                }

                var oRequestBody = {
                    medicineID:
                        this._selectedMedicine.ID,

                    branchID:
                        this._sessionUser.branchID,

                    requesterUserID:
                        this._sessionUser.userID,

                    quantity:
                        iQuantity,

                    purchasePrice:
                        nPurchasePrice,

                    salePrice:
                        nSalePrice,

                    lotNumber:
                        sLot,

                    expiryDate:
                        sExpiry
                };

                var oButton =
                    this.byId(
                        "submitStockEntryButton"
                    );

                try {
                    oButton.setBusy(true);

                    var oResponse =
                        await fetch(
                            "/odata/v4/pharmacy/createStockEntryRequest",
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type":
                                        "application/json",
                                    Accept:
                                        "application/json"
                                },
                                body:
                                    JSON.stringify(
                                        oRequestBody
                                    )
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

                    MessageBox.success(
                        "Stok giriş talebi oluşturuldu.\n\n" +
                        "Talep No: " +
                        oResult.requestNumber +
                        "\n" +
                        "Durum: Admin Onayı Bekliyor",
                        {
                            title:
                                "Talep Gönderildi",
                            onClose:
                                function () {
                                    this.onClear();
                                }.bind(this)
                        }
                    );
                } catch (oError) {
                    MessageBox.error(
                        oError.message ||
                        "Talep oluşturulamadı."
                    );
                } finally {
                    oButton.setBusy(false);
                }
            },

            onClear: function () {
                this._selectedMedicine = null;

                this.byId(
                    "medicineSearchInput"
                ).setValue("");

                this.byId(
                    "medicineResultList"
                ).setVisible(false);

                this.byId(
                    "selectedMedicineStatus"
                ).setVisible(false);

                this.byId(
                    "lotNumberInput"
                ).setValue("");

                this.byId(
                    "expiryDateInput"
                ).setValue("");

                this.byId(
                    "quantityInput"
                ).setValue(1);

                this.byId(
                    "purchasePriceInput"
                ).setValue("");

                this.byId(
                    "salePriceInput"
                ).setValue("");

                this.byId(
                    "stockEntryMessage"
                ).setVisible(false);
            },

            _showMessage: function (
                sText,
                sType
            ) {
                this.byId(
                    "stockEntryMessage"
                )
                    .setText(sText)
                    .setType(sType)
                    .setVisible(true);
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
                            .error.message ===
                        "string"
                    ) {
                        return oResult
                            .error.message;
                    }

                    if (
                        oResult.error.message
                            .value
                    ) {
                        return oResult
                            .error.message.value;
                    }
                }

                return (
                    oResult.message ||
                    "Servisten geçerli cevap alınamadı."
                );
            }
        }
    );
});