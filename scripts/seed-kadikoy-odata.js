const BASE_URL = "http://localhost:4004/odata/v4/pharmacy";
const BRANCH_CODE = "KADIKOY";

function addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result.toISOString().slice(0, 10);
}

function isPrescriptionRequired(prescriptionType) {
    const value = String(prescriptionType || "")
        .trim()
        .toLocaleLowerCase("tr-TR");

    if (!value) {
        return false;
    }

    if (
        value.includes("reçetesiz") ||
        value.includes("recetesiz")
    ) {
        return false;
    }

    return (
        value.includes("reçete") ||
        value.includes("recete")
    );
}

async function request(path, options = {}) {
    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const text = await response.text();

    let data = {};

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { raw: text };
        }
    }

    if (!response.ok) {
        const message =
            data?.error?.message ||
            data?.message ||
            `${response.status} ${response.statusText}`;

        throw new Error(`${path}: ${message}`);
    }

    return data;
}

async function getAll(path) {
    const result = await request(path);
    return Array.isArray(result.value) ? result.value : [];
}

async function createShelves(branch) {
    const existingShelves = await getAll(
        `/Shelves?$filter=branch_ID eq ${branch.ID}&$top=100`
    );

    const shelfDefinitions = [
        ["KAD-A-01", "A", "01", "1", "1"],
        ["KAD-A-02", "A", "02", "1", "2"],
        ["KAD-B-01", "B", "01", "2", "1"],
        ["KAD-B-02", "B", "02", "2", "2"],
        ["KAD-C-01", "C", "01", "3", "1"],
        ["KAD-C-02", "C", "02", "3", "2"],
        ["KAD-D-01", "D", "01", "4", "1"],
        ["KAD-D-02", "D", "02", "4", "2"]
    ];

    const shelves = [...existingShelves];

    for (const definition of shelfDefinitions) {
        const [code, aisle, cabinet, level, compartment] =
            definition;

        const existing = shelves.find(
            (shelf) => shelf.code === code
        );

        if (existing) {
            continue;
        }

        const created = await request("/Shelves", {
            method: "POST",
            body: JSON.stringify({
                code,
                aisle,
                cabinet,
                level,
                compartment,
                description: "Kadıköy Şubesi ilaç rafı",
                isActive: true,
                branch_ID: branch.ID
            })
        });

        shelves.push(created);
        console.log(`Raf oluşturuldu: ${code}`);
    }

    return shelves;
}

async function updatePrescriptionStatus(medicines) {
    let prescriptionCount = 0;
    let nonPrescriptionCount = 0;

    for (let index = 0; index < medicines.length; index += 1) {
        const medicine = medicines[index];

        const requiresPrescription =
            isPrescriptionRequired(
                medicine.prescriptionType
            );

        if (requiresPrescription) {
            prescriptionCount += 1;
        } else {
            nonPrescriptionCount += 1;
        }

        if (
            medicine.requiresPrescription !==
            requiresPrescription
        ) {
            await request(
                `/Medicines(${medicine.ID})`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        requiresPrescription
                    })
                }
            );
        }

        if ((index + 1) % 50 === 0) {
            console.log(
                `${index + 1}/${medicines.length} ilaç reçete durumu işlendi.`
            );
        }
    }

    console.log(`Reçeteli ilaç: ${prescriptionCount}`);
    console.log(`Reçetesiz ilaç: ${nonPrescriptionCount}`);
}

async function createBatches(
    medicines,
    shelves,
    branch
) {
    const existingBatches = await getAll(
        "/MedicineBatches?$select=lotNumber&$top=2000"
    );

    const existingLotNumbers = new Set(
        existingBatches.map(
            (batch) => batch.lotNumber
        )
    );

    let createdCount = 0;
    let skippedCount = 0;

    for (let index = 0; index < medicines.length; index += 1) {
        const medicine = medicines[index];
        const shelf = shelves[index % shelves.length];

        const lotNumber =
            `KAD-2026-${String(index + 1).padStart(4, "0")}`;

        if (existingLotNumbers.has(lotNumber)) {
            skippedCount += 1;
            continue;
        }

        const minimumStock =
            Number(medicine.minimumStock || 10);

        const quantity =
            index % 15 === 0
                ? Math.max(1, Math.floor(minimumStock / 2))
                : 25 + ((index * 17) % 126);

        const purchasePrice = Number(
            (18 + ((index * 11.75) % 420)).toFixed(2)
        );

        const profitRate =
            Number(medicine.defaultProfitRate || 20);

        const salePrice = Number(
            (
                purchasePrice *
                (1 + profitRate / 100)
            ).toFixed(2)
        );

        const expiryMonths =
            index % 25 === 0
                ? 2
                : 8 + ((index * 7) % 28);

        await request("/MedicineBatches", {
            method: "POST",
            body: JSON.stringify({
                lotNumber,
                expiryDate: addMonths(
                    new Date(),
                    expiryMonths
                ),
                quantity,
                purchasePrice,
                salePrice,
                status: "AVAILABLE",
                isRecalled: false,
                medicine_ID: medicine.ID,
                branch_ID: branch.ID,
                shelf_ID: shelf.ID
            })
        });

        createdCount += 1;

        if (createdCount % 25 === 0) {
            console.log(
                `${createdCount}/${medicines.length} parti oluşturuldu.`
            );
        }
    }

    console.log(`Yeni oluşturulan parti: ${createdCount}`);
    console.log(`Önceden bulunduğu için atlanan: ${skippedCount}`);
}

async function main() {
    console.log("Kadıköy stok yükleme işlemi başladı...");

    const branches = await getAll(
        `/Branches?$filter=code eq '${BRANCH_CODE}'&$top=1`
    );

    const branch = branches[0];

    if (!branch) {
        throw new Error(
            `Şube bulunamadı: ${BRANCH_CODE}`
        );
    }

    console.log(`Şube bulundu: ${branch.name}`);

    const medicines = await getAll(
        "/Medicines?$select=ID,name,barcode,prescriptionType,requiresPrescription,minimumStock,defaultProfitRate&$orderby=name&$top=1000"
    );

    if (medicines.length === 0) {
        throw new Error(
            "Medicines tablosunda ilaç bulunamadı."
        );
    }

    console.log(`${medicines.length} ilaç bulundu.`);

    const shelves = await createShelves(branch);

    console.log(`${shelves.length} raf hazır.`);

    await updatePrescriptionStatus(medicines);

    await createBatches(
        medicines,
        shelves,
        branch
    );

    console.log("");
    console.log("Kadıköy stok yükleme işlemi tamamlandı.");
}

main().catch((error) => {
    console.error("");
    console.error("İşlem başarısız:");
    console.error(error.message);
    process.exitCode = 1;
});