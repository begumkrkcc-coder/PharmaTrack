sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"project1/test/integration/pages/MedicinesList.gen",
	"project1/test/integration/pages/MedicinesObjectPage.gen"
], function (JourneyRunner, MedicinesListGenerated, MedicinesObjectPageGenerated) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('project1') + '/test/flp.html#app-preview',
        pages: {
			onTheMedicinesListGenerated: MedicinesListGenerated,
			onTheMedicinesObjectPageGenerated: MedicinesObjectPageGenerated
        },
        async: true
    });

    return runner;
});

