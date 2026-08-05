import cds from "@sap/cds";
import { randomUUID } from "node:crypto";

const NAMESPACE = "pharmatrack";

const ENTITY = {
    medicines: `${NAMESPACE}.Medicines`,
    batches: `${NAMESPACE}.MedicineBatches`,
    branches: `${NAMESPACE}.Branches`,
    shelves: `${NAMESPACE}.Shelves`
};

const branchDefinitions = [
    {
        code: "USKUDAR",
        shortCode: "USK",
        aislePrefix: "U"
    },
    {
        code: "KADIKOY",
        shortCode: "KAD",
        aislePrefix: "K"
    },
    {
        code: "BESIKTAS",
        shortCode: "BES",
        aislePrefix: "B"
    }
];

/*
 * Demo sınıflandırması:
 * 25 reçetesiz + 25 reçeteli.
 */
const nonPrescriptionNames = [
    "Parol 500 mg",
    "Minoset 500 mg",
    "Dolven Şurup",
    "Nurofen Cold",
    "Rennie",
    "Gaviscon",
    "Strepsils",
    "Tantum Verde",
    "Otrivine",
    "Sterimar",
    "Ocean Burun Spreyi",
    "Supradyn",
    "Centrum",
    "Vitamin C 1000 mg",
    "Magnorm",
    "Bepanthol Krem",
    "Hametan Krem",
    "Voltaren Emulgel",
    "Thermo Jel",
    "Dexpass Jel",
    "Calpol Şurup",
    "Sudocrem",
    "Vicks VapoRub",
    "Oral-B Ağız Gargarası",
    "Prospan Şurup"
];

const prescriptionNames = [
    "Augmentin 1000 mg",
    "Amoklavin BID",
    "Klacid 500 mg",
    "Zinnat 500 mg",
    "Cipro 500 mg",
    "Cefaks 500 mg",
    "Nexium 40 mg",
    "Plavix 75 mg",
    "Beloc ZOK 50 mg",
    "Concor 5 mg",
    "Norvasc 5 mg",
    "Ecopirin 100 mg",
    "Glifor 1000 mg",
    "Lantus",
    "Humalog",
    "Ventolin İnhaler",
    "Symbicort",
    "Seretide",
    "Euthyrox 50 mcg",
    "Levotiron 50 mcg",
    "Cipralex 10 mg",
    "Lustral 50 mg",
    "Seroquel 25 mg",
    "Monodox 100 mg",
    "Prednol 16 mg"
];

const manufacturers = [
    "Demo Pharma",
    "Anadolu İlaç",
    "Marmara Farma",
    "Sağlık Medikal",
    "İstanbul Pharma"
];

function addMonths(date, months) {
    const result = new Date(date);
    result.setUTCMonth(
        result.getUTCMonth() + months
    );

    return result
        .toISOString()
        .slice(0, 10);
}

function createBarcode(index) {
    return `8699000${String(index + 1).padStart(6, "0")}`;
}

function createMedicineRows() {
    const rows = [];

    nonPrescriptionNames.forEach(
        function (name, index) {
            rows.push({
                index,
                name,
                requiresPrescription: false,
                prescriptionType: "Reçetesiz"
            });
        }
    );

    prescriptionNames.forEach(
        function (name, index) {
            rows.push({
                index: index + 25,
                name,
                requiresPrescription: true,
                prescriptionType: "Reçeteli"
            });
        }
    );

    return rows;
}

async function findBranches(db, SELECT) {
    const branches = [];

    for (const definition of branchDefinitions) {
        const branch = await db.run(
            SELECT.one
                .from(ENTITY.branches)
                .where({
                    code: definition.code
                })
        );

        if (!branch) {
            throw new Error(
                `Şube bulunamadı: ${definition.code}`
            );
        }

        branches.push({
            ...definition,
            ID: branch.ID,
            name: branch.name
        });

        console.log(
            `Şube bulundu: ${branch.name}`
        );
    }

    return branches;
}

