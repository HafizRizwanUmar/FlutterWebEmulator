"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LicenseManager = void 0;
class LicenseManager {
    constructor() { }
    static getInstance() {
        if (!LicenseManager.instance) {
            LicenseManager.instance = new LicenseManager();
        }
        return LicenseManager.instance;
    }
    initialize(context) {
        this.context = context;
    }
    getState() {
        return { isPremium: true, isTrialExpired: false, daysUsed: 0, daysRemaining: 999, installDate: Date.now() };
    }
    async verifyLicense(licenseKey) {
        return { success: true, message: 'This extension is free to use!' };
    }
    isFeatureAllowed() {
        return true;
    }
}
exports.LicenseManager = LicenseManager;
//# sourceMappingURL=LicenseManager.js.map