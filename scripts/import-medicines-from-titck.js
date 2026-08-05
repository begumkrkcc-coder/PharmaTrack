import cds from "@sap/cds";
import XLSX from "xlsx";
import crypto from "node:crypto";
import fs from "node:fs";

const { SELECT, INSERT } = cds.ql;

const FILE_PATH =
    "imports/titck-ilac-listesi.xlsx";

const IMPORT_LIMIT = 500;
const CHUNK_SIZE = 100;

function normalizeText(value) {
    return String(value || "")
        .replace(/\r?\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeSearchText(value) {
    return normalizeText(value)
        .toLocaleLowerCase("tr-TR")
        .replace(/ç/g, "c")
        .replace(/ğ/g, "g")
        .replace(/ı/g, "i")
        .replace(/ö/g, "o")
        .replace(/ş/g, "s")
        .replace(/ü/g, "u");
}

function normalizeBarcode(value) {
    return String(value || "")
        .replace(/\.0$/, "")
        .replace(/\D/g, "")
        .trim();
}

function guessDosage(name) {
    const match = String(name || "").match(
        /\b\d+(?:[.,]\d+)?\s*(?:MG|G|MCG|IU|ML|ÜNİTE|UNIT|%)(?:\s*\/\s*\d+(?:[.,]\d+)?\s*(?:MG|G|MCG|ML))?/i
    );

    return match
        ? match[0].replace(",", ".").slice(0, 50)
        : null;
}

function guessDosageForm(name) {
    const upperName =
        String(name || "").toLocaleUpperCase("tr-TR");

    const forms = [
        ["TABLET", "Tablet"],
        ["KAPSÜL", "Kapsül"],
        ["KAPSUL", "Kapsül"],
        ["ŞURUP", "Şurup"],
        ["SURUP", "Şurup"],
        ["SÜSPANSİYON", "Süspansiyon"],
        ["SUSPANSIYON", "Süspansiyon"],
        ["AMPUL", "Ampul"],
        ["FLAKON", "Flakon"],
        ["KREM", "Krem"],
        ["POMAD", "Pomad"],
        ["JEL", "Jel"],
        ["SPREY", "Sprey"],
        ["DAMLA", "Damla"],
        ["SOLÜSYON", "Solüsyon"],
        ["SOLUSYON", "Solüsyon"],
        ["ENJEKSİYON", "Enjeksiyon"],
        ["ENJEKSIYON", "Enjeksiyon"],
        ["İNHALASYON", "İnhalasyon"],
        ["INHALASYON", "İnhalasyon"],
        ["SUPPOZİTUVAR", "Supozituvar"],
        ["SUPPOZITUVAR", "Supozituvar"]
    ];

    const match = forms.find(function (item) {
        return upperName.includes(item[0]);
    });

    return match ? match[1] : null;
}

function isPrescriptionRequired(prescriptionType) {
    const normalized =
        normalizeSearchText(prescriptionType);

    if (
        normalized.includes("recetesiz") ||
        normalized.includes("otc")
    ) {
        return false;
    }

    /*
     * TİTCK E-Reçete listesindeki Normal, Kırmızı,
     * Yeşil, Mor ve Turuncu kayıtlar reçeteli kabul edilir.
     */
    return Boolean(normalized);
}

async function main() {
    console.log("TİTCK ilaç aktarımı başladı.");

    if (!fs.existsSync(FILE_PATH)) {
        throw new Error(
            `Excel dosyası bulunamadı: ${FILE_PATH}`
        );
    }

    const workbook = XLSX.readFile(FILE_PATH, {
        raw: false,
        cellDates: true
    });

    const sheet =
        workbook.Sheets[workbook.SheetNames[0]];

    const rawRows = XLSX.utils.sheet_to_json(
        sheet,
        {
            header: 1,
            defval: null,
            raw: false
        }
    );

    const headerRowIndex = rawRows.findIndex(
        function (row) {
            const normalizedRow = row
                .map(normalizeSearchText);

            return (
                normalizedRow.includes("ilac adi") &&
                normalizedRow.includes("barkod")
            );
        }
    );

    if (headerRowIndex === -1) {
        throw new Error(
            "Excel içinde İlaç Adı ve Barkod başlıkları bulunamadı."
        );
    }

    const sourceRows = XLSX.utils.sheet_to_json(
        sheet,
        {
            range: headerRowIndex,
            defval: null,
            raw: false
        }
    );

    console.log(
        `Excel'de ${sourceRows.length} veri satırı bulundu.`
    );

    const preparedRows = [];
    const seenBarcodes = new Set();

    for (const row of sourceRows) {
        const barcode =
            normalizeBarcode(row["Barkod"]);

        const name =
            normalizeText(row["İlaç Adı"]);

        const status =
            normalizeSearchText(row["Durumu"]);

        if (
            !barcode ||
            barcode.length < 8 ||
            !name ||
            seenBarcodes.has(barcode)
        ) {
            continue;
        }

        if (
            status &&
            !status.includes("aktif")
        ) {
            continue;
        }

        const manufacturer =
            normalizeText(row["Firma Adı"]);

        const atcCode =
            normalizeText(row["ATC Kodu"]);

        const atcName =
            normalizeText(row["ATC Adı"]);

        const prescriptionType =
            normalizeText(row["Reçete Türü"]);

        const description =
            normalizeText(row["Açıklama"]);

        const sequence =
            preparedRows.length + 1;

        preparedRows.push({
            ID: crypto.randomUUID(),

            barcode,

            medicineCode:
                `TR-MED-${String(sequence).padStart(
                    6,
                    "0"
                )}`,

            name:
                name.slice(0, 120),

            manufacturer:
                manufacturer
                    ? manufacturer.slice(0, 100)
                    : null,

            dosage:
                guessDosage(name),

            dosageForm:
                guessDosageForm(name),

            description:
                description
                    ? description.slice(0, 500)
                    : null,

            activeIngredient:
                null,

            atcCode:
                atcCode
                    ? atcCode.slice(0, 30)
                    : null,

            atcName:
                atcName
                    ? atcName.slice(0, 250)
                    : null,

            prescriptionType:
                prescriptionType
                    ? prescriptionType.slice(0, 80)
                    : null,

            requiresPrescription:
                isPrescriptionRequired(
                    prescriptionType
                ),

            sgkCovered:
                true,

            sgkReferencePrice:
                0,

            minimumStock:
                10,

            defaultProfitRate:
                20,

            imageUrl:
                null,

            isActive:
                true,

            dataSource:
                "TİTCK E-Reçete İlaç Listesi"
        });

        seenBarcodes.add(barcode);

        if (
            preparedRows.length >=
            IMPORT_LIMIT
        ) {
            break;
        }
    }

    if (preparedRows.length === 0) {
        throw new Error(
            "Aktarılabilecek aktif ve barkodlu ilaç bulunamadı."
        );
    }

    const db =
        await cds.connect.to("db");

    const existingMedicines =
        await db.run(
            SELECT.from(
                "pharmatrack.Medicines"
            ).columns("barcode")
        );

    const existingBarcodes = new Set(
        existingMedicines.map(function (medicine) {
            return String(medicine.barcode);
        })
    );

    const newMedicines =
        preparedRows.filter(function (medicine) {
            return !existingBarcodes.has(
                medicine.barcode
            );
        });

    if (newMedicines.length === 0) {
        console.log(
            "Bu barkodların tamamı daha önce aktarılmış."
        );
        return;
    }

    for (
        let index = 0;
        index < newMedicines.length;
        index += CHUNK_SIZE
    ) {
        const chunk = newMedicines.slice(
            index,
            index + CHUNK_SIZE
        );

        await db.run(
            INSERT.into(
                "pharmatrack.Medicines"
            ).entries(chunk)
        );

        console.log(
            `${Math.min(
                index + CHUNK_SIZE,
                newMedicines.length
            )}/${newMedicines.length} ilaç aktarıldı.`
        );
    }

    console.log("");
    console.log(
        `✅ ${newMedicines.length} gerçek ilaç HANA Cloud'a aktarıldı.`
    );
    console.log(
        "✅ Aynı barkoda sahip kayıtlar tekrarlanmadı."
    );
    console.log(
        "✅ Henüz şube stoğu veya parti oluşturulmadı."
    );
}

main()
    .then(function () {
        process.exit(0);
    })
    .catch(function (error) {
        console.error("");
        console.error(
            "❌ İlaç aktarımı başarısız:"
        );
        console.error(error);
        process.exit(1);
    });