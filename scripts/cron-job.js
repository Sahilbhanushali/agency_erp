// scripts/cron.js
const cron = require('node-cron');
const { sendDailyDesignerReport } = require('./dailyDesigner');
const { sendDailyDelayReport } = require('./dailyDelayReport');
const { sendEodTodoReport, sendTaskReminders } = require('./cron-client');

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

// End of day: email each manager what their people planned, finished and got stuck on.
cron.schedule('0 19 * * 1-5', async () => {
  console.log('[cron] end-of-day todo report');
  await sendEodTodoReport();
}, { timezone: 'Asia/Kolkata' });

// Morning nudge for tasks that have slipped past their due date.
cron.schedule('30 9 * * 1-5', async () => {
  console.log('[cron] overdue task reminders');
  await sendTaskReminders();
}, { timezone: 'Asia/Kolkata' });

console.log('Cron jobs scheduled: Designer Report (2:18 PM), Delay Report (9:00 PM), EOD Todo Report (7:00 PM Mon-Fri), Task Reminders (9:30 AM Mon-Fri)');