sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (
    Controller,
    JSONModel,
    MessageToast,
    MessageBox
) {
    "use strict";

    return Controller.extend(
        "pharmatrack.login.controller.Sales",
        {
            onInit: function () {
                var oCartModel = new JSONModel({
                    items: [],
                    subtotal: "0.00",
                    discount: "0.00",
                    total: "0.00",
                    hasItems: false
                });

                this.getView().setModel(oCartModel, "cart");

                this._selectedSaleType = "NON_PRESCRIPTION";

                this._loadSessionUser();
            },

            onBack: function () {
                window.location.href =
                    "/login/webapp/index.html";
            },

            onSelectNonPrescription: function () {
    this._selectedSaleType = "NON_PRESCRIPTION";

    this.byId("prescriptionArea")
        .setVisible(false);

    this.byId("nonPrescriptionButton")
        .setType("Emphasized");

    this.byId("prescriptionButton")
        .setType("Default");

    this._selectedCustomerID = null;
},

onSelectPrescription: function () {
    this._selectedSaleType = "PRESCRIPTION";

    this.byId("prescriptionArea")
        .setVisible(true);

    this.byId("nonPrescriptionButton")
        .setType("Default");

    this.byId("prescriptionButton")
        .setType("Emphasized");

    MessageToast.show(
        "Reçeteli satış seçildi. Hasta ve reçete bilgilerini girin."
    );
},

onOpenSalesHistory: function () {
    this.getOwnerComponent()
        .getRouter()
        .navTo("salesHistory");
},

            onLoadPrescription: function () {
                var sNationalId = this.byId(
                    "nationalIdInput"
                ).getValue().trim();

                var sPrescriptionNumber = this.byId(
                    "prescriptionNumberInput"
                ).getValue().trim();

                if (!sNationalId || !sPrescriptionNumber) {
                    MessageBox.warning(
                        "T.C. kimlik numarası ve reçete numarası zorunludur."
                    );
                    return;
                }

                MessageToast.show(
                    "Reçete detayları sonraki adımda servisten getirilecek."
                );
            },

            onAddByBarcode: async function () {
                var sBarcode = this.byId("barcodeInput")
                    .getValue()
                    .trim();

                if (!sBarcode) {
                    this._showBarcodeMessage(
                        "Lütfen barkod numarası girin.",
                        "Warning"
                    );
                    return;
                }

                await this._findAndAddMedicine(sBarcode);
            },

            onScanBarcode: function () {
                sap.ui.require(
                    ["sap/ndc/BarcodeScanner"],
                    function (BarcodeScanner) {
                        BarcodeScanner.scan(
                            function (oResult) {
                                if (
                                    oResult &&
                                    !oResult.cancelled &&
                                    oResult.text
                                ) {
                                    this.byId("barcodeInput")
                                        .setValue(oResult.text);

                                    this._findAndAddMedicine(
                                        oResult.text
                                    );
                                }
                            }.bind(this),

                            function (oError) {
                                MessageBox.error(
                                    "Barkod tarayıcı açılamadı."
                                );

                                console.error(
                                    "Barcode scanner error:",
                                    oError
                                );
                            }
                        );
                    }.bind(this)
                );
            },

            onIncreaseQuantity: function (oEvent) {
                var oContext = oEvent
                    .getSource()
                    .getBindingContext("cart");

                var oItem = oContext.getObject();

                if (
                    Number(oItem.quantity) >=
                    Number(oItem.availableStock)
                ) {
                    MessageBox.warning(
                        "Bu partide yeterli stok bulunmuyor. " +
                        "Mevcut stok: " +
                        oItem.availableStock
                    );
                    return;
                }

                oItem.quantity += 1;

                if (
                    Number(oItem.availableStock) -
                    Number(oItem.quantity) <= 3
                ) {
                    MessageToast.show(
                        "Uyarı: Bu ilacın parti stoğu kritik seviyeye yaklaştı."
                    );
                }

                this._refreshCart();
            },

            onDecreaseQuantity: function (oEvent) {
                var oContext = oEvent
                    .getSource()
                    .getBindingContext("cart");

                var oItem = oContext.getObject();

                if (oItem.quantity > 1) {
                    oItem.quantity -= 1;
                    this._refreshCart();
                    return;
                }

                this._removeItemByPath(
                    oContext.getPath()
                );
            },

            onRemoveItem: function (oEvent) {
                var oContext = oEvent
                    .getSource()
                    .getBindingContext("cart");

                this._removeItemByPath(
                    oContext.getPath()
                );
            },

            onClearCart: function () {
                var aItems = this.getView()
                    .getModel("cart")
                    .getProperty("/items");

                if (aItems.length === 0) {
                    MessageToast.show(
                        "Sepet zaten boş."
                    );
                    return;
                }

                MessageBox.confirm(
                    "Sepetteki tüm ürünler silinsin mi?",
                    {
                        emphasizedAction:
                            MessageBox.Action.OK,

                        onClose: function (sAction) {
                            if (
                                sAction ===
                                MessageBox.Action.OK
                            ) {
                                this.getView()
                                    .getModel("cart")
                                    .setProperty(
                                        "/items",
                                        []
                                    );

                                this._refreshCart();
                            }
                        }.bind(this)
                    }
                );
            },

            onProceedPayment: async function () {
    var oCartModel =
        this.getView().getModel("cart");

    var aItems =
        oCartModel.getProperty("/items") || [];

    if (aItems.length === 0) {
        MessageBox.warning(
            "Ödeme işlemine geçmek için sepete ürün ekleyin."
        );
        return;
    }

    var sFrontendSaleType =
        this._selectedSaleType || "NORMAL";

    var sBackendSaleType =
        sFrontendSaleType === "PRESCRIPTION"
            ? "PRESCRIPTION"
            : "NON_PRESCRIPTION";

    var sPrescriptionNumber = "";

    if (sBackendSaleType === "PRESCRIPTION") {
        sPrescriptionNumber = this.byId(
            "prescriptionNumberInput"
        ).getValue().trim();

        if (!sPrescriptionNumber) {
            MessageBox.warning(
                "Reçeteli satış için reçete numarası zorunludur."
            );
            return;
        }

        if (!this._selectedCustomerID) {
            MessageBox.warning(
                "Önce T.C. kimlik numarasıyla hasta bilgilerini yükleyin."
            );
            return;
        }
    }

    var aSaleItems = aItems.map(
        function (oItem) {
            return {
                barcode: oItem.barcode,
                quantity: Number(oItem.quantity)
            };
        }
    );

    var oRequestBody = {
    saleType: sBackendSaleType,

    branchID:
        this._sessionUser.branchID,

    customerID:
        sBackendSaleType === "PRESCRIPTION"
            ? this._selectedCustomerID
            : null,

    prescriptionNo:
        sBackendSaleType === "PRESCRIPTION"
            ? sPrescriptionNumber
            : null,

    items: aSaleItems
};

    MessageBox.confirm(
        "Satış tamamlanacak ve stoklar güncellenecek. Devam edilsin mi?",
        {
            emphasizedAction:
                MessageBox.Action.OK,

            onClose: async function (sAction) {
                if (
                    sAction !==
                    MessageBox.Action.OK
                ) {
                    return;
                }

                var oPaymentButton =
                    this.byId("proceedPaymentButton");

                try {
                    if (oPaymentButton) {
                        oPaymentButton.setBusy(true);
                    }

                    var oResponse = await fetch(
                        "/odata/v4/pharmacy/completeSale",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json",
                                "Accept":
                                    "application/json"
                            },
                            body: JSON.stringify(
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

                    oCartModel.setProperty(
                        "/items",
                        []
                    );

                    this._refreshCart();

                    this.byId("barcodeInput")
                        .setValue("");

                    this._showBarcodeMessage(
                        "Satış başarıyla tamamlandı.",
                        "Success"
                    );

                    MessageBox.success(
                        "Satış başarıyla tamamlandı.\n\n" +
                        "Satış No: " +
                        oResult.saleNumber +
                        "\n" +
                        "Ürün Adedi: " +
                        oResult.totalQuantity +
                        "\n" +
                        "Toplam Tutar: " +
                        Number(
                            oResult.patientPayableAmount ||
                            oResult.grossAmount ||
                            0
                        ).toLocaleString(
                            "tr-TR",
                            {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            }
                        ) +
                        " ₺",
                        {
                            title:
                                "Satış Tamamlandı"
                        }
                    );
                } catch (oError) {
                    console.error(
                        "Complete sale error:",
                        oError
                    );

                    MessageBox.error(
                        oError.message ||
                        "Satış tamamlanırken bir hata oluştu."
                    );
                } finally {
                    if (oPaymentButton) {
                        oPaymentButton.setBusy(false);
                    }
                }
            }.bind(this)
        }
    );
},

            _findAndAddMedicine: async function (
                sBarcode
            ) {
                this._showBarcodeMessage(
                    "İlaç aranıyor...",
                    "Information"
                );

                try {
                    var oMedicine =
                        await this._findMedicineByBarcode(
                            sBarcode
                        );

                    if (!oMedicine) {
                        this._showBarcodeMessage(
                            "Bu barkoda ait ilaç bulunamadı.",
                            "Error"
                        );
                        return;
                    }

                    if (oMedicine.isActive === false) {
                        this._showBarcodeMessage(
                            "Bu ilaç pasif durumdadır ve satılamaz.",
                            "Error"
                        );
                        return;
                    }

                    if (
                        oMedicine.requiresPrescription &&
                        this._selectedSaleType !==
                            "PRESCRIPTION"
                    ) {
                        MessageBox.warning(
                            oMedicine.name +
                            " yalnızca reçeteli satış ile satılabilir."
                        );

                        this._showBarcodeMessage(
                            "Reçeteli ilaç normal satışa eklenemez.",
                            "Warning"
                        );
                        return;
                    }

                    var oBatch =
                        await this._findAvailableBatch(
                            oMedicine.ID
                        );

                    if (!oBatch) {
                        this._showBarcodeMessage(
                            "Bu ilaç için satılabilir, stokta bulunan ve son kullanma tarihi geçmemiş parti bulunamadı.",
                            "Error"
                        );
                        return;
                    }

                    var bAdded =
                        this._addMedicineToCart(
                            oMedicine,
                            oBatch
                        );

                    if (!bAdded) {
                        return;
                    }

                    this.byId("barcodeInput")
                        .setValue("");

                    this._showBarcodeMessage(
                        oMedicine.name +
                        " sepete eklendi. Parti: " +
                        (oBatch.lotNumber || "-"),
                        "Success"
                    );
                } catch (oError) {
                    console.error(
                        "Medicine lookup error:",
                        oError
                    );

                    this._showBarcodeMessage(
                        oError.message ||
                        "İlaç aranırken hata oluştu.",
                        "Error"
                    );
                }
            },

            _findMedicineByBarcode: async function (
                sBarcode
            ) {
                var sFilter =
                    "barcode eq '" +
                    sBarcode.replace(/'/g, "''") +
                    "'";

                var sUrl =
                    "/odata/v4/pharmacy/Medicines" +
                    "?$filter=" +
                    encodeURIComponent(sFilter) +
                    "&$top=1";

                var oResponse = await fetch(sUrl);

                if (!oResponse.ok) {
                    throw new Error(
                        "İlaç servisine erişilemedi."
                    );
                }

                var oData = await oResponse.json();

                return oData.value &&
                    oData.value.length > 0
                    ? oData.value[0]
                    : null;
            },

            _findAvailableBatch: async function (
                sMedicineID
            ) {
                var sFilter =
    "medicine_ID eq " +
    sMedicineID +
    " and branch_ID eq " +
    this._sessionUser.branchID;

                var sUrl =
                    "/odata/v4/pharmacy/MedicineBatches" +
                    "?$filter=" +
                    encodeURIComponent(sFilter) +
                    "&$orderby=expiryDate asc";

                var oResponse = await fetch(sUrl);

                if (!oResponse.ok) {
                    throw new Error(
                        "İlaç parti bilgilerine erişilemedi."
                    );
                }

                var oData = await oResponse.json();
                var aBatches = oData.value || [];

                var sToday =
                    this._getTodayDateString();

                var aAvailableBatches =
                    aBatches.filter(
                        function (oBatch) {
                            var nQuantity = Number(
                                oBatch.quantity || 0
                            );

                            var sStatus = String(
                                oBatch.status || ""
                            ).toUpperCase();

                            var bValidStatus =
                                !sStatus ||
                                sStatus === "AVAILABLE" ||
                                sStatus === "ACTIVE" ||
                                sStatus === "MEVCUT";

                            var bNotExpired =
                                !oBatch.expiryDate ||
                                String(
                                    oBatch.expiryDate
                                ).substring(0, 10) >=
                                    sToday;

                            var bNotRecalled =
                                oBatch.isRecalled !== true;

                            return (
                                nQuantity > 0 &&
                                bValidStatus &&
                                bNotExpired &&
                                bNotRecalled
                            );
                        }
                    );

                if (
                    aAvailableBatches.length === 0
                ) {
                    return null;
                }

                aAvailableBatches.sort(
                    function (oBatchA, oBatchB) {
                        var sDateA =
                            oBatchA.expiryDate ||
                            "9999-12-31";

                        var sDateB =
                            oBatchB.expiryDate ||
                            "9999-12-31";

                        return sDateA.localeCompare(
                            sDateB
                        );
                    }
                );

                return aAvailableBatches[0];
            },

            _addMedicineToCart: function (
                oMedicine,
                oBatch
            ) {
                var oCartModel =
                    this.getView().getModel("cart");

                var aItems =
                    oCartModel.getProperty("/items");

                var oExistingItem = aItems.find(
                    function (oItem) {
                        return (
                            oItem.medicineID ===
                                oMedicine.ID &&
                            oItem.batchID ===
                                oBatch.ID
                        );
                    }
                );

                if (oExistingItem) {
                    if (
                        Number(
                            oExistingItem.quantity
                        ) >=
                        Number(
                            oExistingItem.availableStock
                        )
                    ) {
                        MessageBox.warning(
                            "Bu partide daha fazla stok bulunmuyor. " +
                            "Mevcut stok: " +
                            oExistingItem.availableStock
                        );

                        this._showBarcodeMessage(
                            "Stok yetersiz olduğu için ürün miktarı artırılamadı.",
                            "Warning"
                        );

                        return false;
                    }

                    oExistingItem.quantity += 1;
                } else {
                    var nUnitPrice = Number(
                        oBatch.salePrice || 0
                    );

                    if (nUnitPrice <= 0) {
                        MessageBox.warning(
                            "Bu parti için geçerli bir satış fiyatı bulunamadı."
                        );
                        return false;
                    }

                    aItems.push({
                        medicineID:
                            oMedicine.ID,

                        batchID:
                            oBatch.ID,

                        name:
                            oMedicine.name ||
                            "İsimsiz İlaç",

                        manufacturer:
                            oMedicine.manufacturer ||
                            "",

                        barcode:
                            oMedicine.barcode || "",

                        requiresPrescription:
                            Boolean(
                                oMedicine
                                    .requiresPrescription
                            ),

                        lotNumber:
                            oBatch.lotNumber || "",

                        expiryDate:
                            oBatch.expiryDate || "",

                        availableStock:
                            Number(
                                oBatch.quantity || 0
                            ),

                        unitPrice:
                            nUnitPrice,

                        quantity:
                            1,

                        lineTotal:
                            nUnitPrice.toFixed(2)
                    });
                }

                oCartModel.setProperty(
                    "/items",
                    aItems
                );

                this._refreshCart();

                var oCurrentItem =
                    oExistingItem ||
                    aItems[aItems.length - 1];

                var nRemainingStock =
                    Number(
                        oCurrentItem.availableStock
                    ) -
                    Number(oCurrentItem.quantity);

                if (nRemainingStock === 0) {
                    MessageBox.warning(
                        "Bu ürün sepete eklendi ancak ilgili partide satılabilir stok kalmadı."
                    );
                } else if (nRemainingStock <= 3) {
                    MessageToast.show(
                        "Kritik stok uyarısı: Bu partide " +
                        nRemainingStock +
                        " adet ürün kaldı."
                    );
                }

                return true;
            },

            _refreshCart: function () {
                var oCartModel =
                    this.getView().getModel("cart");

                var aItems =
                    oCartModel.getProperty("/items");

                var nSubtotal = 0;

                aItems.forEach(function (oItem) {
                    oItem.lineTotal = (
                        Number(oItem.unitPrice) *
                        Number(oItem.quantity)
                    ).toFixed(2);

                    nSubtotal += Number(
                        oItem.lineTotal
                    );
                });

                oCartModel.setProperty(
                    "/items",
                    aItems
                );

                oCartModel.setProperty(
                    "/subtotal",
                    nSubtotal.toFixed(2)
                );

                oCartModel.setProperty(
                    "/discount",
                    "0.00"
                );

                oCartModel.setProperty(
                    "/total",
                    nSubtotal.toFixed(2)
                );

                oCartModel.setProperty(
                    "/hasItems",
                    aItems.length > 0
                );

                oCartModel.refresh(true);

                var oCartCountText =
                    this.byId("cartCountText");

                if (oCartCountText) {
                    oCartCountText.setText(
                        aItems.length === 0
                            ? "Sepette ürün bulunmuyor."
                            : aItems.length +
                              " farklı ürün sepette."
                    );
                }
            },

            _removeItemByPath: function (sPath) {
                var iIndex = Number(
                    sPath.split("/").pop()
                );

                var oCartModel =
                    this.getView().getModel("cart");

                var aItems =
                    oCartModel.getProperty("/items");

                aItems.splice(iIndex, 1);

                oCartModel.setProperty(
                    "/items",
                    aItems
                );

                this._refreshCart();
            },

            _getServiceErrorMessage: function (oResult) {
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

        if (oResult.error.message.value) {
            return oResult.error.message.value;
        }
    }

    if (oResult.message) {
        return oResult.message;
    }

    return "Satış işlemi tamamlanamadı.";
},

            _showBarcodeMessage: function (
                sText,
                sType
            ) {
                var oMessage =
                    this.byId("barcodeMessage");

                if (!oMessage) {
                    MessageToast.show(sText);
                    return;
                }

                oMessage.setText(sText);
                oMessage.setType(sType);
                oMessage.setVisible(true);
            },

            _getTodayDateString: function () {
                var oToday = new Date();

                var iYear =
                    oToday.getFullYear();

                var sMonth = String(
                    oToday.getMonth() + 1
                ).padStart(2, "0");

                var sDay = String(
                    oToday.getDate()
                ).padStart(2, "0");

                return (
                    iYear +
                    "-" +
                    sMonth +
                    "-" +
                    sDay
                );
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
                        
                    this._sessionUser = oUser;

                    var oUserName =
                        this.byId(
                            "salesUserName"
                        );

                    var oUserRole =
                        this.byId(
                            "salesUserRole"
                        );

                    if (oUserName) {
                        oUserName.setText(
                            oUser.fullName
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
                        "Session user read error:",
                        oError
                    );
                }
            },

            _getRoleText: function (sRole) {
                var oRoleTexts = {
                    ADMIN:
                        "Sistem Yöneticisi",
                    PHARMACIST:
                        "Eczacı",
                    WAREHOUSE:
                        "Depo Yetkilisi"
                };

                return (
                    oRoleTexts[sRole] ||
                    sRole
                );
            }
        }
    );
});