async function prepareShelves(
    db,
    SELECT,
    INSERT,
    branch
) {
    const shelfTemplates = [
        ["A-01", "A", "01", "1", "1"],
        ["A-02", "A", "02", "1", "2"],
        ["B-01", "B", "01", "2", "1"],
        ["B-02", "B", "02", "2", "2"],
        ["C-01", "C", "01", "3", "1"],
        ["C-02", "C", "02", "3", "2"],
        ["D-01", "D", "01", "4", "1"],
        ["D-02", "D", "02", "4", "2"]
    ];

    const shelves = [];

    for (const template of shelfTemplates) {
        const [
            codeSuffix,
            aisle,
            cabinet,
            level,
            compartment
        ] = template;

        const shelfCode =
            `${branch.shortCode}-${codeSuffix}`;

        let shelf = await db.run(
            SELECT.one
                .from(ENTITY.shelves)
                .where({
                    code: shelfCode,
                    branch_ID: branch.ID
                })
        );

        if (!shelf) {
            const shelfID = randomUUID();

            await db.run(
                INSERT.into(
                    ENTITY.shelves
                ).entries({
                    ID: shelfID,
                    code: shelfCode,
                    aisle,
                    cabinet,
                    level,
                    compartment,
                    description:
                        `${branch.name} ilaç rafı`,
                    isActive: true,
                    branch_ID: branch.ID
                })
            );

            shelf = {
                ID: shelfID,
                code: shelfCode
            };
        }

        shelves.push(shelf);
    }

    console.log(
        `${branch.name}: ${shelves.length} raf hazırlandı.`
    );

    return shelves;
}

async function prepareMedicines(
    db,
    SELECT,
    INSERT,
    UPDATE
) {
    /*
     * Önceden yüklenen 520 kayıt silinmiyor.
     * Sadece aktif listeden kaldırılıyor.
     */
    await db.run(
        UPDATE(ENTITY.medicines)
            .set({
                isActive: false
            })
            .where({
                isActive: true
            })
    );

    console.log(
        "Eski ilaç kayıtları pasif yapıldı."
    );

    const medicineRows =
        createMedicineRows();

    const preparedMedicines = [];

    for (
        let index = 0;
        index < medicineRows.length;
        index += 1
    ) {
        const item = medicineRows[index];

        const barcode =
            createBarcode(index);

        const medicineCode =
            `DEMO-${String(index + 1).padStart(3, "0")}`;

        const manufacturer =
            manufacturers[
                index % manufacturers.length
            ];

        let medicine = await db.run(
            SELECT.one
                .from(ENTITY.medicines)
                .where({
                    barcode
                })
        );

        if (!medicine) {
            const medicineID =
                randomUUID();

            await db.run(
                INSERT.into(
                    ENTITY.medicines
                ).entries({
                    ID: medicineID,
                    barcode,
                    medicineCode,
                    name: item.name,
                    manufacturer,
                    dosage: "",
                    dosageForm: "Standart",
                    description:
                        "PharmaTrack demo ilaç kaydı",
                    activeIngredient: "",
                    atcCode: "",
                    atcName: "",
                    prescriptionType:
                        item.prescriptionType,
                    dataSource:
                        "PHARMATRACK_DEMO",
                    requiresPrescription:
                        item.requiresPrescription,
                    sgkCovered:
                        item.requiresPrescription,
                    sgkReferencePrice: 0,
                    minimumStock: 10,
                    defaultProfitRate: 25,
                    imageUrl: "",
                    isActive: true
                })
            );

            medicine = {
                ID: medicineID
            };
        } else {
            await db.run(
                UPDATE(ENTITY.medicines)
                    .set({
                        name: item.name,
                        manufacturer,
                        prescriptionType:
                            item.prescriptionType,
                        requiresPrescription:
                            item.requiresPrescription,
                        sgkCovered:
                            item.requiresPrescription,
                        minimumStock: 10,
                        defaultProfitRate: 25,
                        dataSource:
                            "PHARMATRACK_DEMO",
                        isActive: true
                    })
                    .where({
                        ID: medicine.ID
                    })
            );
        }

        preparedMedicines.push({
            ID: medicine.ID,
            name: item.name,
            requiresPrescription:
                item.requiresPrescription
        });

        console.log(
            `${index + 1}/50 ilaç hazırlandı: ${item.name}`
        );
    }

    return preparedMedicines;
}

