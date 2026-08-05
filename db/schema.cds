namespace pharmatrack;

using {
    cuid,
    managed
} from '@sap/cds/common';


/* =========================================================
   ŞUBE YÖNETİMİ
   ========================================================= */

@assert.unique: {
    uniqueBranchCode : [code]
}
entity Branches : cuid, managed {
    code          : String(20)  @mandatory;
    name          : String(120) @mandatory;

    city          : String(80);
    district      : String(80);
    address       : String(255);

    phone         : String(30);
    email         : String(120);
    managerName   : String(120);

    isHeadOffice  : Boolean default false;
    isActive      : Boolean default true;

    shelves       : Association to many Shelves
                    on shelves.branch = $self;

    batches       : Association to many MedicineBatches
                    on batches.branch = $self;

    sales         : Association to many Sales
                    on sales.branch = $self;

    users         : Association to many Users
                    on users.branch = $self;

    reports       : Association to many DailyReports
                    on reports.branch = $self;

    outgoingTransfers : Association to many StockTransfers
                        on outgoingTransfers.fromBranch = $self;

    incomingTransfers : Association to many StockTransfers
                        on incomingTransfers.toBranch = $self;
}


/* =========================================================
   KATEGORİ VE RAF YÖNETİMİ
   ========================================================= */

entity Categories : cuid, managed {
    name        : String(100) @mandatory;
    description : String(255);
    isActive    : Boolean default true;
}

entity Shelves : cuid, managed {
    code        : String(30) @mandatory;
    aisle       : String(10);
    cabinet     : String(10);
    level       : String(10);
    compartment : String(10);
    description : String(255);
    isActive    : Boolean default true;

    branch : Association to Branches;
}


/* =========================================================
   SİGORTA PLANLARI
   ========================================================= */

entity InsurancePlans : cuid, managed {
    code                    : String(30)    @mandatory;
    name                    : String(100)   @mandatory;
    planType                : String(30)    default 'NONE';

    // Bu oran sigortanın karşıladığı oran değil,
    // hastanın ödediği katılım payı oranıdır.
    patientContributionRate : Decimal(5,2)  default 100.00;

    prescriptionFee         : Decimal(13,2) default 0;
    isPublicInsurance       : Boolean       default false;

    validFrom               : Date;
    validTo                 : Date;
    isActive                : Boolean default true;

    customers : Association to many Customers
                on customers.insurancePlan = $self;
}


/* =========================================================
   MÜŞTERİ / HASTA YÖNETİMİ
   ========================================================= */

@assert.unique: {
    uniqueCustomerNumber : [customerNumber],
    uniqueNationalId     : [nationalId]
}
entity Customers : cuid, managed {
    customerNumber       : String(30)  @mandatory;
    fullName             : String(120) @mandatory;
    nationalId           : String(11)  @mandatory;

    birthDate            : Date;
    phone                : String(30);
    email                : String(120);

    insuranceStatus      : String(30) default 'ACTIVE';
    isRetired            : Boolean default false;
    isContributionExempt : Boolean default false;
    isActive             : Boolean default true;

    insurancePlan : Association to InsurancePlans;

    prescriptions : Association to many Prescriptions
                    on prescriptions.customer = $self;

    sales : Association to many Sales
            on sales.customer = $self;
}


/* =========================================================
   İLAÇ YÖNETİMİ
   ========================================================= */

