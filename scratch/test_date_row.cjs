const testRow1 = "Data de Partida Horário Nº de Passageiros\n17/09/2026 6:30 13";
const testRow2 = "17/09/2026 12:00 13";

const m1 = testRow1.match(/(\d{2}\/\d{2}\/\d{4})\s+([01]?\d|2[0-3])[:hH]([0-5]\d)\s+(\d{1,3})/);
console.log("Match row 1:", m1 ? { date: m1[1], time: `${m1[2].padStart(2, '0')}:${m1[3]}`, count: m1[4] } : null);

const m2 = testRow2.match(/(\d{2}\/\d{2}\/\d{4})\s+([01]?\d|2[0-3])[:hH]([0-5]\d)\s+(\d{1,3})/);
console.log("Match row 2:", m2 ? { date: m2[1], time: `${m2[2].padStart(2, '0')}:${m2[3]}`, count: m2[4] } : null);
