// @ts-check

const path = require("path");
const { tests } = require("@iobroker/testing");
const adapterDir = path.join(__dirname, "../..");

// Run tests
tests.integration(adapterDir, {
	allowedExitCodes: [11],

	defineAdditionalTests: (getHarness) => {
	}
});

/**
 * @param {() => import("@iobroker/testing").IntegrationTestHarness} getHarness
 */
const additionalTests = (getHarness) => {
	describe("Test sendTo", () => {
		it("Should work", () => {
			return new Promise((resolve) => {
				const harness = getHarness();
				harness.startAdapterAndWait().then(() => {
					harness.sendTo("ble.0", "test", "message", (resp) => {
						console.dir(resp);
						resolve();
					});
				});
			});
		});
	})
}