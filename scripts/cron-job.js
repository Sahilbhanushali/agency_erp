// scripts/cron.js
const cron = require('node-cron');
const { sendDailyDesignerReport } = require('./dailyDesigner');
const { sendDailyDelayReport } = require('./dailyDelayReport');

// Schedule the task to run at 2:18 PM IST daily
// 2:18 PM IST = 8:48 AM UTC (14:18 - 5:30)
cron.schedule('53 8 * * *', async () => {
  console.log('Running daily designer report cron job at', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  await sendDailyDesignerReport();
}, {
  timezone: 'Asia/Kolkata',
});

// Schedule delay report at 9:00 PM IST daily
cron.schedule('0 21 * * *', async () => {
  console.log('Running daily delay report cron job at', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  await sendDailyDelayReport();
}, { timezone: 'Asia/Kolkata' });

console.log('Cron jobs scheduled: Designer Report (2:18 PM), Delay Report (9:00 PM)');