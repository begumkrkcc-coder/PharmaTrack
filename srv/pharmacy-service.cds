using { pharmatrack as db } from '../db/schema';

service PharmacyService {

    @odata.draft.enabled
    @Capabilities.InsertRestrictions.Insertable : true
    @Capabilities.UpdateRestrictions.Updatable   : true
    @Capabilities.DeleteRestrictions.Deletable   : true
    entity Medicines as projection on db.Medicines;

    entity Categories        as projection on db.Categories;
    entity Shelves           as projection on db.Shelves;
    entity MedicineBatches   as projection on db.MedicineBatches;

    entity InsurancePlans    as projection on db.InsurancePlans;
    entity Customers         as projection on db.Customers;

    entity Sales             as projection on db.Sales;
    entity SaleItems         as projection on db.SaleItems;

    entity Prescriptions     as projection on db.Prescriptions;
    entity PrescriptionItems as projection on db.PrescriptionItems;

    entity DailyReports      as projection on db.DailyReports;
   
    entity Branches           as projection on db.Branches;
    entity StockTransfers     as projection on db.StockTransfers;
    entity StockTransferItems as projection on db.StockTransferItems;
    entity StockEntryRequests as projection on db.StockEntryRequests;
 
    /* =====================================================
       TEK İLAÇ SATIŞ SONUCU
       ===================================================== */

    type SaleResult {
        saleID             : UUID;
        saleNumber         : String(30);
        medicineName       : String(120);
        quantity           : Integer;
        grossAmount        : Decimal(13,2);
        discountRate       : Decimal(5,2);
        discountAmount     : Decimal(13,2);
        totalAmount        : Decimal(13,2);
        prescriptionNumber : String(50);
        message            : String(255);
    }


    /* =====================================================
       SEPET SATIŞI İSTEK VE SONUÇ TİPLERİ
       ===================================================== */

    type SaleCartItemInput {
        barcode  : String(50);
        quantity : Integer;
    }

    type CompletedSaleItem {
        medicineID      : UUID;
        medicineName    : String(120);
        barcode         : String(50);
        quantity        : Integer;
        unitSalePrice   : Decimal(13,2);
        grossAmount     : Decimal(13,2);
        discountAmount  : Decimal(13,2);
        patientPayable  : Decimal(13,2);
    }

    type CompleteSaleResult {
        saleID                    : UUID;
        saleNumber                : String(30);
        saleType                  : String(30);

        customerID                : UUID;
        customerName              : String(120);
        insurancePlanName         : String(100);
        prescriptionNumber        : String(50);

        totalQuantity             : Integer;
        grossAmount               : Decimal(13,2);
        sgkReferenceAmount        : Decimal(13,2);
        patientContributionAmount : Decimal(13,2);
        priceDifferenceAmount     : Decimal(13,2);
        prescriptionFeeAmount     : Decimal(13,2);
        insuranceCoveredAmount    : Decimal(13,2);
        patientPayableAmount      : Decimal(13,2);

        items                      : many CompletedSaleItem;
        message                    : String(255);
    }


    /* =====================================================
       DASHBOARD VE YARDIMCI SONUÇ TİPLERİ
       ===================================================== */

    type DashboardSummary {
        reportDate           : Date;
        totalSalesCount      : Integer;
        totalItemsSold       : Integer;
        totalRevenue         : Decimal(15,2);
        totalCost            : Decimal(15,2);
        totalProfit          : Decimal(15,2);
        averageProfitMargin  : Decimal(7,2);
        topSellingMedicine   : String(120);
        criticalStockCount   : Integer;
        nearExpiryBatchCount : Integer;
        expiredBatchCount    : Integer;
    }

    type BranchSummaryResult {
    branchID            : UUID;
    branchCode          : String(20);
    branchName          : String(120);
    district            : String(80);

    isActive            : Boolean;

    todayRevenue        : Decimal(15,2);
    todaySalesCount     : Integer;
    todayItemsSold      : Integer;

    criticalStockCount  : Integer;
    pendingRequestCount : Integer;
}

    type BarcodeLookupResult {
        medicineID           : UUID;
        barcode              : String(50);
        medicineCode         : String(30);
        medicineName         : String(120);
        manufacturer         : String(100);
        dosage               : String(50);
        dosageForm           : String(50);
        requiresPrescription : Boolean;
        shelfCode            : String(30);
        totalStock           : Integer;
        nearestExpiryDate    : Date;
        currentSalePrice     : Decimal(13,2);
        status               : String(30);
        imageUrl             : String(500);
        message              : String(255);
    }

    type PriceCalculationResult {
        purchasePrice : Decimal(13,2);
        profitRate    : Decimal(5,2);
        profitAmount  : Decimal(13,2);
        salePrice     : Decimal(13,2);
        message       : String(255);
    }

    type ExpiryAlertResult {
        medicineID    : UUID;
        medicineName  : String(120);
        barcode       : String(50);
        batchID       : UUID;
        lotNumber     : String(50);
        expiryDate    : Date;
        remainingDays : Integer;
        quantity      : Integer;
        shelfCode     : String(30);
        alertType     : String(30);
        message       : String(255);
    }

    type OrderRecommendationResult {
        medicineID          : UUID;
        medicineName        : String(120);
        barcode             : String(50);
        currentStock        : Integer;
        minimumStock        : Integer;
        soldQuantity        : Integer;
        averageDailySales   : Decimal(9,2);
        estimatedStockDays  : Decimal(9,2);
        recommendedQuantity : Integer;
        priority            : String(20);
        reason              : String(255);
    }

    type NotificationSummary {
        criticalStockCount   : Integer;
        nearExpiryCount      : Integer;
        expiredCount         : Integer;
        orderSuggestionCount : Integer;
        totalAlertCount      : Integer;
        priority             : String(20);
        message              : String(255);
    }

    type AssistantResponse {
    success : Boolean;
    intent  : String(50);
    answer  : LargeString;
}
type LoginResult {
    success    : Boolean;
    message    : String(255);

    userID     : UUID;
    username   : String(50);
    fullName   : String(120);
    role       : String(30);

    branchID   : UUID;
    branchCode : String(20);
    branchName : String(120);
}

    /* =====================================================
       TC İLE HASTA / SİGORTA SORGULAMA
       ===================================================== */

    type CustomerLookupResult {
        customerID              : UUID;
        customerNumber          : String(30);
        fullName                : String(120);
        birthDate               : Date;
        insuranceStatus         : String(30);
        isRetired               : Boolean;
        isContributionExempt    : Boolean;

        insurancePlanCode       : String(30);
        insurancePlanName       : String(100);
        insurancePlanType       : String(30);
        patientContributionRate : Decimal(5,2);
        prescriptionFee         : Decimal(13,2);
        isPublicInsurance       : Boolean;

        message                 : String(255);
    }
    type StockEntryRequestResult {
        success       : Boolean;
        requestID     : UUID;
        requestNumber : String(40);
        status        : String(20);
        message       : String(255);
    }

    type StockEntryApprovalResult {
        success       : Boolean;
        requestID     : UUID;
        requestNumber : String(40);
        batchID       : UUID;
        status        : String(20);
        message       : String(255);
    }

    /* =====================================================
       ACTION'LAR
       ===================================================== */

    action findCustomerByNationalId(
        nationalId : String(11)
    ) returns CustomerLookupResult;


    /*
     * Yeni sepet satışı:
     * Birden fazla ilaç tek transaction içinde satılır.
     */
   action completeSale(
    saleType       : String(30),
    branchID       : UUID,
    customerID     : UUID,
    prescriptionNo : String(50),
    items          : many SaleCartItemInput
) returns CompleteSaleResult;

    /*
     * Eski tek ilaç satışı.
     * Şimdilik geriye dönük uyumluluk için korunuyor.
     */
    action sellMedicine(
        barcode        : String(50),
        quantity       : Integer,
        prescriptionNo : String(50)
    ) returns SaleResult;


    action getDashboardSummary(
    reportDate : Date,
    branchID   : UUID
) returns DashboardSummary;

    action getBranchSummaries()
returns many BranchSummaryResult;


    action generateDailyReport(
    reportDate : Date,
    branchID   : UUID
) returns DashboardSummary;

    action findMedicineByBarcode(
        barcode : String(50)
    ) returns BarcodeLookupResult;


    action calculateSalePrice(
        purchasePrice : Decimal(13,2),
        profitRate    : Decimal(5,2)
    ) returns PriceCalculationResult;


    action getExpiryAlerts(
        days : Integer
    ) returns many ExpiryAlertResult;


    action getOrderRecommendations(
        analysisDays : Integer,
        leadTimeDays : Integer
    ) returns many OrderRecommendationResult;


    action getNotificationSummary(
        expiryDays   : Integer,
        analysisDays : Integer,
        leadTimeDays : Integer
    ) returns NotificationSummary;

    action askAssistant(
    message : LargeString
) returns AssistantResponse;

action login(
    username : String(50),
    password : String(255)
) returns LoginResult;

action createStockEntryRequest(
    medicineID     : UUID,
    branchID       : UUID,
    requesterUserID: UUID,
    quantity       : Integer,
    purchasePrice  : Decimal(13,2),
    salePrice      : Decimal(13,2),
    lotNumber      : String(50),
    expiryDate     : Date
) returns StockEntryRequestResult;

action approveStockEntry(
    requestID  : UUID,
    adminUserID: UUID,
    adminNote  : String(500)
) returns StockEntryApprovalResult;

action rejectStockEntry(
    requestID  : UUID,
    adminUserID: UUID,
    reason     : String(500)
) returns StockEntryRequestResult;
}