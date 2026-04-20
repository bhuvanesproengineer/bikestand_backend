const Settings = require('./models/Settings');

async function test() {
    try {
        console.log('Testing Settings model from backend dir...');
        const s = await Settings.get();
        console.log('Current settings:', JSON.stringify(s));
        
        console.log('Resetting today revenue...');
        await Settings.resetTodayRevenue();
        
        const updated = await Settings.get();
        console.log('Updated settings:', JSON.stringify(updated));
        
        if (updated.revenueTodayResetTimestamp) {
            console.log('SUCCESS: Settings updated correctly.');
        } else {
            console.log('FAILURE: Settings not updated.');
        }
    } catch (err) {
        console.error('Test failed with error:', err);
    }
}

test();