async function prepareBranchBatches(
    db,
    SELECT,
    INSERT,
    UPDATE,
    branch,
    shelves,
    medicines,
    branchIndex
) {
    let createdCount = 0;
    let updatedCount = 0;

    for (
        let index = 0;
        index < medicines.length;
        index += 1
    ) {
        const medicine =
            medicines[index];

        const shelf =
            shelves[
                index % shelves.length
            ];

        const lotNumber =
            `${branch.shortCode}-DEMO-${String(index + 1).padStart(3, "0")}`;

        /*
         * Her şubede miktarlar farklı olsun.
         */
        const quantity =
            index % 9 === branchIndex
                ? 5 + branchIndex
                : 25 +
                  ((index * 13 + branchIndex * 11) % 100);

        const purchasePrice = Number(
            (
                35 +
                index * 4.75 +
                branchIndex * 1.5
            ).toFixed(2)
        );

        const salePrice = Number(
            (purchasePrice * 1.25).toFixed(2)
        );

        const expiryDate =
            index % 12 === branchIndex
                ? addMonths(
                    new Date(),
                    2 + branchIndex
                )
                : addMonths(
                    new Date(),
                    10 +
                    ((index + branchIndex) % 25)
                );

        const existingBatch =
            await db.run(
                SELECT.one
                    .from(ENTITY.batches)
                    .where({
                        lotNumber,
                        branch_ID:
                            branch.ID
                    })
            );

        if (!existingBatch) {
            await db.run(
                INSERT.into(
                    ENTITY.batches
                ).entries({
                    ID: randomUUID(),
                    lotNumber,
                    expiryDate,
                    quantity,
                    purchasePrice,
                    salePrice,
                    status: "AVAILABLE",
                    isRecalled: false,
                    medicine_ID:
                        medicine.ID,
                    branch_ID:
                        branch.ID,
                    shelf_ID:
                        shelf.ID
                })
            );

            createdCount += 1;
        } else {
            await db.run(
                UPDATE(ENTITY.batches)
                    .set({
                        expiryDate,
                        quantity,
                        purchasePrice,
                        salePrice,
                        status: "AVAILABLE",
                        isRecalled: false,
                        medicine_ID:
                            medicine.ID,
                        shelf_ID:
                            shelf.ID
                    })
                    .where({
                        ID: existingBatch.ID
                    })
            );

            updatedCount += 1;
        }
    }

    console.log(
        `${branch.name}: ${createdCount} yeni, ${updatedCount} güncellenen parti.`
    );
}

async function main() {
    const model =
        await cds.load("*");

    cds.model = model;

    const db =
        await cds.connect.to("db");

    const {
        SELECT,
        INSERT,
        UPDATE
    } = cds.ql;

    console.log(
        "Üç şubeli demo veri yüklemesi başladı..."
    );

    const branches =
        await findBranches(
            db,
            SELECT
        );

    const medicines =
        await prepareMedicines(
            db,
            SELECT,
            INSERT,
            UPDATE
        );

    for (
        let branchIndex = 0;
        branchIndex < branches.length;
        branchIndex += 1
    ) {
        const branch =
            branches[branchIndex];

        const shelves =
            await prepareShelves(
                db,
                SELECT,
                INSERT,
                branch
            );

        await prepareBranchBatches(
            db,
            SELECT,
            INSERT,
            UPDATE,
            branch,
            shelves,
            medicines,
            branchIndex
        );
    }

    console.log("");
    console.log(
        "Demo veri yükleme tamamlandı."
    );

    console.log(
        "Aktif ilaç: 50"
    );

    console.log(
        "Reçeteli ilaç: 25"
    );

    console.log(
        "Reçetesiz ilaç: 25"
    );

    console.log(
        "Toplam şube parti kaydı: 150"
    );
}

main().catch(
    function (error) {
        console.error("");
        console.error(
            "Veri yükleme başarısız:"
        );

        console.error(error);

        process.exitCode = 1;
    }
);