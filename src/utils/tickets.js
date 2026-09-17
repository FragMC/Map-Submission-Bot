import fs from 'fs';
import path from 'path';

const dataPath = './data/tickets.json';

function loadData() {
  try {
    if (!fs.existsSync(dataPath)) return { mapCounter: 0, reportCounter: 0, tickets: {} };
    return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  } catch {
    return { mapCounter: 0, reportCounter: 0, tickets: {} };
  }
}

function saveData(data) {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

export function getNextTicketNumber(type) {
  const data = loadData();
  if (type === 'map') {
    data.mapCounter += 1;
    saveData(data);
    return String(data.mapCounter).padStart(4, '0');
  } else {
    data.reportCounter += 1;
    saveData(data);
    return String(data.reportCounter).padStart(4, '0');
  }
}

export function saveTicket(channelId, ticketData) {
  const data = loadData();
  data.tickets[channelId] = ticketData;
  saveData(data);
}

export function getTicket(channelId) {
  const data = loadData();
  return data.tickets[channelId];
}

export function deleteTicket(channelId) {
  const data = loadData();
  delete data.tickets[channelId];
  saveData(data);
}

export function updateTicketChannelId(oldId, newId) {
  const data = loadData();
  if (data.tickets[oldId]) {
    data.tickets[newId] = data.tickets[oldId];
    delete data.tickets[oldId];
    saveData(data);
  }
}
