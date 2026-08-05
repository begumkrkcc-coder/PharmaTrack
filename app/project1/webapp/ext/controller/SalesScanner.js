sap.ui.define(
  [
    "sap/ndc/BarcodeScanner",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Text",
    "sap/m/Title",
    "sap/m/ObjectStatus",
    "sap/m/RadioButton",
    "sap/m/RadioButtonGroup",
    "sap/m/List",
    "sap/m/CustomListItem",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
  ],
  function (
    BarcodeScanner,
    Dialog,
    Button,
    Input,
    Label,
    VBox,
    HBox,
    Text,
    Title,
    ObjectStatus,
    RadioButton,
    RadioButtonGroup,
    List,
    CustomListItem,
    MessageBox,
    MessageToast
  ) {
    "use strict";

    function extractBarcode(text) {
      const raw = String(text || "").trim();

      if (!raw) {
        return "";
      }

      const gtinMatch = raw.match(/\(01\)(\d{14})/);

      if (gtinMatch) {
        return gtinMatch[1].replace(/^0/, "");
      }

      return raw;
    }

    async function postAction(actionName, body) {
      const response = await fetch(
        "/odata/v4/pharmacy/" + actionName,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(body)
        }
      );

      const data = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        const errorMessage =
          data?.error?.message ||
          data?.message ||
          "İşlem gerçekleştirilemedi.";

        throw new Error(errorMessage);
      }

      return data;
    }

    function findMedicineByBarcode(barcode) {
      return postAction("findMedicineByBarcode", {
        barcode: barcode
      });
    }

    function findCustomerByNationalId(nationalId) {
      return postAction("findCustomerByNationalId", {
        nationalId: nationalId
      });
    }

    function completeSale(payload) {
      return postAction("completeSale", payload);
    }

    function getCustomerTypeText(customer) {
      if (customer.isContributionExempt) {
        return "Katılım Payından Muaf";
      }

      if (customer.isRetired) {
        return "Emekli";
      }

      if (customer.insurancePlanCode === "SGK_WORKER") {
        return "Çalışan";
      }

      if (customer.insurancePlanCode === "PRIVATE") {
        return "Özel Sigortalı";
      }

      if (customer.insurancePlanCode === "NONE") {
        return "Sigortasız";
      }

      return "Standart";
    }

    function formatMoney(value) {
      return (
        Number(value || 0).toFixed(2) + " TL"
      );
    }

    function scanBarcode() {
      return new Promise(function (resolve, reject) {
        BarcodeScanner.scan(
          function (result) {
            if (result.cancelled) {
              resolve("");
              return;
            }

            resolve(
              extractBarcode(result.text)
            );
          },
          function (error) {
            reject(error);
          }
        );
      });
    }

    function openCartDialog(
      extensionAPI,
      initialBarcode
    ) {
      const cart = [];
      let selectedCustomer = null;

      const cartList = new List({
        showSeparators: "Inner",
        noDataText:
          "Sepet boş. Barkod okutarak ürün ekleyin."
      });

      const totalQuantityText = new Text({
        text: "0"
      });

      const totalAmountText = new ObjectStatus({
        text: "0.00 TL",
        state: "Success"
      });

      const cartCountTitle = new Title({
        text: "Satış Sepeti (0)",
        level: "H4"
      });

      const manualBarcodeInput = new Input({
        placeholder:
          "Barkodu elle yazabilirsiniz",
        width: "100%",
        submit: function () {
          addManualBarcode();
        }
      });

      const nationalIdInput = new Input({
        placeholder:
          "11 haneli demo TC kimlik numarası",
        maxLength: 11,
        width: "100%",

        liveChange: function () {
          selectedCustomer = null;
          customerInformationBox.setVisible(false);
        }
      });

      const prescriptionInput = new Input({
        placeholder: "Reçete numarasını giriniz",
        width: "100%"
      });

      const customerNameText = new Text({
        text: "-"
      });

      const customerNumberText = new Text({
        text: "-"
      });

      const customerTypeText = new Text({
        text: "-"
      });

      const insurancePlanText = new Text({
        text: "-"
      });

      const contributionRateText = new Text({
        text: "-"
      });

      const insuranceStatus = new ObjectStatus({
        text: "Sorgulanmadı",
        state: "None"
      });

      const customerInformationBox = new VBox({
        visible: false,
        width: "100%",
        class:
          "sapUiSmallMarginTop sapUiSmallMarginBottom",

        items: [
          new ObjectStatus({
            text: "Hasta bulundu",
            state: "Success",
            icon: "sap-icon://accept"
          }),

          new HBox({
            class: "sapUiTinyMarginTop",
            items: [
              new Text({
                text: "Hasta:",
                width: "9rem"
              }),
              customerNameText
            ]
          }),

          new HBox({
            class: "sapUiTinyMarginTop",
            items: [
              new Text({
                text: "Müşteri No:",
                width: "9rem"
              }),
              customerNumberText
            ]
          }),

          new HBox({
            class: "sapUiTinyMarginTop",
            items: [
              new Text({
                text: "Hasta Grubu:",
                width: "9rem"
              }),
              customerTypeText
            ]
          }),

          new HBox({
            class: "sapUiTinyMarginTop",
            items: [
              new Text({
                text: "Sigorta Planı:",
                width: "9rem"
              }),
              insurancePlanText
            ]
          }),

          new HBox({
            class: "sapUiTinyMarginTop",
            items: [
              new Text({
                text: "Katılım Payı:",
                width: "9rem"
              }),
              contributionRateText
            ]
          }),

          new HBox({
            class: "sapUiTinyMarginTop",
            items: [
              new Text({
                text: "Sigorta Durumu:",
                width: "9rem"
              }),
              insuranceStatus
            ]
          })
        ]
      });

      const customerLookupButton = new Button({
        text: "Hasta Sorgula",
        icon: "sap-icon://customer",
        type: "Emphasized",
        width: "100%",

        press: async function () {
          const nationalId =
            nationalIdInput.getValue().trim();

          if (!/^\d{11}$/.test(nationalId)) {
            MessageBox.warning(
              "TC kimlik numarası 11 rakamdan oluşmalıdır."
            );
            return;
          }

          customerLookupButton.setBusy(true);
          nationalIdInput.setEnabled(false);

          try {
            const customer =
              await findCustomerByNationalId(
                nationalId
              );

            selectedCustomer = customer;

            customerNameText.setText(
              customer.fullName || "-"
            );

            customerNumberText.setText(
              customer.customerNumber || "-"
            );

            customerTypeText.setText(
              getCustomerTypeText(customer)
            );

            insurancePlanText.setText(
              customer.insurancePlanName || "-"
            );

            contributionRateText.setText(
              "%" +
                Number(
                  customer.patientContributionRate ||
                    0
                ).toFixed(2)
            );

            insuranceStatus.setText(
              customer.insuranceStatus === "ACTIVE"
                ? "Aktif"
                : customer.insuranceStatus || "-"
            );

            insuranceStatus.setState(
              customer.insuranceStatus === "ACTIVE"
                ? "Success"
                : "Error"
            );

            customerInformationBox.setVisible(
              true
            );

            MessageToast.show(
              "Hasta ve sigorta bilgileri bulundu."
            );
          } catch (error) {
            selectedCustomer = null;

            customerInformationBox.setVisible(
              false
            );

            MessageBox.error(error.message, {
              title: "Hasta Bulunamadı"
            });
          } finally {
            customerLookupButton.setBusy(false);
            nationalIdInput.setEnabled(true);
          }
        }
      });

      const prescriptionFieldsBox = new VBox({
        visible: false,
        width: "100%",

        items: [
          new Label({
            text: "TC Kimlik Numarası",
            required: true,
            class: "sapUiSmallMarginTop"
          }),

          nationalIdInput,

          new VBox({
            class: "sapUiTinyMarginTop",
            items: [
              customerLookupButton
            ]
          }),

          customerInformationBox,

          new Label({
            text: "Reçete Numarası",
            required: true,
            class: "sapUiSmallMarginTop"
          }),

          prescriptionInput
        ]
      });

      const nonPrescriptionRadio =
        new RadioButton({
          text: "Reçetesiz Satış"
        });

      const prescriptionRadio =
        new RadioButton({
          text: "Reçeteli Satış"
        });

      const saleTypeGroup =
        new RadioButtonGroup({
          columns: 2,
          selectedIndex: 0,

          buttons: [
            nonPrescriptionRadio,
            prescriptionRadio
          ],

          select: function (event) {
            const prescriptionSale =
              event.getParameter(
                "selectedIndex"
              ) === 1;

            prescriptionFieldsBox.setVisible(
              prescriptionSale
            );

            if (!prescriptionSale) {
              selectedCustomer = null;

              nationalIdInput.setValue("");
              prescriptionInput.setValue("");

              customerInformationBox.setVisible(
                false
              );
            }
          }
        });

      function cartHasPrescriptionMedicine() {
        return cart.some(function (item) {
          return item.requiresPrescription;
        });
      }

      function updateSaleTypeRules() {
        const prescriptionRequired =
          cartHasPrescriptionMedicine();

        nonPrescriptionRadio.setEnabled(
          !prescriptionRequired
        );

        if (prescriptionRequired) {
          saleTypeGroup.setSelectedIndex(1);
          prescriptionFieldsBox.setVisible(true);
        }
      }

      function calculateCartSummary() {
        return cart.reduce(
          function (summary, item) {
            summary.quantity += item.quantity;

            summary.amount +=
              item.quantity *
              Number(item.currentSalePrice || 0);

            return summary;
          },
          {
            quantity: 0,
            amount: 0
          }
        );
      }

      function changeQuantity(
        barcode,
        difference
      ) {
        const item = cart.find(function (
          cartItem
        ) {
          return cartItem.barcode === barcode;
        });

        if (!item) {
          return;
        }

        const newQuantity =
          item.quantity + difference;

        if (newQuantity <= 0) {
          removeItem(barcode);
          return;
        }

        if (
          newQuantity >
          Number(item.totalStock || 0)
        ) {
          MessageBox.warning(
            item.medicineName +
              " için en fazla " +
              item.totalStock +
              " adet satılabilir."
          );
          return;
        }

        item.quantity = newQuantity;
        renderCart();
      }

      function removeItem(barcode) {
        const index = cart.findIndex(function (
          item
        ) {
          return item.barcode === barcode;
        });

        if (index >= 0) {
          cart.splice(index, 1);
        }

        renderCart();

        if (!cartHasPrescriptionMedicine()) {
          nonPrescriptionRadio.setEnabled(true);
        }
      }

      function createCartItemControl(item) {
        const quantityText = new ObjectStatus({
          text: String(item.quantity),
          state: "Information"
        });

        return new CustomListItem({
          content: [
            new VBox({
              width: "100%",
              class: "sapUiTinyMargin",

              items: [
                new HBox({
                  width: "100%",
                  justifyContent:
                    "SpaceBetween",
                  alignItems: "Center",

                  items: [
                    new VBox({
                      width: "55%",

                      items: [
                        new Text({
                          text:
                            item.medicineName,
                          wrapping: true
                        }),

                        new Text({
                          text:
                            item.barcode,
                          wrapping: false
                        }),

                        new ObjectStatus({
                          text:
                            item.requiresPrescription
                              ? "Reçete gerekli"
                              : "Reçetesiz satılabilir",

                          state:
                            item.requiresPrescription
                              ? "Warning"
                              : "Success"
                        })
                      ]
                    }),

                    new VBox({
                      alignItems: "End",

                      items: [
                        new Text({
                          text:
                            formatMoney(
                              item.currentSalePrice
                            )
                        }),

                        new Text({
                          text:
                            "Ara toplam: " +
                            formatMoney(
                              Number(
                                item.currentSalePrice ||
                                  0
                              ) *
                                item.quantity
                            )
                        })
                      ]
                    })
                  ]
                }),

                new HBox({
                  width: "100%",
                  class: "sapUiTinyMarginTop",
                  justifyContent:
                    "SpaceBetween",
                  alignItems: "Center",

                  items: [
                    new HBox({
                      alignItems: "Center",

                      items: [
                        new Button({
                          icon:
                            "sap-icon://less",
                          type:
                            "Transparent",

                          press: function () {
                            changeQuantity(
                              item.barcode,
                              -1
                            );
                          }
                        }),

                        quantityText,

                        new Button({
                          icon:
                            "sap-icon://add",
                          type:
                            "Transparent",

                          press: function () {
                            changeQuantity(
                              item.barcode,
                              1
                            );
                          }
                        })
                      ]
                    }),

                    new Button({
                      icon: "sap-icon://delete",
                      type: "Transparent",
                      tooltip:
                        "Ürünü sepetten çıkar",

                      press: function () {
                        removeItem(
                          item.barcode
                        );
                      }
                    })
                  ]
                })
              ]
            })
          ]
        });
      }

      function renderCart() {
        cartList.removeAllItems();

        cart.forEach(function (item) {
          cartList.addItem(
            createCartItemControl(item)
          );
        });

        const summary =
          calculateCartSummary();

        cartCountTitle.setText(
          "Satış Sepeti (" +
            summary.quantity +
            ")"
        );

        totalQuantityText.setText(
          String(summary.quantity)
        );

        totalAmountText.setText(
          formatMoney(summary.amount)
        );

        updateSaleTypeRules();
      }

      async function addMedicineToCart(
        barcode
      ) {
        const normalizedBarcode =
          extractBarcode(barcode);

        if (!normalizedBarcode) {
          MessageBox.warning(
            "Geçerli bir barkod giriniz."
          );
          return;
        }

        dialog.setBusy(true);

        try {
          const medicine =
            await findMedicineByBarcode(
              normalizedBarcode
            );

          if (
            Number(medicine.totalStock || 0) <=
            0
          ) {
            throw new Error(
              medicine.medicineName +
                " için satılabilir stok bulunmuyor."
            );
          }

          const existingItem =
            cart.find(function (item) {
              return (
                item.barcode ===
                medicine.barcode
              );
            });

          if (existingItem) {
            if (
              existingItem.quantity + 1 >
              Number(
                existingItem.totalStock || 0
              )
            ) {
              throw new Error(
                medicine.medicineName +
                  " için yeterli stok bulunmuyor."
              );
            }

            existingItem.quantity += 1;

            MessageToast.show(
              medicine.medicineName +
                " adedi artırıldı."
            );
          } else {
            cart.push({
              medicineID:
                medicine.medicineID,

              medicineName:
                medicine.medicineName,

              barcode:
                medicine.barcode,

              quantity: 1,

              currentSalePrice:
                Number(
                  medicine.currentSalePrice ||
                    0
                ),

              totalStock:
                Number(
                  medicine.totalStock || 0
                ),

              requiresPrescription:
                Boolean(
                  medicine.requiresPrescription
                ),

              nearestExpiryDate:
                medicine.nearestExpiryDate,

              shelfCode:
                medicine.shelfCode
            });

            MessageToast.show(
              medicine.medicineName +
                " sepete eklendi."
            );
          }

          manualBarcodeInput.setValue("");
          renderCart();
        } catch (error) {
          MessageBox.error(error.message, {
            title: "Ürün Eklenemedi"
          });
        } finally {
          dialog.setBusy(false);
        }
      }

      async function addManualBarcode() {
        const barcode =
          manualBarcodeInput
            .getValue()
            .trim();

        await addMedicineToCart(barcode);
      }

      const dialog = new Dialog({
        title: "Eczane Satış Sepeti",
        contentWidth: "42rem",
        contentHeight: "44rem",
        verticalScrolling: true,

        content: [
          new VBox({
            width: "100%",
            class: "sapUiSmallMargin",

            items: [
              new Title({
                text: "Ürün Ekle",
                level: "H4"
              }),

              new HBox({
                width: "100%",
                alignItems: "Center",
                class: "sapUiTinyMarginTop",

                items: [
                  manualBarcodeInput,

                  new Button({
                    text: "Ekle",
                    icon: "sap-icon://add",
                    type: "Emphasized",
                    class:
                      "sapUiTinyMarginBegin",

                    press: addManualBarcode
                  })
                ]
              }),

              new Button({
                text: "Yeni Barkod Tara",
                icon:
                  "sap-icon://bar-code",
                width: "100%",
                class:
                  "sapUiTinyMarginTop",

                press: async function () {
                  try {
                    const barcode =
                      await scanBarcode();

                    if (!barcode) {
                      MessageToast.show(
                        "Tarama iptal edildi."
                      );
                      return;
                    }

                    await addMedicineToCart(
                      barcode
                    );
                  } catch (error) {
                    MessageBox.error(
                      "Barkod okuyucu başlatılamadı."
                    );
                  }
                }
              }),

              new VBox({
                class:
                  "sapUiMediumMarginTop",

                items: [
                  cartCountTitle,
                  cartList
                ]
              }),

              new HBox({
                width: "100%",
                class:
                  "sapUiSmallMarginTop",
                justifyContent:
                  "SpaceBetween",

                items: [
                  new Text({
                    text: "Toplam ürün:"
                  }),

                  totalQuantityText
                ]
              }),

              new HBox({
                width: "100%",
                class:
                  "sapUiTinyMarginTop",
                justifyContent:
                  "SpaceBetween",

                items: [
                  new Text({
                    text: "Sepet toplamı:"
                  }),

                  totalAmountText
                ]
              }),

              new Label({
                text: "Satış Türü",
                required: true,
                class:
                  "sapUiMediumMarginTop"
              }),

              saleTypeGroup,

              prescriptionFieldsBox
            ]
          })
        ],

        beginButton: new Button({
          text: "Satışı Tamamla",
          type: "Emphasized",
          icon: "sap-icon://complete",

          press: async function () {
            if (cart.length === 0) {
              MessageBox.warning(
                "Satış sepeti boş olamaz."
              );
              return;
            }

            const prescriptionSale =
              saleTypeGroup.getSelectedIndex() ===
              1;

            const nationalId =
              nationalIdInput
                .getValue()
                .trim();

            const prescriptionNo =
              prescriptionInput
                .getValue()
                .trim();

            if (
              cartHasPrescriptionMedicine() &&
              !prescriptionSale
            ) {
              MessageBox.error(
                "Sepette reçeteyle satılması gereken bir ilaç bulunmaktadır."
              );
              return;
            }

            if (prescriptionSale) {
              if (
                !/^\d{11}$/.test(nationalId)
              ) {
                MessageBox.warning(
                  "Reçeteli satış için 11 haneli TC kimlik numarası girilmelidir."
                );
                return;
              }

              if (!selectedCustomer) {
                MessageBox.warning(
                  "Önce Hasta Sorgula butonuyla hasta doğrulanmalıdır."
                );
                return;
              }

              if (!prescriptionNo) {
                MessageBox.warning(
                  "Reçeteli satış için reçete numarası zorunludur."
                );
                return;
              }
            }

            const payload = {
              saleType: prescriptionSale
                ? "PRESCRIPTION"
                : "NON_PRESCRIPTION",

              customerID:
                prescriptionSale
                  ? selectedCustomer.customerID
                  : null,

              prescriptionNo:
                prescriptionSale
                  ? prescriptionNo
                  : null,

              items: cart.map(function (
                item
              ) {
                return {
                  barcode: item.barcode,
                  quantity: item.quantity
                };
              })
            };

            dialog.setBusy(true);

            try {
              const result =
                await completeSale(payload);

              dialog.close();

              const itemLines =
                (result.items || [])
                  .map(function (item) {
                    return (
                      item.medicineName +
                      " × " +
                      item.quantity +
                      " = " +
                      formatMoney(
                        item.grossAmount
                      )
                    );
                  })
                  .join("\n");

              let paymentDetails =
                "\n\nToplam ürün: " +
                (result.totalQuantity || 0) +
                "\nBrüt tutar: " +
                formatMoney(
                  result.grossAmount
                );

              if (prescriptionSale) {
                paymentDetails +=
                  "\nSGK karşılama: " +
                  formatMoney(
                    result.insuranceCoveredAmount
                  ) +
                  "\nHasta katılım payı: " +
                  formatMoney(
                    result.patientContributionAmount
                  ) +
                  "\nFiyat farkı: " +
                  formatMoney(
                    result.priceDifferenceAmount
                  ) +
                  "\nReçete bedeli: " +
                  formatMoney(
                    result.prescriptionFeeAmount
                  ) +
                  "\nHastanın ödeyeceği: " +
                  formatMoney(
                    result.patientPayableAmount
                  );
              } else {
                paymentDetails +=
                  "\nÖdenecek toplam: " +
                  formatMoney(
                    result.patientPayableAmount
                  );
              }

              MessageBox.success(
                (result.message ||
                  "Satış başarıyla tamamlandı.") +
                  "\n\n" +
                  itemLines +
                  paymentDetails,
                {
                  title: "Sepet Satışı Başarılı"
                }
              );

              try {
                extensionAPI
                  .getModel()
                  .refresh();
              } catch (refreshError) {
                console.warn(
                  "Liste yenilenemedi:",
                  refreshError
                );
              }
            } catch (error) {
              MessageBox.error(error.message, {
                title:
                  "Satış Tamamlanamadı"
              });
            } finally {
              dialog.setBusy(false);
            }
          }
        }),

        endButton: new Button({
          text: "İptal",

          press: function () {
            if (cart.length === 0) {
              dialog.close();
              return;
            }

            MessageBox.confirm(
              "Sepetteki ürünler silinecek. Satışı iptal etmek istiyor musunuz?",
              {
                title: "Satışı İptal Et",

                onClose: function (action) {
                  if (
                    action ===
                    MessageBox.Action.OK
                  ) {
                    dialog.close();
                  }
                }
              }
            );
          }
        }),

        afterClose: function () {
          dialog.destroy();
        }
      });

      dialog.open();

      addMedicineToCart(initialBarcode);
    }

    return {
      onSellByBarcode: function () {
        const extensionAPI = this;

        BarcodeScanner.scan(
          function (result) {
            if (result.cancelled) {
              MessageToast.show(
                "Satış taraması iptal edildi."
              );
              return;
            }

            const barcode =
              extractBarcode(result.text);

            if (!barcode) {
              MessageBox.warning(
                "Geçerli bir barkod veya DataMatrix okunamadı."
              );
              return;
            }

            openCartDialog(
              extensionAPI,
              barcode
            );
          },

          function (error) {
            console.error(
              "Kamera hatası:",
              error
            );

            MessageBox.error(
              "Kamera veya barkod okuyucu başlatılamadı."
            );
          }
        );
      }
    };
  }
);