sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"pharmatrack/project2/test/integration/pages/MedicineBatchesList.gen",
	"pharmatrack/project2/test/integration/pages/MedicineBatchesObjectPage.gen"
], function (JourneyRunner, MedicineBatchesListGenerated, MedicineBatchesObjectPageGenerated) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('pharmatrack/project2') + '/test/flpSandbox.html#pharmatrackproject2-tile',
        pages: {
			onTheMedicineBatchesListGenerated: MedicineBatchesListGenerated,
			onTheMedicineBatchesObjectPageGenerated: MedicineBatchesObjectPageGenerated
        },
        async: true
    });

    return runner;
});