@assert.unique: {
    uniqueMedicineBarcode : [barcode],
    uniqueMedicineCode    : [medicineCode]
}
entity Medicines : cuid, managed {
    barcode              : String(50)  @mandatory;
    medicineCode         : String(30)  @mandatory;
    name                 : String(120) @mandatory;
    manufacturer         : String(100);
    dosage               : String(50);
    dosageForm           : String(50);
    description          : String(500);
    activeIngredient : String(250);
    atcCode          : String(30);
    atcName          : String(250);
    prescriptionType : String(80);
    dataSource       : String(80);

    requiresPrescription : Boolean default false;

    sgkCovered           : Boolean default false;
    sgkReferencePrice    : Decimal(13,2) default 0;

    minimumStock         : Integer default 10;
    defaultProfitRate    : Decimal(5,2) default 20.00;

    imageUrl             : String(500);
    isActive             : Boolean default true;

    category : Association to Categories;

    /*
     * Geriye dönük uyumluluk için korunuyor.
     * İleride raf bilgisini tamamen parti/şube bazlı yapabiliriz.
     */
    shelf : Association to Shelves;

    batches : Composition of many MedicineBatches
              on batches.medicine = $self;
}

entity MedicineBatches : cuid, managed {
    lotNumber     : String(50)    @mandatory;
    expiryDate    : Date          @mandatory;
    quantity      : Integer       @mandatory;
    purchasePrice : Decimal(13,2) @mandatory;
    salePrice     : Decimal(13,2) @mandatory;

    status        : String(30) default 'AVAILABLE';
    isRecalled    : Boolean default false;

    medicine : Association to Medicines;
    branch   : Association to Branches;
    shelf    : Association to Shelves;
}

/* =========================================================
   STOK GİRİŞ ONAY SÜRECİ
   ========================================================= */

@assert.unique: {
    uniqueStockEntryRequestNumber : [requestNumber]
}
entity StockEntryRequests : cuid, managed {
    requestNumber : String(40) @mandatory;

    requestedQuantity : Integer       @mandatory;
    purchasePrice      : Decimal(13,2) @mandatory;
    proposedSalePrice  : Decimal(13,2) @mandatory;

    lotNumber  : String(50) @mandatory;
    expiryDate : Date       @mandatory;

    /*
     * PENDING
     * APPROVED
     * REJECTED
     * CANCELLED
     */
    status : String(20) default 'PENDING';

    approvedAt     : DateTime;
    rejectedAt     : DateTime;
    rejectionReason : String(500);
    adminNote       : String(500);

    medicine : Association to Medicines @mandatory;
    branch   : Association to Branches   @mandatory;

    requestedBy : Association to Users;
    approvedBy  : Association to Users;

    createdBatch : Association to MedicineBatches;
}
/* =========================================================
   SATIŞ YÖNETİMİ
   ========================================================= */

@assert.unique: {
    uniqueSaleNumber : [saleNumber]
}
entity Sales : cuid, managed {
    saleNumber : String(30) @mandatory;
    saleDate   : DateTime default $now;

    saleType : String(30) default 'NON_PRESCRIPTION';
    status   : String(20) default 'COMPLETED';

    totalQuantity : Integer default 0;
    totalAmount   : Decimal(13,2) default 0;
    totalCost     : Decimal(13,2) default 0;
    totalProfit   : Decimal(13,2) default 0;

    grossAmount               : Decimal(13,2) default 0;
    sgkReferenceAmount        : Decimal(13,2) default 0;
    patientContributionAmount : Decimal(13,2) default 0;
    priceDifferenceAmount     : Decimal(13,2) default 0;
    prescriptionFeeAmount     : Decimal(13,2) default 0;
    insuranceCoveredAmount    : Decimal(13,2) default 0;
    patientPayableAmount      : Decimal(13,2) default 0;

    insurancePlanCodeSnapshot : String(30);
    contributionRateSnapshot  : Decimal(5,2) default 0;

    prescriptionNo : String(50);

    branch       : Association to Branches;
    customer     : Association to Customers;
    prescription : Association to Prescriptions;

    items : Composition of many SaleItems
            on items.sale = $self;
}

