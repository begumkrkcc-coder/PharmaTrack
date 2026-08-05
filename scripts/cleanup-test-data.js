import cds from "@sap/cds";

const { DELETE } = cds.ql;

async function cleanup() {
    try {
        const db = await cds.connect.to("db");

        await db.tx(async (tx) => {
            // Önce bağımlı alt kayıtlar silinir.
            await tx.run(
                DELETE.from("pharmatrack.SaleItems")
            );

            await tx.run(
                DELETE.from("pharmatrack.Sales")
            );

            await tx.run(
                DELETE.from("pharmatrack.PrescriptionItems")
            );

            await tx.run(
                DELETE.from("pharmatrack.Prescriptions")
            );

            await tx.run(
                DELETE.from("pharmatrack.StockTransferItems")
            );

            await tx.run(
                DELETE.from("pharmatrack.StockTransfers")
            );

            await tx.run(
                DELETE.from("pharmatrack.MedicineBatches")
            );

            await tx.run(
                DELETE.from("pharmatrack.Medicines")
            );

            await tx.run(
                DELETE.from("pharmatrack.DailyReports")
            );
        });

        console.log(
            "✅ Eski ilaç, stok, satış ve test verileri temizlendi."
        );

        console.log(
            "✅ Branches, Users, Customers, InsurancePlans, Categories ve Shelves korundu."
        );
    } catch (error) {
        console.error(
            "❌ Temizleme sırasında hata oluştu:"
        );

        console.error(error);

        process.exitCode = 1;
    }
}

cleanup();