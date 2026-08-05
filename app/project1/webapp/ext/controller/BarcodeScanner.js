sap.ui.define(
  [
    "sap/ndc/BarcodeScanner",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
  ],
  function (BarcodeScanner, MessageBox, MessageToast) {
    "use strict";

    function escapeODataString(value) {
      return String(value).replace(/'/g, "''");
    }

    function parseGS1Barcode(text) {
      const raw = String(text || "").trim();

      const scan = {
        raw: raw,
        gtin: null,
        serial: null,
        expiryDate: null,
        lot: null,
        isDataMatrix: false
      };

      if (!raw) {
        return scan;
      }

      const gtinMatch = raw.match(/\(01\)(\d{14})/);
      const serialMatch = raw.match(/\(21\)(.*?)(?=\(\d{2}\)|$)/);
      const expiryMatch = raw.match(/\(17\)(\d{6})/);
      const lotMatch = raw.match(/\(10\)(.*?)(?=\(\d{2}\)|$)/);

      if (gtinMatch) {
        scan.isDataMatrix = true;

        // 14 haneli GS1 GTIN'in başındaki dolgu sıfırını kaldırıyoruz.
        scan.gtin = gtinMatch[1].replace(/^0/, "");
      }

      if (serialMatch) {
        scan.isDataMatrix = true;
        scan.serial = serialMatch[1].trim();
      }

      if (expiryMatch) {
        scan.isDataMatrix = true;

        const value = expiryMatch[1];
        const year = 2000 + Number(value.substring(0, 2));
        const month = Number(value.substring(2, 4));
        let day = Number(value.substring(4, 6));

        // GS1 içinde gün 00 ise ilgili ayın son gününü kullan.
        if (day === 0) {
          day = new Date(year, month, 0).getDate();
        }

        scan.expiryDate =
          String(year).padStart(4, "0") +
          "-" +
          String(month).padStart(2, "0") +
          "-" +
          String(day).padStart(2, "0");
      }

      if (lotMatch) {
        scan.isDataMatrix = true;
        scan.lot = lotMatch[1].trim();
      }

      return scan;
    }

    async function findMedicineByBarcode(barcode) {
      const safeBarcode = escapeODataString(barcode);

      const url =
        "/odata/v4/pharmacy/Medicines" +
        "?$select=ID,barcode,medicineCode,name,manufacturer" +
        "&$filter=barcode eq '" +
        encodeURIComponent(safeBarcode) +
        "'";

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(
          "İlaç sorgusu başarısız oldu. HTTP kodu: " + response.status
        );
      }

      const data = await response.json();
      return Array.isArray(data.value) ? data.value[0] || null : null;
    }

    async function openNewMedicinePage(extensionAPI, barcode) {
      if (
        !extensionAPI ||
        typeof extensionAPI.getModel !== "function" ||
        typeof extensionAPI.getEditFlow !== "function"
      ) {
        throw new Error("Fiori Extension API erişimi sağlanamadı.");
      }

      const model = extensionAPI.getModel();
      const editFlow = extensionAPI.getEditFlow();
      const listBinding = model.bindList("/Medicines");

      await editFlow.createDocument(listBinding, {
        creationMode: "NewPage",
        data: {
          barcode: barcode
        }
      });

      MessageToast.show("Barkod yeni ilaç formuna aktarıldı.");
    }

    function openNewBatchPage(medicine, scan) {
      /*
       * project2 uygulaması açıldığında bu verileri sessionStorage'dan
       * okuyarak yeni parti formunu otomatik dolduracak.
       */
      const batchData = {
        medicineID: medicine.ID,
        medicineName: medicine.name,
        medicineCode: medicine.medicineCode,
        barcode: medicine.barcode,
        lotNumber: scan.lot || "",
        expiryDate: scan.expiryDate || "",
        serialNumber: scan.serial || ""
      };

      sessionStorage.setItem(
        "pharmatrack.pendingBatch",
        JSON.stringify(batchData)
      );

      window.location.href =
        "/pharmatrack.project2/index.html?createFromScan=true";
    }

    function askToCreateMedicine(extensionAPI, scan) {
      const barcode = scan.gtin || scan.raw;

      MessageBox.confirm(
        "Bu ilaç sistemde kayıtlı değil.\n\n" +
          "GTIN: " +
          barcode +
          "\n" +
          "Seri No: " +
          (scan.serial || "-") +
          "\n" +
          "Parti No: " +
          (scan.lot || "-") +
          "\n" +
          "Son Kullanma Tarihi: " +
          (scan.expiryDate || "-") +
          "\n\nBu barkodla yeni bir ilaç oluşturulsun mu?",
        {
          title: scan.isDataMatrix
            ? "Yeni İlaç DataMatrix'i"
            : "Yeni Barkod",

          actions: [
            MessageBox.Action.YES,
            MessageBox.Action.NO
          ],

          emphasizedAction: MessageBox.Action.YES,

          onClose: async function (action) {
            if (action !== MessageBox.Action.YES) {
              MessageToast.show("Yeni ilaç oluşturma iptal edildi.");
              return;
            }

            try {
              await openNewMedicinePage(extensionAPI, barcode);
            } catch (error) {
              console.error("Yeni ilaç ekranı açılamadı:", error);

              MessageBox.error(
                "Yeni ilaç ekranı açılırken hata oluştu.\n\n" +
                  error.message
              );
            }
          }
        }
      );
    }

    function askToCreateBatch(medicine, scan) {
      let message =
        "İlaç: " +
        medicine.name +
        "\n" +
        "İlaç Kodu: " +
        medicine.medicineCode +
        "\n" +
        "Barkod: " +
        medicine.barcode;

      if (scan.isDataMatrix) {
        message +=
          "\n\nDataMatrix Bilgileri" +
          "\nSeri No: " +
          (scan.serial || "-") +
          "\nParti No: " +
          (scan.lot || "-") +
          "\nSon Kullanma Tarihi: " +
          (scan.expiryDate || "-");
      }

      message += "\n\nBu ilaç için yeni parti kaydı oluşturulsun mu?";

      MessageBox.confirm(message, {
        title: "İlaç Bulundu",

        actions: [
          MessageBox.Action.YES,
          MessageBox.Action.NO
        ],

        emphasizedAction: MessageBox.Action.YES,

        onClose: function (action) {
          if (action !== MessageBox.Action.YES) {
            MessageToast.show("Parti oluşturma iptal edildi.");
            return;
          }

          openNewBatchPage(medicine, scan);
        }
      });
    }

    return {
      onScanBarcode: function () {
        const extensionAPI = this;

        BarcodeScanner.scan(
          async function (result) {
            if (result.cancelled) {
              MessageToast.show("Barkod tarama iptal edildi.");
              return;
            }

            const scan = parseGS1Barcode(result.text);
            const barcode = scan.gtin || scan.raw;

            if (!barcode) {
              MessageBox.warning(
                "Geçerli bir barkod veya DataMatrix okunamadı."
              );
              return;
            }

            try {
              const medicine = await findMedicineByBarcode(barcode);

              if (medicine) {
                askToCreateBatch(medicine, scan);
                return;
              }

              askToCreateMedicine(extensionAPI, scan);
            } catch (error) {
              console.error("Barkod sorgu hatası:", error);

              MessageBox.error(
                "Kod okundu ancak ilaç sorgulanırken hata oluştu.\n\n" +
                  error.message
              );
            }
          },

          function (error) {
            console.error("Barkod tarama hatası:", error);

            MessageBox.error(
              "Kamera veya barkod tarayıcı başlatılamadı.\n\n" +
                "Chrome kamera iznini kontrol et."
            );
          }
        );
      }
    };
  }
);