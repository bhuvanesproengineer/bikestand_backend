const axios = require('axios');

async function verify() {
    try {
        console.log("--- FINAL API VERIFICATION ---");
        
        // 1. Register a fresh vehicle
        const vNum = 'V-' + Math.floor(Math.random() * 10000);
        await axios.post('http://localhost:5000/api/register', { vehicleNumber: vNum });
        console.log(`Registered vehicle: ${vNum}`);

        // 2. Add an active weekly pass
        await axios.post('http://localhost:5000/api/subscriptions/register', {
            vehicleNumber: vNum,
            ownerName: 'Verify Bot',
            type: 'weekly'
        });
        console.log(`Registered Weekly Pass for ${vNum}`);

        // 3. Hit the Exit API (POST)
        const exitRes = await axios.post('http://localhost:5000/api/exit', { vehicleNumber: vNum });
        const sub = exitRes.data.details.subscription;
        
        console.log("\nExit API Results:");
        console.log("Total Due:", exitRes.data.details.totalDue);
        console.log("Subscription status:", sub.status);
        console.log("IsActive boolean:", sub.isActive);

        if (sub.status === 'active' && sub.isActive === true && exitRes.data.details.totalDue === 0) {
            console.log("\n✅ SUCCESS: API logic and labeling data is perfect.");
        } else {
            console.log("\n❌ FAILURE: Logic mismatch detected.");
        }

    } catch (err) {
        console.error("Verification failed:", err.response?.data || err.message);
    }
}

verify();
