/** Class Reminder: Google Calendar events + Slack DM reminders.
 * Put SLACK_BOT_TOKEN and SLACK_USER_ID in Script Properties, never in this file.
 * Version: 1.0.0
 */
const VERSION = '1.0.0';
const CONFIG = {
  calendarName: 'Class Schedule',
  timeZone: 'Asia/Tokyo',
  firstClassDate: '2026-04-01',
  lastClassDate: '2026-07-31',
  eventTag: '[GAS:CLASS-REMINDER]',
  excludedDates: [],
  reminderWindowMinutes: { min: 8, max: 11 }
};

// Replace with your own classes and private attendance URLs.
const ATTENDANCE_URLS = [
  { subject: 'Example course A', url: 'https://example.com/attendance/a' },
  { subject: 'Example course B', url: 'https://example.com/attendance/b' }
];

// Sunday=0 ... Saturday=6. Period numbers refer to PERIOD_TIMES below.
const WEEKLY_LESSONS = [
  { weekday: 1, subject: 'Example course A', periods: [1, 2] },
  { weekday: 3, subject: 'Example course B', periods: [3] }
];

const PERIOD_TIMES = {
  1: ['09:00', '10:30'], 2: ['10:45', '12:15'],
  3: ['13:00', '14:30'], 4: ['14:45', '16:15'],
  5: ['16:30', '18:00']
};

/** Create missing events from the configured weekly schedule. Safe to rerun. */
function createClassEvents() {
  validateSchedule_();
  const calendar = getTargetCalendar_();
  const first = parseDate_(CONFIG.firstClassDate);
  const last = parseDate_(CONFIG.lastClassDate);
  const excluded = new Set(CONFIG.excludedDates);
  let created = 0;

  for (let day = new Date(first); day <= last; day.setDate(day.getDate() + 1)) {
    if (excluded.has(formatDate_(day))) continue;
    WEEKLY_LESSONS.filter(x => x.weekday === day.getDay()).forEach(lesson => {
      const start = combineDateTime_(day, PERIOD_TIMES[lesson.periods[0]][0]);
      const end = combineDateTime_(day, PERIOD_TIMES[lesson.periods[lesson.periods.length - 1]][1]);
      const marker = CONFIG.eventTag + ' ' + formatDate_(day) + ' ' + lesson.periods.join('-');
      const exists = calendar.getEvents(start, end).some(event =>
        event.getTitle() === lesson.subject && (event.getDescription() || '').includes(marker));
      if (exists) return;
      calendar.createEvent(lesson.subject, start, end, {
        description: marker + '\nCreated by Class Reminder.', timeZone: CONFIG.timeZone
      });
      created++;
    });
  }
  Logger.log('Created ' + created + ' events.');
}

/** Install or replace the one-minute reminder checker. */
function installReminderTrigger() {
  getSlackCredentials_();
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendAttendanceReminders')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendAttendanceReminders').timeBased().everyMinutes(1).create();
}

/** Find marked classes in the reminder window and send one DM per event. */
function sendAttendanceReminders() {
  const auth = getSlackCredentials_();
  const props = PropertiesService.getScriptProperties();
  const now = new Date();
  const horizon = new Date(now.getTime() + CONFIG.reminderWindowMinutes.max * 60000);
  const urls = {};
  ATTENDANCE_URLS.forEach(x => { if (x.url && x.url.trim()) urls[x.subject] = x.url.trim(); });

  getTargetCalendar_().getEvents(now, horizon).forEach(event => {
    const start = event.getStartTime();
    const minutes = (start.getTime() - now.getTime()) / 60000;
    if (minutes < CONFIG.reminderWindowMinutes.min || minutes > CONFIG.reminderWindowMinutes.max) return;
    if (!(event.getDescription() || '').includes(CONFIG.eventTag)) return;
    const url = urls[event.getTitle()];
    if (!url) { Logger.log('No URL configured for ' + event.getTitle()); return; }
    const key = 'sent_' + event.getId() + '_' + start.getTime();
    if (props.getProperty(key)) return;
    const message = 'Class starts soon (about 10 minutes).\n' +
      'Class: ' + event.getTitle() + '\n' +
      'Start: ' + Utilities.formatDate(start, CONFIG.timeZone, 'yyyy-MM-dd HH:mm') + '\n' +
      'Attendance page: ' + url;
    slackDirectMessage_(auth.token, auth.userId, message);
    props.setProperty(key, new Date().toISOString());
  });
}

/** Send one immediate DM to check Slack setup. */
function sendTestSlackDm() {
  const auth = getSlackCredentials_();
  slackDirectMessage_(auth.token, auth.userId, 'Class Reminder test: Slack notifications are connected.');
}

function slackDirectMessage_(token, userId, message) {
  const headers = { Authorization: 'Bearer ' + token };
  const openedResponse = UrlFetchApp.fetch('https://slack.com/api/conversations.open', {
    method: 'post', contentType: 'application/json; charset=utf-8', headers,
    payload: JSON.stringify({ users: userId }), muteHttpExceptions: true
  });
  const opened = JSON.parse(openedResponse.getContentText());
  if (!opened.ok || !opened.channel || !opened.channel.id) {
    throw new Error('Could not open Slack DM: ' + (opened.error || 'unknown_error'));
  }
  const postedResponse = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
    method: 'post', contentType: 'application/json; charset=utf-8', headers,
    payload: JSON.stringify({ channel: opened.channel.id, text: message, unfurl_links: false }),
    muteHttpExceptions: true
  });
  const posted = JSON.parse(postedResponse.getContentText());
  if (!posted.ok) throw new Error('Could not send Slack DM: ' + (posted.error || 'unknown_error'));
}

function getSlackCredentials_() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('SLACK_BOT_TOKEN');
  const userId = props.getProperty('SLACK_USER_ID');
  if (!token || !userId) throw new Error('Set SLACK_BOT_TOKEN and SLACK_USER_ID in Script Properties.');
  return { token, userId };
}

function getTargetCalendar_() {
  const calendars = CalendarApp.getCalendarsByName(CONFIG.calendarName);
  if (calendars.length !== 1) {
    throw new Error('Expected one calendar named "' + CONFIG.calendarName + '", found ' + calendars.length + '.');
  }
  return calendars[0];
}

function validateSchedule_() {
  if (!WEEKLY_LESSONS.length) throw new Error('Add at least one weekly lesson.');
  WEEKLY_LESSONS.forEach(lesson => {
    if (lesson.weekday < 0 || lesson.weekday > 6 || !lesson.periods.length) throw new Error('Invalid lesson.');
    lesson.periods.forEach(p => { if (!PERIOD_TIMES[p]) throw new Error('Missing time for period ' + p); });
  });
}

function combineDateTime_(day, hhmm) {
  const p = hhmm.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), p[0], p[1], 0, 0);
}
function parseDate_(value) {
  const p = value.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0);
}
function formatDate_(date) { return Utilities.formatDate(date, CONFIG.timeZone, 'yyyy-MM-dd'); }
