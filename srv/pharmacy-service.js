import cds from '@sap/cds';
import crypto from 'node:crypto';

const { SELECT, INSERT, UPDATE } = cds.ql;

export default cds.service.impl(function () {
  const {
  Medicines,
  MedicineBatches,
  Categories,
  Shelves,
  InsurancePlans,
  Customers,
  Sales,
  SaleItems,
  Prescriptions,
  PrescriptionItems,
  DailyReports
} = this.entities;

const {
  Users,
  Branches
} = cds.entities('pharmatrack');


this.on(
  "createStockEntryRequest",
  async (req) => {
    const {
      medicineID,
      branchID,
      requesterUserID,
      quantity,
      purchasePrice,
      salePrice,
      lotNumber,
      expiryDate
    } = req.data;

    if (
      !medicineID ||
      !branchID ||
      !requesterUserID ||
      !lotNumber ||
      !expiryDate
    ) {
      return req.reject(
        400,
        "İlaç, şube, kullanıcı, lot ve SKT bilgileri zorunludur."
      );
    }

    if (Number(quantity) <= 0) {
      return req.reject(
        400,
        "Stok miktarı sıfırdan büyük olmalıdır."
      );
    }

    if (
      Number(purchasePrice) <= 0 ||
      Number(salePrice) <= 0
    ) {
      return req.reject(
        400,
        "Alış ve satış fiyatları sıfırdan büyük olmalıdır."
      );
    }

    if (
      Number(salePrice) <
      Number(purchasePrice)
    ) {
      return req.reject(
        400,
        "Satış fiyatı alış fiyatından düşük olamaz."
      );
    }

    const today =
      new Date().toISOString().substring(0, 10);

    if (String(expiryDate) <= today) {
      return req.reject(
        400,
        "Son kullanma tarihi gelecekte olmalıdır."
      );
    }

    const tx = cds.tx(req);

    const medicine = await tx.run(
      SELECT.one
        .from("pharmatrack.Medicines")
        .where({
          ID: medicineID,
          isActive: true
        })
    );

    if (!medicine) {
      return req.reject(
        404,
        "Aktif ilaç kaydı bulunamadı."
      );
    }

    const branch = await tx.run(
      SELECT.one
        .from("pharmatrack.Branches")
        .where({
          ID: branchID,
          isActive: true
        })
    );

    if (!branch) {
      return req.reject(
        404,
        "Aktif şube bulunamadı."
      );
    }

    const requester = await tx.run(
      SELECT.one
        .from("pharmatrack.Users")
        .where({
          ID: requesterUserID,
          isActive: true
        })
    );

    if (!requester) {
      return req.reject(
        404,
        "Aktif kullanıcı bulunamadı."
      );
    }

    if (
      requester.role !== "BRANCH" &&
      requester.role !== "WAREHOUSE"
    ) {
      return req.reject(
        403,
        "Bu kullanıcının stok girişi oluşturma yetkisi yok."
      );
    }

    if (
      requester.branch_ID &&
      requester.branch_ID !== branchID
    ) {
      return req.reject(
        403,
        "Kullanıcı başka bir şube için stok talebi oluşturamaz."
      );
    }

    const requestID = cds.utils.uuid();

    const requestNumber =
      "STK-" +
      new Date()
        .toISOString()
        .replace(/\D/g, "")
        .substring(0, 14) +
      "-" +
      Math.floor(
        1000 + Math.random() * 9000
      );

    await tx.run(
      INSERT.into(
        "pharmatrack.StockEntryRequests"
      ).entries({
        ID: requestID,
        requestNumber,
        requestedQuantity:
          Number(quantity),
        purchasePrice:
          Number(purchasePrice),
        proposedSalePrice:
          Number(salePrice),
        lotNumber:
          String(lotNumber).trim(),
        expiryDate,
        status: "PENDING",
        medicine_ID: medicineID,
        branch_ID: branchID,
        requestedBy_ID:
          requesterUserID
      })
    );

    return {
      success: true,
      requestID,
      requestNumber,
      status: "PENDING",
      message:
        "Stok giriş talebi admin onayına gönderildi."
    };
  }
);

this.on(
  "approveStockEntry",
  async (req) => {
    const {
      requestID,
      adminUserID,
      adminNote
    } = req.data;

    if (!requestID || !adminUserID) {
      return req.reject(
        400,
        "Talep ve admin bilgisi zorunludur."
      );
    }

    const tx = cds.tx(req);

    const admin = await tx.run(
      SELECT.one
        .from("pharmatrack.Users")
        .where({
          ID: adminUserID,
          isActive: true,
          role: "ADMIN"
        })
    );

    if (!admin) {
      return req.reject(
        403,
        "Bu işlemi yalnızca aktif bir admin onaylayabilir."
      );
    }

    const stockRequest = await tx.run(
      SELECT.one
        .from(
          "pharmatrack.StockEntryRequests"
        )
        .where({
          ID: requestID
        })
    );

    if (!stockRequest) {
      return req.reject(
        404,
        "Stok giriş talebi bulunamadı."
      );
    }

    if (
      stockRequest.status !== "PENDING"
    ) {
      return req.reject(
        409,
        "Yalnızca bekleyen talepler onaylanabilir."
      );
    }

    const duplicateBatch = await tx.run(
      SELECT.one
        .from(
          "pharmatrack.MedicineBatches"
        )
        .where({
          medicine_ID:
            stockRequest.medicine_ID,
          branch_ID:
            stockRequest.branch_ID,
          lotNumber:
            stockRequest.lotNumber
        })
    );

    if (duplicateBatch) {
      return req.reject(
        409,
        "Bu ilaç, şube ve lot numarasıyla daha önce parti oluşturulmuş."
      );
    }

    const batchID = cds.utils.uuid();

    await tx.run(
      INSERT.into(
        "pharmatrack.MedicineBatches"
      ).entries({
        ID: batchID,
        lotNumber:
          stockRequest.lotNumber,
        expiryDate:
          stockRequest.expiryDate,
        quantity:
          stockRequest.requestedQuantity,
        purchasePrice:
          stockRequest.purchasePrice,
        salePrice:
          stockRequest.proposedSalePrice,
        status: "AVAILABLE",
        isRecalled: false,
        medicine_ID:
          stockRequest.medicine_ID,
        branch_ID:
          stockRequest.branch_ID
      })
    );

    await tx.run(
      UPDATE(
        "pharmatrack.StockEntryRequests"
      )
        .set({
          status: "APPROVED",
          approvedBy_ID: adminUserID,
          approvedAt:
            new Date().toISOString(),
          adminNote:
            String(adminNote || "").trim() ||
            null,
          createdBatch_ID: batchID
        })
        .where({
          ID: requestID,
          status: "PENDING"
        })
    );

    return {
      success: true,
      requestID,
      requestNumber:
        stockRequest.requestNumber,
      batchID,
      status: "APPROVED",
      message:
        "Stok girişi onaylandı ve şube stoğu oluşturuldu."
    };
  }
);

this.on(
  "rejectStockEntry",
  async (req) => {
    const {
      requestID,
      adminUserID,
      reason
    } = req.data;

    if (
      !requestID ||
      !adminUserID ||
      !String(reason || "").trim()
    ) {
      return req.reject(
        400,
        "Talep, admin ve ret nedeni zorunludur."
      );
    }

    const tx = cds.tx(req);

    const admin = await tx.run(
      SELECT.one
        .from("pharmatrack.Users")
        .where({
          ID: adminUserID,
          isActive: true,
          role: "ADMIN"
        })
    );

    if (!admin) {
      return req.reject(
        403,
        "Bu işlemi yalnızca aktif bir admin gerçekleştirebilir."
      );
    }

    const stockRequest = await tx.run(
      SELECT.one
        .from(
          "pharmatrack.StockEntryRequests"
        )
        .where({
          ID: requestID
        })
    );

    if (!stockRequest) {
      return req.reject(
        404,
        "Stok giriş talebi bulunamadı."
      );
    }

    if (
      stockRequest.status !== "PENDING"
    ) {
      return req.reject(
        409,
        "Yalnızca bekleyen talepler reddedilebilir."
      );
    }

    await tx.run(
      UPDATE(
        "pharmatrack.StockEntryRequests"
      )
        .set({
          status: "REJECTED",
          approvedBy_ID: adminUserID,
          rejectedAt:
            new Date().toISOString(),
          rejectionReason:
            String(reason).trim()
        })
        .where({
          ID: requestID,
          status: "PENDING"
        })
    );

    return {
      success: true,
      requestID,
      requestNumber:
        stockRequest.requestNumber,
      status: "REJECTED",
      message:
        "Stok giriş talebi reddedildi."
    };
  }
);


/* =====================================================
   YÖNETİCİ — ŞUBE ÖZETLERİ
   ===================================================== */

this.on(
  "getBranchSummaries",
  async (req) => {
    const tx = cds.tx(req);

    const todayText =
      new Date()
        .toISOString()
        .slice(0, 10);

    const startDate =
      `${todayText}T00:00:00.000Z`;

    const nextDate =
      new Date(startDate);

    nextDate.setUTCDate(
      nextDate.getUTCDate() + 1
    );

    const endDate =
      nextDate.toISOString();

    const branches =
      await tx.run(
        SELECT.from(Branches)
          .where({
            isActive: true
          })
      );

    const medicines =
      await tx.run(
        SELECT.from(Medicines)
          .where({
            isActive: true
          })
      );

    const batches =
      await tx.run(
        SELECT.from(MedicineBatches)
      );

    const todaySales =
      await tx.run(
        SELECT.from(Sales).where`
          saleDate >= ${startDate}
          and saleDate < ${endDate}
          and status = ${"COMPLETED"}
        `
      );

    const stockRequests =
      await tx.run(
        SELECT.from(
          "pharmatrack.StockEntryRequests"
        )
      );

    const results = [];

    for (const branch of branches) {
      const branchSales =
        todaySales.filter(
          (sale) =>
            sale.branch_ID === branch.ID
        );

      const todayRevenue =
        branchSales.reduce(
          (total, sale) =>
            total +
            Number(
              sale.totalAmount || 0
            ),
          0
        );

      const todayItemsSold =
        branchSales.reduce(
          (total, sale) =>
            total +
            Number(
              sale.totalQuantity || 0
            ),
          0
        );

      const branchBatches =
        batches.filter(
          (batch) =>
            batch.branch_ID === branch.ID
        );

      /*
       * Şubede geçmişte veya şu anda parti kaydı bulunan
       * ilaçları belirliyoruz.
       *
       * Böylece katalogdaki fakat bu şubede hiç tutulmamış
       * ilaçları yanlışlıkla kritik stok saymıyoruz.
       */
      const branchMedicineIDs =
        new Set(
          branchBatches
            .map(
              (batch) =>
                batch.medicine_ID
            )
            .filter(Boolean)
        );

      let criticalStockCount = 0;

      for (const medicine of medicines) {
        if (
          !branchMedicineIDs.has(
            medicine.ID
          )
        ) {
          continue;
        }

        const currentStock =
          branchBatches
            .filter((batch) => {
              return (
                batch.medicine_ID ===
                  medicine.ID &&
                batch.status ===
                  "AVAILABLE" &&
                batch.isRecalled === false &&
                batch.expiryDate >=
                  todayText &&
                Number(batch.quantity) > 0
              );
            })
            .reduce(
              (total, batch) =>
                total +
                Number(batch.quantity),
              0
            );

        const minimumStock =
          Number(
            medicine.minimumStock || 0
          );

        if (
          currentStock <= minimumStock
        ) {
          criticalStockCount += 1;
        }
      }

      const pendingRequestCount =
        stockRequests.filter(
          (request) =>
            request.branch_ID ===
              branch.ID &&
            request.status ===
              "PENDING"
        ).length;

      results.push({
        branchID:
          branch.ID,

        branchCode:
          branch.code,

        branchName:
          branch.name,

        district:
          branch.district || null,

        isActive:
          Boolean(branch.isActive),

        todayRevenue:
          Number(
            todayRevenue.toFixed(2)
          ),

        todaySalesCount:
          branchSales.length,

        todayItemsSold,

        criticalStockCount,

        pendingRequestCount
      });
    }

    return results.sort(
      (first, second) =>
        first.branchName.localeCompare(
          second.branchName,
          "tr"
        )
    );
  }
);
  /* =====================================================
     PHARMATRACK LOGIN
     ===================================================== */

  this.on('login', async (req) => {
    const username =
      String(req.data.username || '')
        .trim()
        .toLocaleLowerCase('tr-TR');

    const password =
      String(req.data.password || '');

    if (!username || !password) {
      return {
        success: false,
        message:
          'Kullanıcı adı ve şifre zorunludur.'
      };
    }

    const passwordHash = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');

    const tx = cds.tx(req);

    const user = await tx.run(
      SELECT.one
        .from(Users)
        .where({
          username,
          isActive: true
        })
    );

    if (
      !user ||
      user.passwordHash !== passwordHash
    ) {
      return {
        success: false,
        message:
          'Kullanıcı adı veya şifre hatalı.'
      };
    }

    let branch = null;

    if (user.branch_ID) {
      branch = await tx.run(
        SELECT.one
          .from(Branches)
          .where({
            ID: user.branch_ID,
            isActive: true
          })
      );

      if (!branch) {
        return {
          success: false,
          message:
            'Kullanıcıya bağlı aktif şube bulunamadı.'
        };
      }
    }

    return {
      success: true,
      message: 'Giriş başarılı.',
      userID: user.ID,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      branchID: branch?.ID || null,
      branchCode: branch?.code || null,
      branchName:
        branch?.name || 'Tüm Şubeler'
    };
  });

  /**
   * Demo TC kimlik numarasıyla müşteriyi ve
   * müşteriye bağlı sigorta planını getirir.
   *
   * Gerçek projede bu bölüm MEDULA veya yetkili
   * bir provizyon servisiyle değiştirilebilir.
   */
  this.on(
    'findCustomerByNationalId',
    async (req) => {
      const nationalId =
        req.data.nationalId?.trim();

      if (!nationalId) {
        return req.reject(
          400,
          'TC kimlik numarası boş bırakılamaz.'
        );
      }

      if (!/^\d{11}$/.test(nationalId)) {
        return req.reject(
          400,
          'TC kimlik numarası 11 rakamdan oluşmalıdır.'
        );
      }

      const tx = cds.tx(req);

      const customer = await tx.run(
        SELECT.one
          .from(Customers)
          .where({
            nationalId,
            isActive: true
          })
      );

      if (!customer) {
        return req.reject(
          404,
          'Bu TC kimlik numarasına ait aktif bir müşteri bulunamadı.'
        );
      }

      if (
        customer.insuranceStatus !==
        'ACTIVE'
      ) {
        return req.reject(
          400,
          `Müşterinin sigorta durumu aktif değildir. Durum: ${customer.insuranceStatus}`
        );
      }

      let insurancePlan = null;

      if (customer.insurancePlan_ID) {
        insurancePlan = await tx.run(
          SELECT.one
            .from(InsurancePlans)
            .where({
              ID: customer.insurancePlan_ID,
              isActive: true
            })
        );
      }

      if (!insurancePlan) {
        return req.reject(
          404,
          'Müşteriye bağlı aktif bir sigorta planı bulunamadı.'
        );
      }

      const today =
        new Date()
          .toISOString()
          .slice(0, 10);

      if (
        insurancePlan.validFrom &&
        insurancePlan.validFrom > today
      ) {
        return req.reject(
          400,
          'Müşterinin sigorta planı henüz geçerli değildir.'
        );
      }

      if (
        insurancePlan.validTo &&
        insurancePlan.validTo < today
      ) {
        return req.reject(
          400,
          'Müşterinin sigorta planının geçerlilik süresi dolmuştur.'
        );
      }

      return {
        customerID:
          customer.ID,

        customerNumber:
          customer.customerNumber,

        fullName:
          customer.fullName,

        birthDate:
          customer.birthDate,

        insuranceStatus:
          customer.insuranceStatus,

        isRetired:
          Boolean(customer.isRetired),

        isContributionExempt:
          Boolean(
            customer.isContributionExempt
          ),

        insurancePlanCode:
          insurancePlan.code,

        insurancePlanName:
          insurancePlan.name,

        insurancePlanType:
          insurancePlan.planType,

        patientContributionRate:
          Number(
            insurancePlan
              .patientContributionRate
          ),

        prescriptionFee:
          Number(
            insurancePlan
              .prescriptionFee || 0
          ),

        isPublicInsurance:
          Boolean(
            insurancePlan
              .isPublicInsurance
          ),

        message:
          'Müşteri ve sigorta bilgileri başarıyla bulundu.'
      };
    }
  );

  this.on(
    'findMedicineByBarcode',
    async (req) => {
      const barcode =
        req.data.barcode?.trim();

      if (!barcode) {
        return req.reject(
          400,
          'Barkod boş bırakılamaz.'
        );
      }

      const tx = cds.tx(req);

      const medicine = await tx.run(
        SELECT.one
          .from(Medicines)
          .where({
            barcode,
            isActive: true
          })
      );

      if (!medicine) {
        return req.reject(
          404,
          'Bu barkoda ait aktif bir ilaç bulunamadı.'
        );
      }

      let shelf = null;

      if (medicine.shelf_ID) {
        shelf = await tx.run(
          SELECT.one
            .from(Shelves)
            .where({
              ID: medicine.shelf_ID
            })
        );
      }

      const today =
        new Date()
          .toISOString()
          .slice(0, 10);

      const batchRecords = await tx.run(
        SELECT.from(MedicineBatches)
          .where({
            medicine_ID: medicine.ID
          })
      );

      const availableBatches =
        batchRecords
          .filter((batch) => {
            return (
              batch.status === 'AVAILABLE' &&
              batch.isRecalled === false &&
              Number(batch.quantity) > 0 &&
              batch.expiryDate >= today
            );
          })
          .sort((firstBatch, secondBatch) => {
            return firstBatch.expiryDate.localeCompare(
              secondBatch.expiryDate
            );
          });

      const totalStock =
        availableBatches.reduce(
          (total, batch) =>
            total + Number(batch.quantity),
          0
        );

      const firstAvailableBatch =
        availableBatches[0] || null;

      let status = 'AVAILABLE';

      if (totalStock === 0) {
        status = 'OUT_OF_STOCK';
      } else if (
        totalStock <=
        Number(medicine.minimumStock)
      ) {
        status = 'CRITICAL_STOCK';
      }

      return {
        medicineID: medicine.ID,
        barcode: medicine.barcode,
        medicineCode:
          medicine.medicineCode,
        medicineName:
          medicine.name,
        manufacturer:
          medicine.manufacturer,
        dosage:
          medicine.dosage,
        dosageForm:
          medicine.dosageForm,
        requiresPrescription:
          medicine.requiresPrescription,
        shelfCode:
          shelf?.code || null,
        totalStock,
        nearestExpiryDate:
          firstAvailableBatch?.expiryDate || null,
        currentSalePrice:
          firstAvailableBatch
            ? Number(
                firstAvailableBatch.salePrice
              )
            : null,
        status,
        imageUrl:
          medicine.imageUrl,
        message:
          'İlaç barkod ile başarıyla bulundu.'
      };
    }
  );

    this.on(
    'calculateSalePrice',
    async (req) => {
      const purchasePrice =
        Number(req.data.purchasePrice);

      const profitRate =
        Number(req.data.profitRate);

      if (
        !Number.isFinite(purchasePrice) ||
        purchasePrice <= 0
      ) {
        return req.reject(
          400,
          'Alış fiyatı sıfırdan büyük olmalıdır.'
        );
      }

      if (
        !Number.isFinite(profitRate) ||
        profitRate < 0
      ) {
        return req.reject(
          400,
          'Kâr oranı negatif olamaz.'
        );
      }

      if (profitRate > 500) {
        return req.reject(
          400,
          'Kâr oranı yüzde 500’den büyük olamaz.'
        );
      }

      const profitAmount =
        purchasePrice *
        (profitRate / 100);

      const salePrice =
        purchasePrice +
        profitAmount;

      return {
        purchasePrice:
          Number(purchasePrice.toFixed(2)),
        profitRate:
          Number(profitRate.toFixed(2)),
        profitAmount:
          Number(profitAmount.toFixed(2)),
        salePrice:
          Number(salePrice.toFixed(2)),
        message:
          'Satış fiyatı başarıyla hesaplandı.'
      };
    }
  );

    this.on(
    'getExpiryAlerts',
    async (req) => {
      const requestedDays =
        req.data.days === null ||
        req.data.days === undefined
          ? 30
          : Number(req.data.days);

      if (
        !Number.isInteger(requestedDays) ||
        requestedDays < 0
      ) {
        return req.reject(
          400,
          'Gün sayısı sıfır veya pozitif bir tam sayı olmalıdır.'
        );
      }

      if (requestedDays > 365) {
        return req.reject(
          400,
          'En fazla 365 günlük kontrol yapılabilir.'
        );
      }

      const tx = cds.tx(req);

      const batches = await tx.run(
        SELECT.from(MedicineBatches)
      );

      const medicines = await tx.run(
        SELECT.from(Medicines)
      );

      const shelves = await tx.run(
        SELECT.from(Shelves)
      );

      const medicineMap = new Map(
        medicines.map((medicine) => [
          medicine.ID,
          medicine
        ])
      );

      const shelfMap = new Map(
        shelves.map((shelf) => [
          shelf.ID,
          shelf
        ])
      );

      const todayText =
        new Date().toISOString().slice(0, 10);

      const today =
        new Date(`${todayText}T00:00:00.000Z`);

      const limitDate = new Date(today);

      limitDate.setUTCDate(
        limitDate.getUTCDate() + requestedDays
      );

      const alerts = [];

      for (const batch of batches) {
        if (Number(batch.quantity) <= 0) {
          continue;
        }

        const expiryDate = new Date(
          `${batch.expiryDate}T00:00:00.000Z`
        );

        if (expiryDate > limitDate) {
          continue;
        }

        const remainingDays = Math.ceil(
          (expiryDate.getTime() - today.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        const medicine =
          medicineMap.get(batch.medicine_ID);

        if (!medicine) {
          continue;
        }

        const shelf =
          shelfMap.get(medicine.shelf_ID);

        const alertType =
          remainingDays < 0
            ? 'EXPIRED'
            : 'NEAR_EXPIRY';

        alerts.push({
          medicineID: medicine.ID,
          medicineName: medicine.name,
          barcode: medicine.barcode,
          batchID: batch.ID,
          lotNumber: batch.lotNumber,
          expiryDate: batch.expiryDate,
          remainingDays,
          quantity: Number(batch.quantity),
          shelfCode: shelf?.code || null,
          alertType,
          message:
            alertType === 'EXPIRED'
              ? 'Bu partinin son kullanma tarihi geçmiştir ve satılamaz.'
              : `Bu partinin son kullanma tarihine ${remainingDays} gün kaldı.`
        });
      }

      return alerts.sort(
        (firstAlert, secondAlert) =>
          firstAlert.expiryDate.localeCompare(
            secondAlert.expiryDate
          )
      );
    }
  );
  this.on(
    'getOrderRecommendations',
    async (req) => {
      const analysisDays =
        req.data.analysisDays === null ||
        req.data.analysisDays === undefined
          ? 30
          : Number(req.data.analysisDays);

      const leadTimeDays =
        req.data.leadTimeDays === null ||
        req.data.leadTimeDays === undefined
          ? 7
          : Number(req.data.leadTimeDays);

      if (
        !Number.isInteger(analysisDays) ||
        analysisDays <= 0 ||
        analysisDays > 365
      ) {
        return req.reject(
          400,
          'Analiz günü 1 ile 365 arasında bir tam sayı olmalıdır.'
        );
      }

      if (
        !Number.isInteger(leadTimeDays) ||
        leadTimeDays < 0 ||
        leadTimeDays > 90
      ) {
        return req.reject(
          400,
          'Tedarik süresi 0 ile 90 gün arasında olmalıdır.'
        );
      }

      const tx = cds.tx(req);

      const today = new Date();

      const startDate = new Date(today);

      startDate.setUTCDate(
        startDate.getUTCDate() - analysisDays
      );

      const sales = await tx.run(
        SELECT.from(Sales).where`
          saleDate >= ${startDate.toISOString()}
          and status = ${'COMPLETED'}
        `
      );

      const saleIDs = sales.map(
        (sale) => sale.ID
      );

      let saleItems = [];

      if (saleIDs.length > 0) {
        saleItems = await tx.run(
          SELECT.from(SaleItems).where({
            sale_ID: {
              in: saleIDs
            }
          })
        );
      }

      const medicines = await tx.run(
        SELECT.from(Medicines).where({
          isActive: true
        })
      );

      const batches = await tx.run(
        SELECT.from(MedicineBatches)
      );

      const todayText =
        today.toISOString().slice(0, 10);

      const soldByMedicine = new Map();

      for (const item of saleItems) {
        const previousQuantity =
          soldByMedicine.get(
            item.medicine_ID
          ) || 0;

        soldByMedicine.set(
          item.medicine_ID,
          previousQuantity +
            Number(item.quantity)
        );
      }

      const recommendations = [];

      for (const medicine of medicines) {
        const currentStock = batches
          .filter((batch) => {
            return (
              batch.medicine_ID ===
                medicine.ID &&
              batch.status ===
                'AVAILABLE' &&
              batch.isRecalled === false &&
              batch.expiryDate >= todayText &&
              Number(batch.quantity) > 0
            );
          })
          .reduce(
            (total, batch) =>
              total + Number(batch.quantity),
            0
          );

        const soldQuantity =
          soldByMedicine.get(
            medicine.ID
          ) || 0;

        const averageDailySales =
          soldQuantity / analysisDays;

        const minimumStock =
          Number(medicine.minimumStock) || 0;

        const safetyStock =
          Math.max(
            minimumStock,
            Math.ceil(
              averageDailySales * 7
            )
          );

        const leadTimeDemand =
          Math.ceil(
            averageDailySales *
              leadTimeDays
          );

        const targetStock =
          safetyStock +
          leadTimeDemand;

        const recommendedQuantity =
          Math.max(
            0,
            targetStock - currentStock
          );

        const estimatedStockDays =
          averageDailySales > 0
            ? currentStock /
              averageDailySales
            : null;

        let priority = 'LOW';

        if (
          currentStock <= minimumStock
        ) {
          priority = 'HIGH';
        } else if (
          estimatedStockDays !== null &&
          estimatedStockDays <=
            leadTimeDays + 7
        ) {
          priority = 'MEDIUM';
        }

        if (recommendedQuantity === 0) {
          continue;
        }

        let reason =
          'Mevcut stok hedef stok seviyesinin altında.';

        if (
          currentStock <= minimumStock
        ) {
          reason =
            'Stok minimum seviyede veya altında.';
        } else if (
          averageDailySales > 0
        ) {
          reason =
            'Satış hızına ve tedarik süresine göre stok yetersiz kalabilir.';
        }

        recommendations.push({
          medicineID:
            medicine.ID,
          medicineName:
            medicine.name,
          barcode:
            medicine.barcode,
          currentStock,
          minimumStock,
          soldQuantity,
          averageDailySales:
            Number(
              averageDailySales.toFixed(2)
            ),
          estimatedStockDays:
            estimatedStockDays === null
              ? null
              : Number(
                  estimatedStockDays.toFixed(2)
                ),
          recommendedQuantity,
          priority,
          reason
        });
      }

      const priorityOrder = {
        HIGH: 1,
        MEDIUM: 2,
        LOW: 3
      };

      return recommendations.sort(
        (first, second) => {
          const priorityDifference =
            priorityOrder[first.priority] -
            priorityOrder[second.priority];

          if (priorityDifference !== 0) {
            return priorityDifference;
          }

          return (
            second.recommendedQuantity -
            first.recommendedQuantity
          );
        }
      );
    }
  );

    this.on(
    'getNotificationSummary',
    async (req) => {
      const expiryDays =
        req.data.expiryDays === null ||
        req.data.expiryDays === undefined
          ? 30
          : Number(req.data.expiryDays);

      const analysisDays =
        req.data.analysisDays === null ||
        req.data.analysisDays === undefined
          ? 30
          : Number(req.data.analysisDays);

      const leadTimeDays =
        req.data.leadTimeDays === null ||
        req.data.leadTimeDays === undefined
          ? 7
          : Number(req.data.leadTimeDays);

      if (
        !Number.isInteger(expiryDays) ||
        expiryDays < 0 ||
        expiryDays > 365
      ) {
        return req.reject(
          400,
          'SKT kontrol günü 0 ile 365 arasında olmalıdır.'
        );
      }

      if (
        !Number.isInteger(analysisDays) ||
        analysisDays <= 0 ||
        analysisDays > 365
      ) {
        return req.reject(
          400,
          'Analiz günü 1 ile 365 arasında olmalıdır.'
        );
      }

      if (
        !Number.isInteger(leadTimeDays) ||
        leadTimeDays < 0 ||
        leadTimeDays > 90
      ) {
        return req.reject(
          400,
          'Tedarik süresi 0 ile 90 gün arasında olmalıdır.'
        );
      }

      const tx = cds.tx(req);

      const medicines = await tx.run(
        SELECT.from(Medicines).where({
          isActive: true
        })
      );

      const batches = await tx.run(
        SELECT.from(MedicineBatches)
      );

      const todayText =
        new Date().toISOString().slice(0, 10);

      const today =
        new Date(`${todayText}T00:00:00.000Z`);

      const expiryLimitDate =
        new Date(today);

      expiryLimitDate.setUTCDate(
        expiryLimitDate.getUTCDate() +
          expiryDays
      );

      const expiryLimitText =
        expiryLimitDate
          .toISOString()
          .slice(0, 10);

      const expiredCount =
        batches.filter((batch) => {
          return (
            Number(batch.quantity) > 0 &&
            batch.expiryDate < todayText
          );
        }).length;

      const nearExpiryCount =
        batches.filter((batch) => {
          return (
            Number(batch.quantity) > 0 &&
            batch.expiryDate >= todayText &&
            batch.expiryDate <= expiryLimitText
          );
        }).length;

      let criticalStockCount = 0;

      for (const medicine of medicines) {
        const currentStock =
          batches
            .filter((batch) => {
              return (
                batch.medicine_ID ===
                  medicine.ID &&
                batch.status ===
                  'AVAILABLE' &&
                batch.isRecalled === false &&
                batch.expiryDate >=
                  todayText &&
                Number(batch.quantity) > 0
              );
            })
            .reduce(
              (total, batch) =>
                total +
                Number(batch.quantity),
              0
            );

        if (
          currentStock <=
          Number(medicine.minimumStock)
        ) {
          criticalStockCount += 1;
        }
      }

      const currentDate =
        new Date();

      const startDate =
        new Date(currentDate);

      startDate.setUTCDate(
        startDate.getUTCDate() -
          analysisDays
      );

      const sales = await tx.run(
        SELECT.from(Sales).where`
          saleDate >= ${startDate.toISOString()}
          and status = ${'COMPLETED'}
        `
      );

      const saleIDs =
        sales.map((sale) => sale.ID);

      let saleItems = [];

      if (saleIDs.length > 0) {
        saleItems = await tx.run(
          SELECT.from(SaleItems).where({
            sale_ID: {
              in: saleIDs
            }
          })
        );
      }

      const soldByMedicine =
        new Map();

      for (const item of saleItems) {
        const currentQuantity =
          soldByMedicine.get(
            item.medicine_ID
          ) || 0;

        soldByMedicine.set(
          item.medicine_ID,
          currentQuantity +
            Number(item.quantity)
        );
      }

      let orderSuggestionCount = 0;

      for (const medicine of medicines) {
        const currentStock =
          batches
            .filter((batch) => {
              return (
                batch.medicine_ID ===
                  medicine.ID &&
                batch.status ===
                  'AVAILABLE' &&
                batch.isRecalled === false &&
                batch.expiryDate >=
                  todayText &&
                Number(batch.quantity) > 0
              );
            })
            .reduce(
              (total, batch) =>
                total +
                Number(batch.quantity),
              0
            );

        const soldQuantity =
          soldByMedicine.get(
            medicine.ID
          ) || 0;

        const averageDailySales =
          soldQuantity /
          analysisDays;

        const minimumStock =
          Number(
            medicine.minimumStock
          ) || 0;

        const safetyStock =
          Math.max(
            minimumStock,
            Math.ceil(
              averageDailySales * 7
            )
          );

        const leadTimeDemand =
          Math.ceil(
            averageDailySales *
              leadTimeDays
          );

        const targetStock =
          safetyStock +
          leadTimeDemand;

        const recommendedQuantity =
          Math.max(
            0,
            targetStock -
              currentStock
          );

        if (
          recommendedQuantity > 0
        ) {
          orderSuggestionCount += 1;
        }
      }

      const totalAlertCount =
        criticalStockCount +
        nearExpiryCount +
        expiredCount +
        orderSuggestionCount;

      let priority = 'LOW';

      if (
        expiredCount > 0 ||
        criticalStockCount >= 2
      ) {
        priority = 'HIGH';
      } else if (
        criticalStockCount > 0 ||
        nearExpiryCount > 0 ||
        orderSuggestionCount > 0
      ) {
        priority = 'MEDIUM';
      }

      let message =
        'Şu anda dikkatinizi gerektiren bir bildirim bulunmuyor.';

      if (totalAlertCount > 0) {
        message =
          `Dikkatinizi gerektiren toplam ${totalAlertCount} bildirim bulunmaktadır.`;
      }

      return {
        criticalStockCount,
        nearExpiryCount,
        expiredCount,
        orderSuggestionCount,
        totalAlertCount,
        priority,
        message
      };
    }
  );

    /**
   * Birden fazla ilacı tek satış ve tek transaction
   * içinde tamamlar.
   */
  this.on("completeSale", async (req) => {
   const {
  saleType,
  branchID,
  customerID,
  prescriptionNo,
  items
} = req.data;
if (!branchID) {
  return req.reject(
    400,
    "Satış yapılacak şube bilgisi bulunamadı."
  );
}
    const normalizedSaleType =
      String(saleType || "").trim().toUpperCase();

    if (
      ![
        "NON_PRESCRIPTION",
        "PRESCRIPTION"
      ].includes(normalizedSaleType)
    ) {
      return req.reject(
        400,
        "Satış türü NON_PRESCRIPTION veya PRESCRIPTION olmalıdır."
      );
    }

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return req.reject(
        400,
        "Satış sepeti boş olamaz."
      );
    }

    /*
     * Aynı barkod sepete birden fazla kez eklenmişse
     * miktarlarını birleştiriyoruz.
     */
    const cartMap = new Map();

    for (const item of items) {
      const barcode =
        String(item.barcode || "").trim();

      const quantity =
        Number(item.quantity);

      if (!barcode) {
        return req.reject(
          400,
          "Sepette barkodu boş olan bir ürün bulunuyor."
        );
      }

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return req.reject(
          400,
          `${barcode} barkodlu ürünün miktarı pozitif bir tam sayı olmalıdır.`
        );
      }

      const previousQuantity =
        cartMap.get(barcode) || 0;

      cartMap.set(
        barcode,
        previousQuantity + quantity
      );
    }

    const cartItems =
      [...cartMap.entries()].map(
        ([barcode, quantity]) => ({
          barcode,
          quantity
        })
      );

    const tx = cds.tx(req);

    const branch = await tx.run(
  SELECT.one
    .from(Branches)
    .where({
      ID: branchID,
      isActive: true
    })
);

if (!branch) {
  return req.reject(
    404,
    "Satış yapılacak aktif şube bulunamadı."
  );
}

    let customer = null;
    let insurancePlan = null;
    let prescription = null;

    const cleanedPrescriptionNo =
      String(prescriptionNo || "").trim();

    /*
     * Reçeteli satışta müşteri, sigorta ve
     * reçete doğrulaması zorunludur.
     */
    if (
      normalizedSaleType ===
      "PRESCRIPTION"
    ) {
      if (!customerID) {
        return req.reject(
          400,
          "Reçeteli satış için müşteri seçilmelidir."
        );
      }

      if (!cleanedPrescriptionNo) {
        return req.reject(
          400,
          "Reçeteli satış için reçete numarası zorunludur."
        );
      }

      customer = await tx.run(
        SELECT.one
          .from(Customers)
          .where({
            ID: customerID,
            isActive: true
          })
      );

      if (!customer) {
        return req.reject(
          404,
          "Aktif müşteri kaydı bulunamadı."
        );
      }

      if (
        customer.insuranceStatus !==
        "ACTIVE"
      ) {
        return req.reject(
          400,
          "Müşterinin sigorta durumu aktif değildir."
        );
      }

      if (customer.insurancePlan_ID) {
        insurancePlan = await tx.run(
          SELECT.one
            .from(InsurancePlans)
            .where({
              ID: customer.insurancePlan_ID,
              isActive: true
            })
        );
      }

      if (!insurancePlan) {
        return req.reject(
          404,
          "Müşteriye bağlı aktif sigorta planı bulunamadı."
        );
      }

      prescription = await tx.run(
        SELECT.one
          .from(Prescriptions)
          .where({
            prescriptionNumber:
              cleanedPrescriptionNo
          })
      );

      if (!prescription) {
        return req.reject(
          404,
          "Girilen reçete numarasına ait kayıt bulunamadı."
        );
      }

      if (
        prescription.customer_ID !==
        customer.ID
      ) {
        return req.reject(
          400,
          "Girilen reçete seçilen hastaya ait değildir."
        );
      }

      if (
        prescription.status !==
        "ACTIVE"
      ) {
        return req.reject(
          400,
          `Reçete kullanılamaz. Reçete durumu: ${prescription.status}`
        );
      }

      const today =
        new Date().toISOString().slice(0, 10);

      if (
        prescription.prescriptionDate >
          today ||
        prescription.validUntil < today
      ) {
        return req.reject(
          400,
          "Reçetenin geçerlilik süresi uygun değildir."
        );
      }
    }

    const today =
      new Date().toISOString().slice(0, 10);

    /*
     * Önce sepetin tamamını doğruluyoruz.
     * Bu aşamada henüz stok düşülmez.
     */
    const preparedItems = [];

    for (const cartItem of cartItems) {
      const medicine = await tx.run(
        SELECT.one
          .from(Medicines)
          .where({
            barcode: cartItem.barcode,
            isActive: true
          })
      );

      if (!medicine) {
        return req.reject(
          404,
          `${cartItem.barcode} barkodlu aktif ilaç bulunamadı.`
        );
      }

      if (
        normalizedSaleType ===
          "NON_PRESCRIPTION" &&
        medicine.requiresPrescription
      ) {
        return req.reject(
          400,
          `${medicine.name} reçetesiz satılamaz.`
        );
      }

      let prescriptionItem = null;

      if (
        normalizedSaleType ===
        "PRESCRIPTION"
      ) {
        prescriptionItem = await tx.run(
          SELECT.one
            .from(PrescriptionItems)
            .where({
              prescription_ID:
                prescription.ID,
              medicine_ID:
                medicine.ID
            })
        );

        if (!prescriptionItem) {
          return req.reject(
            400,
            `${medicine.name} bu reçetede bulunmuyor.`
          );
        }

        const remainingQuantity =
          Number(
            prescriptionItem
              .prescribedQuantity
          ) -
          Number(
            prescriptionItem
              .dispensedQuantity
          );

        if (
          cartItem.quantity >
          remainingQuantity
        ) {
          return req.reject(
            400,
            `${medicine.name} için reçetede kalan miktar ${remainingQuantity}.`
          );
        }
      }

     const allBatches = await tx.run(
  SELECT.from(MedicineBatches)
    .where({
      medicine_ID: medicine.ID,
      branch_ID: branchID
    })
);

      const availableBatches =
        allBatches
          .filter((batch) => {
            return (
              batch.status ===
                "AVAILABLE" &&
              batch.isRecalled === false &&
              Number(batch.quantity) > 0 &&
              batch.expiryDate >= today
            );
          })
          .sort((first, second) =>
            first.expiryDate.localeCompare(
              second.expiryDate
            )
          );

      const availableStock =
        availableBatches.reduce(
          (total, batch) =>
            total +
            Number(batch.quantity),
          0
        );

      if (
        availableStock <
        cartItem.quantity
      ) {
        return req.reject(
          400,
          `${medicine.name} için yeterli stok yok. Mevcut stok: ${availableStock}`
        );
      }

      preparedItems.push({
        medicine,
        quantity: cartItem.quantity,
        batches: availableBatches,
        prescriptionItem
      });
    }

    /*
     * Bütün kontroller tamamlandı.
     * Artık satış kaydını ve stok hareketlerini oluşturabiliriz.
     */
    const saleID =
      cds.utils.uuid();

    const saleNumber =
      `SALE-${Date.now()}`;

    const contributionRate =
      normalizedSaleType ===
        "PRESCRIPTION"
        ? Number(
            insurancePlan
              .patientContributionRate || 0
          )
        : 100;

    const prescriptionFee =
      normalizedSaleType ===
        "PRESCRIPTION"
        ? Number(
            insurancePlan
              .prescriptionFee || 0
          )
        : 0;

    await tx.run(
      INSERT.into(Sales).entries({
        ID: saleID,
        saleNumber,
        saleDate:
          new Date().toISOString(),
        saleType:
          normalizedSaleType,
        status: "COMPLETED",
        branch_ID: branchID,

        prescriptionNo:
          normalizedSaleType ===
          "PRESCRIPTION"
            ? cleanedPrescriptionNo
            : null,

        customer_ID:
          customer?.ID || null,

        prescription_ID:
          prescription?.ID || null,

        insurancePlanCodeSnapshot:
          insurancePlan?.code || null,

        contributionRateSnapshot:
          normalizedSaleType ===
          "PRESCRIPTION"
            ? contributionRate
            : 0,

        totalQuantity: 0,
        totalAmount: 0,
        totalCost: 0,
        totalProfit: 0,

        grossAmount: 0,
        sgkReferenceAmount: 0,
        patientContributionAmount: 0,
        priceDifferenceAmount: 0,
        prescriptionFeeAmount: 0,
        insuranceCoveredAmount: 0,
        patientPayableAmount: 0
      })
    );

    let totalQuantity = 0;
    let grossAmount = 0;
    let totalCost = 0;
    let totalProfit = 0;

    let sgkReferenceAmount = 0;
    let patientContributionAmount = 0;
    let priceDifferenceAmount = 0;
    let insuranceCoveredAmount = 0;
    let patientPayableAmount = 0;

    const completedItems = [];

    for (const preparedItem of preparedItems) {
      const {
        medicine,
        quantity,
        batches,
        prescriptionItem
      } = preparedItem;

      let remainingQuantity =
        quantity;

      let itemGrossAmount = 0;
      let itemCost = 0;

      let itemSgkReferenceAmount = 0;
      let itemPatientContribution = 0;
      let itemPriceDifference = 0;
      let itemInsuranceCovered = 0;
      let itemPatientPayable = 0;

      let displayUnitSalePrice = 0;

      /*
       * FEFO: Son kullanma tarihi en yakın
       * partiden başlayarak stok düşülür.
       */
      for (const batch of batches) {
        if (remainingQuantity === 0) {
          break;
        }

        const batchQuantity =
          Number(batch.quantity);

        const quantityFromBatch =
          Math.min(
            remainingQuantity,
            batchQuantity
          );

        const purchasePrice =
          Number(batch.purchasePrice);

        const salePrice =
          Number(batch.salePrice);

        displayUnitSalePrice =
          salePrice;

        const lineGrossAmount =
          quantityFromBatch *
          salePrice;

        const lineCost =
          quantityFromBatch *
          purchasePrice;

        let lineSgkReferenceAmount = 0;
        let linePatientContribution = 0;
        let linePriceDifference = 0;
        let lineInsuranceCovered = 0;
        let linePatientPayable =
          lineGrossAmount;

        if (
          normalizedSaleType ===
            "PRESCRIPTION" &&
          medicine.sgkCovered
        ) {
          const referenceUnitPrice =
            Math.min(
              Number(
                medicine.sgkReferencePrice ||
                  0
              ),
              salePrice
            );

          lineSgkReferenceAmount =
            referenceUnitPrice *
            quantityFromBatch;

          linePatientContribution =
            lineSgkReferenceAmount *
            (contributionRate / 100);

          linePriceDifference =
            Math.max(
              0,
              salePrice -
                referenceUnitPrice
            ) * quantityFromBatch;

          lineInsuranceCovered =
            lineSgkReferenceAmount -
            linePatientContribution;

          linePatientPayable =
            linePatientContribution +
            linePriceDifference;
        }

        const lineProfit =
          lineGrossAmount -
          lineCost;

        await tx.run(
          INSERT.into(SaleItems).entries({
            ID: cds.utils.uuid(),

            quantity:
              quantityFromBatch,

            unitPurchasePrice:
              Number(
                purchasePrice.toFixed(2)
              ),

            unitSalePrice:
              Number(
                salePrice.toFixed(2)
              ),

            discountRate: 0,

            lineAmount:
              Number(
                lineGrossAmount.toFixed(2)
              ),

            lineCost:
              Number(
                lineCost.toFixed(2)
              ),

            lineProfit:
              Number(
                lineProfit.toFixed(2)
              ),

            sgkReferenceUnitPrice:
              normalizedSaleType ===
                "PRESCRIPTION" &&
              medicine.sgkCovered
                ? Number(
                    Math.min(
                      Number(
                        medicine.sgkReferencePrice ||
                          0
                      ),
                      salePrice
                    ).toFixed(2)
                  )
                : 0,

            patientContributionAmount:
              Number(
                linePatientContribution.toFixed(
                  2
                )
              ),

            priceDifferenceAmount:
              Number(
                linePriceDifference.toFixed(2)
              ),

            insuranceCoveredAmount:
              Number(
                lineInsuranceCovered.toFixed(2)
              ),

            patientPayableAmount:
              Number(
                linePatientPayable.toFixed(2)
              ),

            sale_ID: saleID,
            medicine_ID: medicine.ID,
            batch_ID: batch.ID
          })
        );

        const newBatchQuantity =
          batchQuantity -
          quantityFromBatch;

        await tx.run(
          UPDATE(MedicineBatches)
            .set({
              quantity:
                newBatchQuantity,

              status:
                newBatchQuantity === 0
                  ? "SOLD_OUT"
                  : "AVAILABLE"
            })
            .where({
              ID: batch.ID
            })
        );

        itemGrossAmount +=
          lineGrossAmount;

        itemCost +=
          lineCost;

        itemSgkReferenceAmount +=
          lineSgkReferenceAmount;

        itemPatientContribution +=
          linePatientContribution;

        itemPriceDifference +=
          linePriceDifference;

        itemInsuranceCovered +=
          lineInsuranceCovered;

        itemPatientPayable +=
          linePatientPayable;

        remainingQuantity -=
          quantityFromBatch;
      }

      if (prescriptionItem) {
        const newDispensedQuantity =
          Number(
            prescriptionItem
              .dispensedQuantity
          ) + quantity;

        await tx.run(
          UPDATE(PrescriptionItems)
            .set({
              dispensedQuantity:
                newDispensedQuantity
            })
            .where({
              ID: prescriptionItem.ID
            })
        );
      }

      const itemProfit =
        itemGrossAmount -
        itemCost;

      totalQuantity += quantity;
      grossAmount += itemGrossAmount;
      totalCost += itemCost;
      totalProfit += itemProfit;

      sgkReferenceAmount +=
        itemSgkReferenceAmount;

      patientContributionAmount +=
        itemPatientContribution;

      priceDifferenceAmount +=
        itemPriceDifference;

      insuranceCoveredAmount +=
        itemInsuranceCovered;

      patientPayableAmount +=
        itemPatientPayable;

      completedItems.push({
        medicineID:
          medicine.ID,

        medicineName:
          medicine.name,

        barcode:
          medicine.barcode,

        quantity,

        unitSalePrice:
          Number(
            displayUnitSalePrice.toFixed(2)
          ),

        grossAmount:
          Number(
            itemGrossAmount.toFixed(2)
          ),

        discountAmount: 0,

        patientPayable:
          Number(
            itemPatientPayable.toFixed(2)
          )
      });
    }

    /*
     * Reçete bedeli hastanın ödeyeceği
     * toplam tutara bir kez eklenir.
     */
    if (
      normalizedSaleType ===
      "PRESCRIPTION"
    ) {
      patientPayableAmount +=
        prescriptionFee;
    }

    /*
     * Reçetedeki bütün kalemler teslim edildiyse
     * reçete tamamlandı olarak işaretlenir.
     */
    if (prescription) {
      const prescriptionItems =
        await tx.run(
          SELECT.from(PrescriptionItems)
            .where({
              prescription_ID:
                prescription.ID
            })
        );

      const completed =
        prescriptionItems.every(
          (item) =>
            Number(
              item.dispensedQuantity
            ) >=
            Number(
              item.prescribedQuantity
            )
        );

      if (completed) {
        await tx.run(
          UPDATE(Prescriptions)
            .set({
              status: "COMPLETED"
            })
            .where({
              ID: prescription.ID
            })
        );
      }
    }

    await tx.run(
      UPDATE(Sales)
        .set({
          totalQuantity,

          /*
           * Toplam satış geliri:
           * hasta + sigorta tarafından ödenen
           * ilacın brüt satış değeridir.
           */
          totalAmount:
            Number(
              grossAmount.toFixed(2)
            ),

          totalCost:
            Number(
              totalCost.toFixed(2)
            ),

          totalProfit:
            Number(
              totalProfit.toFixed(2)
            ),

          grossAmount:
            Number(
              grossAmount.toFixed(2)
            ),

          sgkReferenceAmount:
            Number(
              sgkReferenceAmount.toFixed(2)
            ),

          patientContributionAmount:
            Number(
              patientContributionAmount.toFixed(
                2
              )
            ),

          priceDifferenceAmount:
            Number(
              priceDifferenceAmount.toFixed(2)
            ),

          prescriptionFeeAmount:
            Number(
              prescriptionFee.toFixed(2)
            ),

          insuranceCoveredAmount:
            Number(
              insuranceCoveredAmount.toFixed(2)
            ),

          patientPayableAmount:
            Number(
              patientPayableAmount.toFixed(2)
            )
        })
        .where({
          ID: saleID
        })
    );

    return {
      saleID,
      saleNumber,
      saleType:
        normalizedSaleType,

      customerID:
        customer?.ID || null,

      customerName:
        customer?.fullName || null,

      insurancePlanName:
        insurancePlan?.name || null,

      prescriptionNumber:
        prescription?.prescriptionNumber ||
        null,

      totalQuantity,

      grossAmount:
        Number(
          grossAmount.toFixed(2)
        ),

      sgkReferenceAmount:
        Number(
          sgkReferenceAmount.toFixed(2)
        ),

      patientContributionAmount:
        Number(
          patientContributionAmount.toFixed(2)
        ),

      priceDifferenceAmount:
        Number(
          priceDifferenceAmount.toFixed(2)
        ),

      prescriptionFeeAmount:
        Number(
          prescriptionFee.toFixed(2)
        ),

      insuranceCoveredAmount:
        Number(
          insuranceCoveredAmount.toFixed(2)
        ),

      patientPayableAmount:
        Number(
          patientPayableAmount.toFixed(2)
        ),

      items:
        completedItems,

      message:
        normalizedSaleType ===
        "PRESCRIPTION"
          ? "Reçeteli sepet satışı başarıyla tamamlandı."
          : "Sepetteki ilaçların satışı başarıyla tamamlandı."
    };
  });

  /**
   * Barkodla ilaç satışı gerçekleştirir.
   * Reçete kontrolü, indirim, FEFO, stok düşümü,
   * satış kaydı ve kâr hesabını tek işlemde yapar.
   */
  this.on('sellMedicine', async (req) => {
    const {
      barcode,
      quantity,
      prescriptionNo
    } = req.data;

    if (!barcode || barcode.trim() === '') {
      return req.reject(
        400,
        'Barkod boş bırakılamaz.'
      );
    }

    if (!quantity || Number(quantity) <= 0) {
      return req.reject(
        400,
        'Satış miktarı sıfırdan büyük olmalıdır.'
      );
    }

    const requestedQuantity = Number(quantity);
    const cleanedBarcode = barcode.trim();

    const cleanedPrescriptionNo =
      prescriptionNo?.trim() || null;

    const tx = cds.tx(req);

    const medicine = await tx.run(
      SELECT.one
        .from(Medicines)
        .where({
          barcode: cleanedBarcode,
          isActive: true
        })
    );

    if (!medicine) {
      return req.reject(
        404,
        'Bu barkoda ait aktif bir ilaç bulunamadı.'
      );
    }

    if (
      medicine.requiresPrescription &&
      !cleanedPrescriptionNo
    ) {
      return req.reject(
        400,
        `${medicine.name} reçetesiz satılamaz. Reçete numarası giriniz.`
      );
    }

    let prescription = null;
    let prescriptionItem = null;
    let discountRate = 0;

    /**
     * Reçete numarası girildiyse gerçek reçete
     * kaydı ve reçete kalemi doğrulanır.
     */
    if (cleanedPrescriptionNo) {
      prescription = await tx.run(
        SELECT.one
          .from(Prescriptions)
          .where({
            prescriptionNumber:
              cleanedPrescriptionNo
          })
      );

      if (!prescription) {
        return req.reject(
          404,
          'Girilen reçete numarasına ait kayıt bulunamadı.'
        );
      }

      if (prescription.status !== 'ACTIVE') {
        return req.reject(
          400,
          `Bu reçete kullanılamaz. Reçete durumu: ${prescription.status}`
        );
      }

      const today =
        new Date().toISOString().slice(0, 10);

      if (
        prescription.prescriptionDate > today ||
        prescription.validUntil < today
      ) {
        return req.reject(
          400,
          'Reçetenin geçerlilik süresi dolmuştur veya reçete henüz geçerli değildir.'
        );
      }

      prescriptionItem = await tx.run(
        SELECT.one
          .from(PrescriptionItems)
          .where({
            prescription_ID:
              prescription.ID,
            medicine_ID:
              medicine.ID
          })
      );

      if (!prescriptionItem) {
        return req.reject(
          400,
          `${medicine.name} bu reçetede bulunmuyor.`
        );
      }

      const prescribedQuantity = Number(
        prescriptionItem.prescribedQuantity
      );

      const dispensedQuantity = Number(
        prescriptionItem.dispensedQuantity
      );

      const remainingPrescriptionQuantity =
        prescribedQuantity - dispensedQuantity;

      if (
        requestedQuantity >
        remainingPrescriptionQuantity
      ) {
        return req.reject(
          400,
          `Reçetedeki kalan miktar aşılamaz. Kalan miktar: ${remainingPrescriptionQuantity}`
        );
      }

      discountRate =
        Number(prescription.discountRate) || 0;
    }

    /**
     * İlaca bağlı bütün partiler alınır.
     * Tarihi geçmiş, geri çağrılmış ve stoksuz
     * partiler satış dışında bırakılır.
     */
    const batchRecords = await tx.run(
      SELECT.from(MedicineBatches)
        .where({
          medicine_ID: medicine.ID
        })
    );

    const today =
      new Date().toISOString().slice(0, 10);

    const availableBatches = batchRecords
      .filter((batch) => {
        return (
          batch.status === 'AVAILABLE' &&
          batch.isRecalled === false &&
          Number(batch.quantity) > 0 &&
          batch.expiryDate >= today
        );
      })
      .sort((firstBatch, secondBatch) => {
        return firstBatch.expiryDate.localeCompare(
          secondBatch.expiryDate
        );
      });

    const totalAvailableStock =
      availableBatches.reduce(
        (total, batch) =>
          total + Number(batch.quantity),
        0
      );

    if (
      totalAvailableStock <
      requestedQuantity
    ) {
      return req.reject(
        400,
        `Yeterli satılabilir stok bulunmuyor. Mevcut stok: ${totalAvailableStock}`
      );
    }

    const saleID = cds.utils.uuid();
    const saleNumber = `SALE-${Date.now()}`;

    await tx.run(
      INSERT.into(Sales).entries({
        ID: saleID,
        saleNumber,
        saleDate: new Date().toISOString(),
        saleType: cleanedPrescriptionNo
          ? 'PRESCRIPTION'
          : 'NON_PRESCRIPTION',
        status: 'COMPLETED',
        branch_ID: branchID,
        prescriptionNo:
          cleanedPrescriptionNo,
        totalQuantity:
          requestedQuantity,
        totalAmount: 0,
        totalCost: 0,
        totalProfit: 0
      })
    );

    let remainingQuantity =
      requestedQuantity;

    let grossAmount = 0;
    let totalDiscountAmount = 0;
    let totalAmount = 0;
    let totalCost = 0;
    let totalProfit = 0;

    /**
     * FEFO:
     * Son kullanma tarihi en yakın olan
     * partiden başlayarak stok düşülür.
     */
    for (const batch of availableBatches) {
      if (remainingQuantity === 0) {
        break;
      }

      const batchQuantity =
        Number(batch.quantity);

      const quantityFromBatch = Math.min(
        remainingQuantity,
        batchQuantity
      );

      const purchasePrice =
        Number(batch.purchasePrice);

      const salePrice =
        Number(batch.salePrice);

      const lineGrossAmount =
        quantityFromBatch * salePrice;

      const lineDiscountAmount =
        lineGrossAmount *
        (discountRate / 100);

      const lineAmount =
        lineGrossAmount -
        lineDiscountAmount;

      const lineCost =
        quantityFromBatch *
        purchasePrice;

      const lineProfit =
        lineAmount - lineCost;

      await tx.run(
        INSERT.into(SaleItems).entries({
          ID: cds.utils.uuid(),
          quantity: quantityFromBatch,
          unitPurchasePrice:
            purchasePrice,
          unitSalePrice:
            salePrice,
          discountRate,
          lineAmount,
          lineCost,
          lineProfit,
          sale_ID: saleID,
          medicine_ID: medicine.ID,
          batch_ID: batch.ID
        })
      );

      const newBatchQuantity =
        batchQuantity -
        quantityFromBatch;

      await tx.run(
        UPDATE(MedicineBatches)
          .set({
            quantity:
              newBatchQuantity,
            status:
              newBatchQuantity === 0
                ? 'SOLD_OUT'
                : 'AVAILABLE'
          })
          .where({
            ID: batch.ID
          })
      );

      grossAmount +=
        lineGrossAmount;

      totalDiscountAmount +=
        lineDiscountAmount;

      totalAmount +=
        lineAmount;

      totalCost +=
        lineCost;

      totalProfit +=
        lineProfit;

      remainingQuantity -=
        quantityFromBatch;
    }

    /**
     * Reçeteden teslim edilen miktar güncellenir.
     * Bütün kalemler tamamlandıysa reçete COMPLETED olur.
     */
    if (prescriptionItem) {
      const newDispensedQuantity =
        Number(
          prescriptionItem.dispensedQuantity
        ) + requestedQuantity;

      await tx.run(
        UPDATE(PrescriptionItems)
          .set({
            dispensedQuantity:
              newDispensedQuantity
          })
          .where({
            ID: prescriptionItem.ID
          })
      );

      const allPrescriptionItems =
        await tx.run(
          SELECT.from(PrescriptionItems)
            .where({
              prescription_ID:
                prescription.ID
            })
        );

      const prescriptionCompleted =
        allPrescriptionItems.every(
          (item) => {
            const currentDispensed =
              item.ID ===
              prescriptionItem.ID
                ? newDispensedQuantity
                : Number(
                    item.dispensedQuantity
                  );

            return (
              currentDispensed >=
              Number(
                item.prescribedQuantity
              )
            );
          }
        );

      if (prescriptionCompleted) {
        await tx.run(
          UPDATE(Prescriptions)
            .set({
              status: 'COMPLETED'
            })
            .where({
              ID: prescription.ID
            })
        );
      }
    }

    await tx.run(
      UPDATE(Sales)
        .set({
          totalAmount:
            Number(totalAmount.toFixed(2)),
          totalCost:
            Number(totalCost.toFixed(2)),
          totalProfit:
            Number(totalProfit.toFixed(2))
        })
        .where({
          ID: saleID
        })
    );

    return {
      saleID,
      saleNumber,
      medicineName:
        medicine.name,
      quantity:
        requestedQuantity,
      grossAmount:
        Number(grossAmount.toFixed(2)),
      discountRate:
        Number(discountRate.toFixed(2)),
      discountAmount:
        Number(
          totalDiscountAmount.toFixed(2)
        ),
      totalAmount:
        Number(totalAmount.toFixed(2)),
      prescriptionNumber:
        cleanedPrescriptionNo,
      message:
        cleanedPrescriptionNo
          ? 'Reçeteli satış başarıyla tamamlandı, indirim uygulandı ve stok güncellendi.'
          : 'Satış başarıyla tamamlandı ve stok güncellendi.'
    };
  });

 /**
 * Belirli bir tarih ve şube için dashboard özetini hesaplar.
 */
const calculateDashboardSummary = async (
  req,
  requestedDate,
  branchID
) => {
  const tx = cds.tx(req);

  if (!branchID) {
    return req.reject(
      400,
      'Analiz için şube bilgisi zorunludur.'
    );
  }

  const branch = await tx.run(
    SELECT.one
      .from(Branches)
      .where({
        ID: branchID,
        isActive: true
      })
  );

  if (!branch) {
    return req.reject(
      404,
      'Aktif şube bulunamadı.'
    );
  }

  const reportDate =
    requestedDate ||
    new Date().toISOString().slice(0, 10);

  const startDate =
    `${reportDate}T00:00:00.000Z`;

  const nextDate =
    new Date(startDate);

  nextDate.setUTCDate(
    nextDate.getUTCDate() + 1
  );

  const endDate =
    nextDate.toISOString();

  /*
   * Yalnızca seçilen şubenin satışları.
   */
  const sales = await tx.run(
    SELECT.from(Sales).where`
      branch_ID = ${branchID}
      and saleDate >= ${startDate}
      and saleDate < ${endDate}
      and status = ${'COMPLETED'}
    `
  );

  const saleIDs =
    sales.map((sale) => sale.ID);

  let saleItems = [];

  if (saleIDs.length > 0) {
    saleItems = await tx.run(
      SELECT.from(SaleItems)
        .where({
          sale_ID: {
            in: saleIDs
          }
        })
    );
  }

  const totalSalesCount =
    sales.length;

  const totalItemsSold =
    saleItems.reduce(
      (total, item) =>
        total + Number(item.quantity || 0),
      0
    );

  const totalRevenue =
    sales.reduce(
      (total, sale) =>
        total +
        Number(sale.totalAmount || 0),
      0
    );

  const totalCost =
    sales.reduce(
      (total, sale) =>
        total +
        Number(sale.totalCost || 0),
      0
    );

  const totalProfit =
    sales.reduce(
      (total, sale) =>
        total +
        Number(sale.totalProfit || 0),
      0
    );

  const averageProfitMargin =
    totalRevenue > 0
      ? (
          totalProfit /
          totalRevenue
        ) * 100
      : 0;

  /*
   * En çok satılan ilaç.
   */
  return summary;
  }
);

});