entity SaleItems : cuid, managed {
    quantity          : Integer       @mandatory;
    unitPurchasePrice : Decimal(13,2) @mandatory;
    unitSalePrice     : Decimal(13,2) @mandatory;
    discountRate      : Decimal(5,2)  default 0;

    lineAmount : Decimal(13,2) @mandatory;
    lineCost   : Decimal(13,2) @mandatory;
    lineProfit : Decimal(13,2) @mandatory;

    sgkReferenceUnitPrice     : Decimal(13,2) default 0;
    patientContributionAmount : Decimal(13,2) default 0;
    priceDifferenceAmount     : Decimal(13,2) default 0;
    insuranceCoveredAmount    : Decimal(13,2) default 0;
    patientPayableAmount      : Decimal(13,2) default 0;

    sale     : Association to Sales;
    medicine : Association to Medicines;
    batch    : Association to MedicineBatches;
}


/* =========================================================
   REÇETE YÖNETİMİ
   ========================================================= */

@assert.unique: {
    uniquePrescriptionNumber : [prescriptionNumber]
}
entity Prescriptions : cuid, managed {
    prescriptionNumber : String(50) @mandatory;
    patientName        : String(120);

    prescriptionDate : Date @mandatory;
    validUntil       : Date @mandatory;

    prescriptionType : String(30) default 'NORMAL';
    status           : String(30) default 'ACTIVE';

    discountRate : Decimal(5,2) default 0;

    customer : Association to Customers;

    items : Composition of many PrescriptionItems
            on items.prescription = $self;
}

entity PrescriptionItems : cuid, managed {
    prescribedQuantity : Integer @mandatory;
    dispensedQuantity  : Integer default 0;
    dosageInstruction  : String(255);

    prescription : Association to Prescriptions;
    medicine     : Association to Medicines;
}


/* =========================================================
   GÜNLÜK RAPORLAR
   ========================================================= */

entity DailyReports : cuid, managed {
    reportDate          : Date @mandatory;
    totalSalesCount     : Integer default 0;
    totalItemsSold      : Integer default 0;
    totalRevenue        : Decimal(15,2) default 0;
    totalCost           : Decimal(15,2) default 0;
    totalProfit         : Decimal(15,2) default 0;
    averageProfitMargin : Decimal(7,2) default 0;

    topSellingMedicine   : String(120);
    criticalStockCount   : Integer default 0;
    nearExpiryBatchCount : Integer default 0;
    expiredBatchCount    : Integer default 0;

    status      : String(20) default 'GENERATED';
    generatedAt : DateTime default $now;

    branch : Association to Branches;
}


/* =========================================================
   KULLANICI VE YETKİ YÖNETİMİ
   ========================================================= */

@assert.unique: {
    uniqueUsername : [username]
}
entity Users : cuid, managed {
    username     : String(50)  @mandatory;
    passwordHash : String(255) @mandatory;
    fullName     : String(120) @mandatory;

    /*
     * ADMIN
     * MANAGER
     * PHARMACIST
     * WAREHOUSE
     */
    role         : String(30) @mandatory;

    isActive     : Boolean default true;

    branch : Association to Branches;
}


/* =========================================================
   ŞUBELER ARASI STOK TRANSFERİ
   ========================================================= */

@assert.unique: {
    uniqueTransferNumber : [transferNumber]
}
entity StockTransfers : cuid, managed {
    transferNumber : String(30) @mandatory;
    requestDate    : DateTime default $now;

    /*
     * REQUESTED
     * APPROVED
     * IN_TRANSIT
     * COMPLETED
     * REJECTED
     * CANCELLED
     */
    status         : String(30) default 'REQUESTED';

    requestedBy    : String(120);
    approvedBy     : String(120);
    approvedAt     : DateTime;
    completedAt    : DateTime;
    note           : String(500);

    fromBranch : Association to Branches;
    toBranch   : Association to Branches;

    items : Composition of many StockTransferItems
            on items.transfer = $self;
}

entity StockTransferItems : cuid, managed {
    quantity : Integer @mandatory;

    transfer : Association to StockTransfers;
    medicine : Association to Medicines;

    /*
     * Transferde hangi partinin kullanıldığını
     * takip etmek için tutulur.
     */
    sourceBatch : Association to MedicineBatches;
}