sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
], function (Controller, MessageToast) {
    "use strict";

    return Controller.extend("pharmatrack.login.controller.App", {

        onInit: function () {
            this._restoreRememberedUser();
            this._restoreActiveSession();
        },

        onOpenLogin: function () {
            var oDialog = this.byId("loginDialog");

            this.byId("errorMessage").setVisible(false);
            oDialog.open();

            setTimeout(function () {
                this.byId("usernameInput").focus();
            }.bind(this), 250);
        },
        onOpenNotificationCenter: function () {
            this.getOwnerComponent()
            .getRouter()
            .navTo("notificationCenter");
        },

        onCloseLogin: function () {
            var oDialog = this.byId("loginDialog");

            if (oDialog && oDialog.isOpen()) {
                oDialog.close();
            }

            this.byId("errorMessage").setVisible(false);
            this.byId("passwordInput").setValue("");
        },

        onForgotPassword: function () {
            MessageToast.show(
                "Şifre yenileme özelliği daha sonra eklenecek."
            );
        },

        onLogin: async function () {
            var sUsername = this.byId("usernameInput")
                .getValue()
                .trim();

            var sPassword = this.byId("passwordInput")
                .getValue();

            var oLoginButton = this.byId("loginButton");

            this.byId("errorMessage").setVisible(false);

            if (!sUsername || !sPassword) {
                this._showLoginError(
                    "Kullanıcı adı ve şifre alanları zorunludur."
                );
                return;
            }

            oLoginButton.setBusy(true);
            oLoginButton.setEnabled(false);

            try {
                var oResponse = await fetch(
                    "/odata/v4/pharmacy/login",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Accept": "application/json"
                        },
                        body: JSON.stringify({
                            username: sUsername,
                            password: sPassword
                        })
                    }
                );

                var oResult = await oResponse.json();

                if (!oResponse.ok) {
                    throw new Error(
                        this._getServiceErrorMessage(oResult)
                    );
                }

                if (!oResult.success) {
                    this._showLoginError(
                        oResult.message ||
                        "Kullanıcı adı veya şifre hatalı."
                    );

                    this.byId("passwordInput").setValue("");
                    this.byId("passwordInput").focus();
                    return;
                }

                var oUser = {
                    userID: oResult.userID,
                    username: oResult.username,
                    fullName: oResult.fullName,
                    role: oResult.role,
                    branchID: oResult.branchID || null,
                    branchCode: oResult.branchCode || null,
                    branchName:
                        oResult.branchName || "Tüm Şubeler"
                };

                this._saveSession(oUser);
                this._handleRememberMe(sUsername);

                var oDialog = this.byId("loginDialog");

                if (oDialog && oDialog.isOpen()) {
                    oDialog.close();
                }

                this._showDashboard(oUser);

                MessageToast.show(
                    "Giriş başarılı. " + oUser.fullName
                );

            } catch (oError) {
                console.error("Login error:", oError);

                this._showLoginError(
                    oError.message ||
                    "Giriş işlemi sırasında bir hata oluştu."
                );
            } finally {
                oLoginButton.setBusy(false);
                oLoginButton.setEnabled(true);
            }
        },

        onLogout: function () {
            sessionStorage.removeItem("pharmatrackUser");

            var oDialog = this.byId("loginDialog");

            if (oDialog && oDialog.isOpen()) {
                oDialog.close();
            }

            this.byId("dashboardArea").setVisible(false);
            this.byId("adminDashboardArea").setVisible(false);
            this.byId("branchDashboardArea").setVisible(false);
            this.byId("welcomeArea").setVisible(true);

            this.byId("passwordInput").setValue("");
            this.byId("errorMessage").setVisible(false);

            MessageToast.show("Oturum kapatıldı.");
        },

        onOpenSales: function () {
            this.getOwnerComponent()
                .getRouter()
                .navTo("sales");
        },

        onOpenSalesHistory: function () {
            this.getOwnerComponent()
                .getRouter()
                .navTo("salesHistory");
        },

        onOpenMedicines: function () {
            window.location.href =
                "/project1/index.html";
        },

        onOpenBatches: function () {
            window.location.href =
                "/pharmatrack.project2/index.html";
        },

        onOpenStockEntry: function () {
            this.getOwnerComponent()
                .getRouter()
                .navTo("stockEntry");
        },

        onOpenReports: function () {
            this.getOwnerComponent()
                .getRouter()
                .navTo("analytics");
        },

        onOpenAdminBranches: function () {
            this.getOwnerComponent()
                .getRouter()
                .navTo("branches");
        },

        onOpenAdminOperations: function () {
            MessageToast.show(
                "Tüm şube işlemleri ekranını sıradaki adımda oluşturacağız."
            );
        },

       onOpenApprovalCenter: function () {
    this.getOwnerComponent()
        .getRouter()
        .navTo("approvalCenter");
},

       

        onOpenProcurement: function () {
            this.getOwnerComponent()
                .getRouter()
                .navTo("purchaseCenter");
        },

        onOpenUskudarBranch: function () {
            MessageToast.show(
                "Üsküdar Şubesi detay ekranı açılacak."
            );
        },

        onOpenKadikoyBranch: function () {
            MessageToast.show(
                "Kadıköy Şubesi detay ekranı açılacak."
            );
        },

        onOpenBesiktasBranch: function () {
            MessageToast.show(
                "Beşiktaş Şubesi detay ekranı açılacak."
            );
        },

        _showDashboard: function (oUser) {
            var bIsAdmin = oUser.role === "ADMIN";

            this.byId("welcomeArea").setVisible(false);
            this.byId("dashboardArea").setVisible(true);

            this.byId("adminDashboardArea")
                .setVisible(bIsAdmin);

            this.byId("branchDashboardArea")
                .setVisible(!bIsAdmin);

            this.byId("dashboardUserName").setText(
                oUser.fullName
            );

            this.byId("dashboardUserRole").setText(
                this._getRoleText(oUser.role)
            );

            if (bIsAdmin) {
                this.byId("adminDashboardGreeting").setText(
                    "Merhaba, " +
                    oUser.fullName +
                    " • Tüm Şubeler"
                );
                return;
            }

            var sBranchText =
                oUser.branchName || "Şube bilgisi yok";

            this.byId("dashboardGreeting").setText(
                "Merhaba, " +
                oUser.fullName +
                " • " +
                sBranchText
            );
        },

        _restoreActiveSession: function () {
            var sSession =
                sessionStorage.getItem(
                    "pharmatrackUser"
                );

            if (!sSession) {
                return;
            }

            try {
                var oUser = JSON.parse(sSession);
                this._showDashboard(oUser);
            } catch (oError) {
                sessionStorage.removeItem(
                    "pharmatrackUser"
                );
            }
        },

        _getRoleText: function (sRole) {
            var oRoleTexts = {
                ADMIN: "Sistem Yöneticisi",
                BRANCH: "Şube Hesabı",
                WAREHOUSE: "Depo Yetkilisi"
            };

            return oRoleTexts[sRole] || sRole;
        },

        _saveSession: function (oUser) {
            var oSessionUser = {
                userID: oUser.userID,
                username: oUser.username,
                fullName: oUser.fullName,
                role: oUser.role,
                branchID: oUser.branchID || null,
                branchCode: oUser.branchCode || null,
                branchName:
                    oUser.branchName || "Tüm Şubeler",
                loginTime: new Date().toISOString()
            };

            sessionStorage.setItem(
                "pharmatrackUser",
                JSON.stringify(oSessionUser)
            );
        },

        _handleRememberMe: function (sUsername) {
            var bRemember =
                this.byId("rememberCheckBox")
                    .getSelected();

            if (bRemember) {
                localStorage.setItem(
                    "pharmatrackRememberedUser",
                    sUsername
                );
            } else {
                localStorage.removeItem(
                    "pharmatrackRememberedUser"
                );
            }
        },

        _restoreRememberedUser: function () {
            var sRememberedUser =
                localStorage.getItem(
                    "pharmatrackRememberedUser"
                );

            if (!sRememberedUser) {
                return;
            }

            this.byId("usernameInput").setValue(
                sRememberedUser
            );

            this.byId("rememberCheckBox")
                .setSelected(true);
        },

        _getServiceErrorMessage: function (oResult) {
            if (
                oResult &&
                oResult.error &&
                oResult.error.message
            ) {
                if (
                    typeof oResult.error.message ===
                    "string"
                ) {
                    return oResult.error.message;
                }

                if (oResult.error.message.value) {
                    return oResult.error.message.value;
                }
            }

            if (oResult && oResult.message) {
                return oResult.message;
            }

            return "Servisten geçerli bir cevap alınamadı.";
        },

        _showLoginError: function (sMessage) {
            var oMessageStrip =
                this.byId("errorMessage");

            oMessageStrip.setText(sMessage);
            oMessageStrip.setVisible(true);
        },
        onOpenPurchaseCenter: function () {
            this.getOwnerComponent()
                .getRouter()
                .navTo("purchaseCenter");
        },

    });
});