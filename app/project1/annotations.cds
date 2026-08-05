using PharmacyService as service from '../../srv/pharmacy-service';

annotate service.Medicines with @(
    UI.HeaderInfo : {
        TypeName       : 'İlaç',
        TypeNamePlural : 'İlaçlar',
        Title          : {
            $Type : 'UI.DataField',
            Value : name
        },
        Description    : {
            $Type : 'UI.DataField',
            Value : medicineCode
        }
    },

    UI.SelectionFields : [
        name,
        barcode,
        medicineCode,
        manufacturer,
        requiresPrescription,
        isActive
    ],

    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'İlaç Adı',
            Value : name
        },
        {
            $Type : 'UI.DataField',
            Label : 'İlaç Kodu',
            Value : medicineCode
        },
        {
            $Type : 'UI.DataField',
            Label : 'Barkod',
            Value : barcode
        },
        {
            $Type : 'UI.DataField',
            Label : 'Üretici',
            Value : manufacturer
        },
        {
            $Type : 'UI.DataField',
            Label : 'Doz',
            Value : dosage
        },
        {
            $Type : 'UI.DataField',
            Label : 'Form',
            Value : dosageForm
        },
        {
            $Type : 'UI.DataField',
            Label : 'Reçeteli',
            Value : requiresPrescription
        },
        {
            $Type : 'UI.DataField',
            Label : 'Minimum Stok',
            Value : minimumStock
        },
        {
            $Type : 'UI.DataField',
            Label : 'Aktif',
            Value : isActive
        }
    ],

    UI.FieldGroup #GeneralInformation : {
        $Type : 'UI.FieldGroupType',
        Data  : [
            {
                $Type : 'UI.DataField',
                Label : 'İlaç Adı',
                Value : name
            },
            {
                $Type : 'UI.DataField',
                Label : 'İlaç Kodu',
                Value : medicineCode
            },
            {
                $Type : 'UI.DataField',
                Label : 'Barkod',
                Value : barcode
            },
            {
                $Type : 'UI.DataField',
                Label : 'Üretici',
                Value : manufacturer
            },
            {
                $Type : 'UI.DataField',
                Label : 'Açıklama',
                Value : description
            }
        ]
    },

    UI.FieldGroup #MedicalInformation : {
        $Type : 'UI.FieldGroupType',
        Data  : [
            {
                $Type : 'UI.DataField',
                Label : 'Doz',
                Value : dosage
            },
            {
                $Type : 'UI.DataField',
                Label : 'İlaç Formu',
                Value : dosageForm
            },
            {
                $Type : 'UI.DataField',
                Label : 'Reçete Gerekli',
                Value : requiresPrescription
            },
            {
    $Type : 'UI.DataField',
    Label : 'Kategori',
    Value : category_ID
},
        ]
    },

    UI.FieldGroup #StockInformation : {
        $Type : 'UI.FieldGroupType',
        Data  : [
            {
                $Type : 'UI.DataField',
                Label : 'Minimum Stok',
                Value : minimumStock
            },
            {
                $Type : 'UI.DataField',
                Label : 'Varsayılan Kâr Oranı (%)',
                Value : defaultProfitRate
            },
            {
    $Type : 'UI.DataField',
    Label : 'Raf',
    Value : shelf_ID
},
            {
                $Type : 'UI.DataField',
                Label : 'Aktif',
                Value : isActive
            }
        ]
    },

    UI.FieldGroup #MediaInformation : {
        $Type : 'UI.FieldGroupType',
        Data  : [
            {
                $Type : 'UI.DataField',
                Label : 'Görsel Bağlantısı',
                Value : imageUrl
            }
        ]
    },

    UI.Facets : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'GeneralInformationFacet',
            Label  : 'Genel Bilgiler',
            Target : '@UI.FieldGroup#GeneralInformation'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'MedicalInformationFacet',
            Label  : 'İlaç Bilgileri',
            Target : '@UI.FieldGroup#MedicalInformation'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'StockInformationFacet',
            Label  : 'Stok ve Raf Bilgileri',
            Target : '@UI.FieldGroup#StockInformation'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'MediaInformationFacet',
            Label  : 'Görsel',
            Target : '@UI.FieldGroup#MediaInformation'
        }
    ]
);

annotate service.Medicines with {
    category @Common.Label : 'Kategori';

    category @Common.ValueList : {
        $Type          : 'Common.ValueListType',
        CollectionPath : 'Categories',
        Parameters     : [
            {
                $Type             : 'Common.ValueListParameterInOut',
                LocalDataProperty : category_ID,
                ValueListProperty : 'ID'
            },
            {
                $Type             : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'name'
            },
            {
                $Type             : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'description'
            }
        ]
    };

    shelf @Common.Label : 'Raf';

    shelf @Common.ValueList : {
        $Type          : 'Common.ValueListType',
        CollectionPath : 'Shelves',
        Parameters     : [
            {
                $Type             : 'Common.ValueListParameterInOut',
                LocalDataProperty : shelf_ID,
                ValueListProperty : 'ID'
            },
            {
                $Type             : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'code'
            },
            {
                $Type             : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'aisle'
            },
            {
                $Type             : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'cabinet'
            },
            {
                $Type             : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'level'
            }
        ]
    };
};

annotate service.Medicines with {

    category_ID @(
        Common.Label : 'Kategori',

        Common.ValueList : {
            $Type          : 'Common.ValueListType',
            CollectionPath : 'Categories',

            Parameters : [
                {
                    $Type             : 'Common.ValueListParameterInOut',
                    LocalDataProperty : category_ID,
                    ValueListProperty : 'ID'
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'name'
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'description'
                }
            ]
        },

        Common.Text : category.name,
        Common.Text.@UI.TextArrangement : #TextOnly
    );


    shelf_ID @(
        Common.Label : 'Raf',

        Common.ValueList : {
            $Type          : 'Common.ValueListType',
            CollectionPath : 'Shelves',

            Parameters : [
                {
                    $Type             : 'Common.ValueListParameterInOut',
                    LocalDataProperty : shelf_ID,
                    ValueListProperty : 'ID'
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'code'
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'aisle'
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'cabinet'
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'level'
                }
            ]
        },

        Common.Text : shelf.code,
        Common.Text.@UI.TextArrangement : #TextOnly
    );
};