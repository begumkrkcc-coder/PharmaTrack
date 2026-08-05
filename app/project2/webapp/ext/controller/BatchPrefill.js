sap.ui.define(
  [
    "sap/m/MessageBox",
    "sap/m/MessageToast"
  ],
  function (MessageBox, MessageToast) {
    "use strict";

    return {
      onCreateBatchFromScan: async function () {
        const storageKey = "pharmatrack.pendingBatch";
        const storedData = sessionStorage.getItem(storageKey);

        if (!storedData) {
          MessageBox.warning(
            "Aktarılacak DataMatrix bilgisi bulunamadı.\n\n" +
              "Önce İlaç Yönetimi ekranından karekodu okut."
          );
          return;
        }

        let batchData;

        try {
          batchData = JSON.parse(storedData);
        } catch (error) {
          console.error("Parti verisi okunamadı:", error);
          sessionStorage.removeItem(storageKey);

          MessageBox.error("DataMatrix bilgileri okunamadı.");
          return;
        }

        try {
          /*
           * Fiori custom action içinde this doğrudan ExtensionAPI'dir.
           */
          const extensionAPI = this;

          if (
            !extensionAPI ||
            typeof extensionAPI.getModel !== "function" ||
            typeof extensionAPI.getEditFlow !== "function"
          ) {
            throw new Error("Fiori Extension API erişimi sağlanamadı.");
          }

          const model = extensionAPI.getModel();
          const editFlow = extensionAPI.getEditFlow();

          if (!model) {
            throw new Error("OData modeli bulunamadı.");
          }

          if (!editFlow || typeof editFlow.createDocument !== "function") {
            throw new Error("Yeni parti oluşturma servisine erişilemedi.");
          }

          const listBinding = model.bindList("/MedicineBatches");

          await editFlow.createDocument(listBinding, {
            creationMode: "NewPage",
            data: {
              lotNumber: batchData.lotNumber || "",
              expiryDate: batchData.expiryDate || null,
              medicine_ID: batchData.medicineID || null,
              quantity: 1,
              status: "AVAILABLE",
              isRecalled: false
            }
          });

          sessionStorage.removeItem(storageKey);

          MessageToast.show(
            "İlaç, parti numarası ve SKT forma aktarıldı."
          );
        } catch (error) {
          console.error("Yeni parti ekranı açılamadı:", error);

          MessageBox.error(
            "Yeni parti ekranı açılırken hata oluştu.\n\n" +
              error.message
          );
        }
      }
    };
  }
);