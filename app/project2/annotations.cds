using PharmacyService as service from '../../srv/pharmacy-service';

annotate service.MedicineBatches with @(
    UI.HeaderInfo : {
        TypeName       : 'Parti ve Stok',
        TypeNamePlural : 'Parti ve Stoklar',
        Title          : {
            $Type : 'UI.DataField',
            Value : medicine.name
        },
        Description    : {
            $Type : 'UI.DataField',
            Value : lotNumber
        }
    },

    UI.SelectionFields : [
        medicine_ID,
        branch_ID,
        lotNumber,
        expiryDate,
        status
    ],

    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'İlaç',
            Value : medicine.name
        },
        {
            $Type : 'UI.DataField',
            Label : 'Barkod',
            Value : medicine.barcode
        },
        {
            $Type : 'UI.DataField',
            Label : 'Reçete Durumu',
            Value : medicine.prescriptionType
        },
        {
            $Type : 'UI.DataField',
            Label : 'Şube',
            Value : branch.name
        },
        {
            $Type : 'UI.DataField',
            Label : 'Parti No',
            Value : lotNumber
        },
        {
            $Type : 'UI.DataField',
            Label : 'Raf',
            Value : shelf.code
        },
        {
            $Type : 'UI.DataField',
            Label : 'Son Kullanma Tarihi',
            Value : expiryDate
        },
        {
            $Type : 'UI.DataField',
            Label : 'Stok',
            Value : quantity
        },
        {
            $Type : 'UI.DataField',
            Label : 'Satış Fiyatı',
            Value : salePrice
        },
        {
            $Type : 'UI.DataField',
            Label : 'Durum',
            Value : status
        }
    ],

    UI.FieldGroup #MedicineInformation : {
        $Type : 'UI.FieldGroupType',
        Data  : [
            {
                $Type : 'UI.DataField',
                Label : 'İlaç',
                Value : medicine.name
            },
            {
                $Type : 'UI.DataField',
                Label : 'Barkod',
                Value : medicine.barcode
            },
            {
                $Type : 'UI.DataField',
                Label : 'İlaç Kodu',
                Value : medicine.medicineCode
            },
            {
                $Type : 'UI.DataField',
                Label : 'Üretici',
                Value : medicine.manufacturer
            },
            {
                $Type : 'UI.DataField',
                Label : 'Reçete Durumu',
                Value : medicine.prescriptionType
            }
        ]
    },

    UI.FieldGroup #BatchInformation : {
        $Type : 'UI.FieldGroupType',
        Data  : [
            {
                $Type : 'UI.DataField',
                Label : 'Parti No',
                Value : lotNumber
            },
            {
                $Type : 'UI.DataField',
                Label : 'Şube',
                Value : branch.name
            },
            {
                $Type : 'UI.DataField',
                Label : 'Raf',
                Value : shelf.code
            },
            {
                $Type : 'UI.DataField',
                Label : 'Son Kullanma Tarihi',
                Value : expiryDate
            }
        ]
    },

    UI.FieldGroup #StockInformation : {
        $Type : 'UI.FieldGroupType',
        Data  : [
            {
                $Type : 'UI.DataField',
                Label : 'Stok Miktarı',
                Value : quantity
            },
            {
                $Type : 'UI.DataField',
                Label : 'Durum',
                Value : status
            },
            {
                $Type : 'UI.DataField',
                Label : 'Geri Çağırıldı',
                Value : isRecalled
            }
        ]
    },

    UI.FieldGroup #PriceInformation : {
        $Type : 'UI.FieldGroupType',
        Data  : [
            {
                $Type : 'UI.DataField',
                Label : 'Alış Fiyatı',
                Value : purchasePrice
            },
            {
                $Type : 'UI.DataField',
                Label : 'Satış Fiyatı',
                Value : salePrice
            }
        ]
    },

    UI.Facets : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'MedicineInformationFacet',
            Label  : 'İlaç Bilgileri',
            Target : '@UI.FieldGroup#MedicineInformation'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'BatchInformationFacet',
            Label  : 'Parti ve Şube Bilgileri',
            Target : '@UI.FieldGroup#BatchInformation'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'StockInformationFacet',
            Label  : 'Stok ve Durum',
            Target : '@UI.FieldGroup#StockInformation'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'PriceInformationFacet',
            Label  : 'Fiyat Bilgileri',
            Target : '@UI.FieldGroup#PriceInformation'
        }
    ]
);

annotate service.MedicineBatches with {
    medicine_ID @(
        Common.Label : 'İlaç',

        Common.ValueList : {
            $Type          : 'Common.ValueListType',
            CollectionPath : 'Medicines',

            Parameters : [
                {
                    $Type             : 'Common.ValueListParameterInOut',
                    LocalDataProperty : medicine_ID,
                    ValueListProperty : 'ID'
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'name'
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'medicineCode'
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'barcode'
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'manufacturer'
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'prescriptionType'
                }
            ]
        },

        Common.Text : medicine.name,
        Common.Text.@UI.TextArrangement : #TextOnly
    );

    branch_ID @(
        Common.Label : 'Şube',
        Common.Text : branch.name,
        Common.Text.@UI.TextArrangement : #TextOnly
    );

    shelf_ID @(
        Common.Label : 'Raf',
        Common.Text : shelf.code,
        Common.Text.@UI.TextArrangement : #TextOnly
    );
};

annotate service.MedicineBatches with {
    lotNumber     @Common.Label : 'Parti No';
    expiryDate    @Common.Label : 'Son Kullanma Tarihi';
    quantity      @Common.Label : 'Stok Miktarı';
    purchasePrice @Common.Label : 'Alış Fiyatı';
    salePrice     @Common.Label : 'Satış Fiyatı';
    status        @Common.Label : 'Durum';
    isRecalled    @Common.Label : 'Geri Çağırıldı';
};