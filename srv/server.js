import cds from "@sap/cds";

cds.on("bootstrap", function (app) {
    app.get("/", function (req, res) {
        res.redirect("/login/webapp/index.html");
    });
});

export default cds.server;