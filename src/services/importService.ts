import * as XLSX from 'xlsx';
import { 
  TripRequest, 
  MacroUnit, 
  ActivityType, 
  StatusDeadline, 
  TripStatus, 
  TravelReportStatus, 
  City
} from '../types';
import { DistanceService } from './distanceService';
import { FleetService } from './fleetService';
import { isValid } from 'date-fns';

export interface ParsedSheetResult {
  sheetName: string;
  totalRows: number;
  validTrips: TripRequest[];
  errors: string[];
}

export interface ImportSpreadsheetResult {
  fileName: string;
  sheets: ParsedSheetResult[];
  allTrips: TripRequest[];
  totalImported: number;
  totalErrors: number;
}

export class ImportService {
  /**
   * Normaliza o nome do cabeçalho da planilha removendo acentos, preposições (de, da, do...) e pontuação
   */
  private static cleanHeader(header: string): string {
    return (header || '')
      .toString()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .toUpperCase()
      .replace(/\b(DE|DA|DO|DAS|DOS|NO|NA|NOS|NAS|EM|PARA|O|A|OS|AS|NUM|NUMERO|N)\b/g, '') // remove preposições e artigos
      .replace(/[^A-Z0-9]/g, ''); // remove espaços e caracteres especiais
  }

  /**
   * Extrai o mês e o ano com base no nome da aba (ex: "01-2026", "02-2026", "Janeiro", "Fevereiro", "Fev 2026")
   */
  private static extractMonthAndYearFromSheetName(sheetName: string): { monthIndex: number; year: number } {
    const clean = (sheetName || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    // Ano
    const yearMatch = clean.match(/202[0-9]/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : 2026;

    // Mês
    if (clean.includes('jan') || clean.startsWith('01') || clean.startsWith('1-') || clean.startsWith('1_') || clean === '1') return { monthIndex: 0, year };
    if (clean.includes('fev') || clean.includes('feb') || clean.startsWith('02') || clean.startsWith('2-') || clean.startsWith('2_') || clean === '2') return { monthIndex: 1, year };
    if (clean.includes('mar') || clean.startsWith('03') || clean.startsWith('3-') || clean.startsWith('3_') || clean === '3') return { monthIndex: 2, year };
    if (clean.includes('abr') || clean.includes('apr') || clean.startsWith('04') || clean.startsWith('4-') || clean.startsWith('4_') || clean === '4') return { monthIndex: 3, year };
    if (clean.includes('mai') || clean.includes('may') || clean.startsWith('05') || clean.startsWith('5-') || clean.startsWith('5_') || clean === '5') return { monthIndex: 4, year };
    if (clean.includes('jun') || clean.startsWith('06') || clean.startsWith('6-') || clean.startsWith('6_') || clean === '6') return { monthIndex: 5, year };
    if (clean.includes('jul') || clean.startsWith('07') || clean.startsWith('7-') || clean.startsWith('7_') || clean === '7') return { monthIndex: 6, year };
    if (clean.includes('ago') || clean.includes('aug') || clean.startsWith('08') || clean.startsWith('8-') || clean.startsWith('8_') || clean === '8') return { monthIndex: 7, year };
    if (clean.includes('set') || clean.includes('sep') || clean.startsWith('09') || clean.startsWith('9-') || clean.startsWith('9_') || clean === '9') return { monthIndex: 8, year };
    if (clean.includes('out') || clean.includes('oct') || clean.startsWith('10') || clean === '10') return { monthIndex: 9, year };
    if (clean.includes('nov') || clean.startsWith('11') || clean === '11') return { monthIndex: 10, year };
    if (clean.includes('dez') || clean.includes('dec') || clean.startsWith('12') || clean === '12') return { monthIndex: 11, year };

    return { monthIndex: 0, year };
  }

  /**
   * Converte valores de data do Excel (Date, Serial, Dia numérico ou String) estritamente em formato ISO YYYY-MM-DD
   */
  private static parseExcelDate(val: any, fallbackMonthIndex: number = 0, fallbackYear: number = 2026): string {
    const fallbackMonth = Math.min(11, Math.max(0, fallbackMonthIndex));
    const fallbackMonthStr = String(fallbackMonth + 1).padStart(2, '0');
    const defaultDate = `${fallbackYear}-${fallbackMonthStr}-15`;

    if (val === null || val === undefined || val === '') {
      return defaultDate;
    }

    // 1. Se for objeto Date do JavaScript (gerado pelo SheetJS com cellDates: true)
    if (val instanceof Date && isValid(val) && !isNaN(val.getTime())) {
      try {
        const dUTC = val.getUTCDate();
        const mUTC = val.getUTCMonth() + 1;
        const yUTC = val.getUTCFullYear();

        const dLoc = val.getDate();
        const mLoc = val.getMonth() + 1;
        const yLoc = val.getFullYear();

        // Se a hora for 00:00 ou próxima de 00:00, os valores UTC são os dados reais da célula
        const d = (val.getUTCHours() === 0 || val.getHours() >= 20) ? dUTC : dLoc;
        const m = (val.getUTCHours() === 0 || val.getHours() >= 20) ? mUTC : mLoc;
        const y = yUTC > 2000 ? yUTC : (yLoc > 2000 ? yLoc : fallbackYear);

        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      } catch {
        return defaultDate;
      }
    }

    // 2. Se for número do Excel
    if (typeof val === 'number') {
      if (val > 1000) {
        // Serial de data Excel (ex: 46025 = 14/01/2026)
        try {
          const dateObj = XLSX.SSF.parse_date_code(val);
          if (dateObj && dateObj.d && dateObj.m) {
            const y = dateObj.y > 2000 ? dateObj.y : fallbackYear;
            const m = String(Math.min(12, Math.max(1, dateObj.m))).padStart(2, '0');
            const d = String(Math.min(31, Math.max(1, dateObj.d))).padStart(2, '0');
            return `${y}-${m}-${d}`;
          }
        } catch {
          // fallback
        }
      } else if (val >= 1 && val <= 31) {
        // Apenas o número do dia dentro da aba do mês (ex: 14)
        const d = String(Math.floor(val)).padStart(2, '0');
        return `${fallbackYear}-${fallbackMonthStr}-${d}`;
      }
    }

    const str = String(val).trim();

    // 3. Se for string com barras: DD/MM/YYYY ou DD/MM/YY ou DD/MM
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length >= 2) {
        const dNum = parseInt(parts[0].replace(/\D/g, ''), 10);
        const mNum = parseInt(parts[1].replace(/\D/g, ''), 10);
        let yNum = parts[2] ? parseInt(parts[2].replace(/\D/g, ''), 10) : fallbackYear;
        
        if (yNum < 100) yNum = 2000 + yNum;
        if (yNum < 2000) yNum = fallbackYear;

        const d = !isNaN(dNum) && dNum >= 1 && dNum <= 31 ? dNum : 15;
        const m = !isNaN(mNum) && mNum >= 1 && mNum <= 12 ? mNum : fallbackMonth + 1;

        return `${yNum}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    // 4. Se for string com traços: YYYY-MM-DD ou DD-MM-YYYY
    if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          return str.substring(0, 10);
        }
        // DD-MM-YYYY
        const dNum = parseInt(parts[0].replace(/\D/g, ''), 10);
        const mNum = parseInt(parts[1].replace(/\D/g, ''), 10);
        let yNum = parseInt(parts[2].replace(/\D/g, ''), 10);
        if (yNum < 100) yNum = 2000 + yNum;
        if (yNum < 2000) yNum = fallbackYear;

        const d = !isNaN(dNum) && dNum >= 1 && dNum <= 31 ? dNum : 15;
        const m = !isNaN(mNum) && mNum >= 1 && mNum <= 12 ? mNum : fallbackMonth + 1;

        return `${yNum}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    // 5. Se for apenas o dia numérico como string (ex: "14", "Dia 14", "14º")
    const numMatches = str.match(/\d+/g);
    if (numMatches && numMatches.length === 1) {
      const dayVal = parseInt(numMatches[0], 10);
      if (dayVal >= 1 && dayVal <= 31) {
        const d = String(dayVal).padStart(2, '0');
        return `${fallbackYear}-${fallbackMonthStr}-${d}`;
      }
    }

    // 6. Se tiver mais de um número na string
    if (numMatches && numMatches.length >= 2) {
      let d = parseInt(numMatches[0], 10);
      let m = parseInt(numMatches[1], 10);
      let y = numMatches[2] ? parseInt(numMatches[2], 10) : fallbackYear;
      if (y < 100) y = 2000 + y;
      if (y < 2000) y = fallbackYear;

      if (d > 31 || d < 1) d = 15;
      if (m > 12 || m < 1) m = fallbackMonth + 1;

      const maxDays = m === 2 ? 28 : [4, 6, 9, 11].includes(m) ? 30 : 31;
      d = Math.min(d, maxDays);

      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    return defaultDate;
  }

  /**
   * Converte valores de hora do Excel estritamente em formato HH:MM
   */
  private static parseExcelTime(val: any): string {
    if (val === null || val === undefined || val === '') return '08:00';

    if (val instanceof Date && isValid(val) && !isNaN(val.getTime())) {
      try {
        const h = val.getUTCHours();
        const m = val.getUTCMinutes();
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      } catch {
        return '08:00';
      }
    }

    // Se for número no Excel (fração de dia ou serial completo)
    if (typeof val === 'number') {
      if (val >= 0 && val < 1) {
        const totalMinutes = Math.round(val * 24 * 60);
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      } else if (val >= 1) {
        try {
          const dateObj = XLSX.SSF.parse_date_code(val);
          if (dateObj) {
            const h = dateObj.H || 0;
            const m = dateObj.M || 0;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          }
        } catch {}
      }
    }

    const str = String(val).trim();
    const numMatches = str.match(/\d+/g);
    if (numMatches && numMatches.length >= 1) {
      let h = parseInt(numMatches[0], 10);
      let m = numMatches[1] ? parseInt(numMatches[1], 10) : 0;
      if (h > 23) h = 8;
      if (m > 59) m = 0;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    return '08:00';
  }

  /**
   * Normaliza Cidade para ID correspondente
   */
  private static normalizeCityId(cityName: string, cities: City[], isOrigin: boolean = true): string {
    if (!cityName) return isOrigin ? 'city-1' : 'city-3';
    const clean = cityName.trim().toLowerCase();

    const match = cities.find((c) => {
      const cName = c.name.toLowerCase();
      return clean.includes(cName) || cName.includes(clean);
    });

    if (match) return match.id;
    return isOrigin ? 'city-1' : 'city-3';
  }

  /**
   * Normaliza Unidade Macro
   */
  private static normalizeMacroUnit(unitStr: string): MacroUnit {
    if (!unitStr) return 'IDR';
    const clean = unitStr.toUpperCase().trim();

    const validUnits: MacroUnit[] = [
      'ICS', 'IDR', 'PROADI', 'PROPAE', 'ICEN', 'GR', 'PROEX', 'IH', 'PROINTER', 'ICSA', 'SECOM', 'PROPPG', 'DTI'
    ];

    const match = validUnits.find((u) => clean.includes(u));
    return match || 'IDR';
  }

  /**
   * Normaliza Tipo de Atividade
   */
  private static normalizeActivityType(actStr: string): ActivityType {
    if (!actStr) return 'Graduação';
    const clean = actStr.toLowerCase().trim();

    if (clean.includes('pos') || clean.includes('pós') || clean.includes('mestrado')) return 'Pós Graduação';
    if (clean.includes('pesq')) return 'Pesquisa';
    if (clean.includes('exten')) return 'Extensão';
    if (clean.includes('admin') || clean.includes('gestao') || clean.includes('reuni')) return 'Administrativo';
    return 'Graduação';
  }

  /**
   * Normaliza Situação da Demanda de forma estrita respeitando a coluna Situação da planilha
   */
  private static normalizeStatus(statusStr: string): TripStatus {
    const clean = (statusStr || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    if (!clean) {
      return 'Pendente de Análise';
    }

    // 1. Indeferido
    if (
      clean.includes('indef') || 
      clean.includes('recus') || 
      clean.includes('negad') || 
      clean.includes('rejeit') || 
      clean.includes('nao autoriz') ||
      clean.includes('desautoriz') ||
      clean.includes('nao atend')
    ) {
      return 'Indeferido';
    }

    // 2. Cancelado
    if (clean.includes('cancel')) {
      if (clean.includes('execut') || clean.includes('divtrans') || clean.includes('ditran') || clean.includes('unidade')) {
        return 'Cancelado pela Unidade Executante';
      }
      return 'Cancelado pelo Demandante';
    }

    // 3. Alterado a Data da Demanda
    if (clean.includes('alter') || clean.includes('reagend') || clean.includes('adiad') || clean.includes('remarc')) {
      return 'Alterado a Data da Demanda';
    }

    // 4. Confirmado ao Demandante (Apenas se a coluna Situação explicitamente indicar confirmação/atendimento)
    if (
      clean.includes('confirm') || 
      clean.includes('deferid') || 
      clean.includes('aprov') || 
      clean.includes('atendid') || 
      clean.includes('realiz') || 
      clean.includes('concluid') || 
      clean.includes('escalad') || 
      clean.includes('despach') || 
      clean.includes('finaliz') || 
      clean === 'sim' || 
      clean === 'ok'
    ) {
      return 'Confirmado ao Demandante';
    }

    // 5. Pendente de Análise (Padrão para 'Pendente', 'Em Análise', 'Aguardando', ou qualquer outro texto)
    return 'Pendente de Análise';
  }

  /**
   * Processa o arquivo Excel ou CSV enviado e extrai as viagens de todas as abas
   */
  static parseSpreadsheet(data: ArrayBuffer, fileName: string): ImportSpreadsheetResult {
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const cities = DistanceService.getCities();
    const contractors = FleetService.getContractors();
    const vehicles = FleetService.getVehicles();
    const drivers = FleetService.getDrivers();

    const sheetsResult: ParsedSheetResult[] = [];
    const allTrips: TripRequest[] = [];
    let totalErrors = 0;

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (rows.length < 2) return; // Aba vazia ou só com 1 linha

      // Identifica o mês e ano desta aba específica (ex: "01-2026", "02-2026", "Fevereiro"...)
      const { monthIndex: sheetMonthIndex, year: sheetYear } = this.extractMonthAndYearFromSheetName(sheetName);

      // 1. Localização Inteligente da Linha de Cabeçalho por Pontuação de Colunas
      let headerRowIndex = 0;
      let maxScore = -1;

      const headerKeywords = [
        'PROCESSO', 'PROCESS', 'ITEM', 'SOLICITANTE', 'DEMANDANTE', 
        'DESTINO', 'ORIGEM', 'PARTIDA', 'SAIDA', 'DEMANDA', 'RETORNO', 'VOLTA', 
        'PASSAGEIRO', 'PAX', 'KM', 'MOTORISTA', 'VEICULO', 'PLACA', 
        'CONTRATADA', 'SITUACAO', 'STATUS', 'RECEBIMENTO', 'UNIDADE'
      ];

      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row)) continue;

        let score = 0;
        const rowCleanCells = row.map((c) => this.cleanHeader(String(c || '')));

        headerKeywords.forEach((kw) => {
          if (rowCleanCells.some((cell) => cell.includes(kw))) {
            score++;
          }
        });

        if (score > maxScore) {
          maxScore = score;
          headerRowIndex = i;
        }
      }

      if (maxScore < 2) headerRowIndex = 0;

      // 2. Construção dos Cabeçalhos (mesclando com linha anterior se houver cabeçalhos em duas linhas)
      const primaryHeaderRow = rows[headerRowIndex] || [];
      const prevHeaderRow = headerRowIndex > 0 ? (rows[headerRowIndex - 1] || []) : [];

      const rawHeaders: string[] = [];
      const cleanHeaders: string[] = [];

      const maxCols = Math.max(primaryHeaderRow.length, prevHeaderRow.length);
      for (let c = 0; c < maxCols; c++) {
        const cellPrimary = String(primaryHeaderRow[c] || '').trim();
        const cellPrev = String(prevHeaderRow[c] || '').trim();
        
        const combined = (cellPrev && cellPrev !== cellPrimary && !cellPrimary.toUpperCase().includes(cellPrev.toUpperCase()))
          ? `${cellPrev} ${cellPrimary}`
          : cellPrimary;

        rawHeaders.push(combined);
        cleanHeaders.push(this.cleanHeader(combined));
      }

      // 3. Mapeamento Tolerante de Índices de Colunas
      const findCol = (...patterns: string[]) => {
        // 1ª Passagem: Match exato
        for (const p of patterns) {
          const cleanP = this.cleanHeader(p);
          const idx = cleanHeaders.findIndex((h) => h === cleanP);
          if (idx !== -1) return idx;
        }
        // 2ª Passagem: Includes
        for (const p of patterns) {
          const cleanP = this.cleanHeader(p);
          const idx = cleanHeaders.findIndex((h) => h.includes(cleanP));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      // Colunas Básicas Conforme a Planilha Real
      const idxItem = findCol('ITEM', 'N');
      const idxProcess = findCol('PROCESSO', 'PROCESS', 'NUMEROPROCESSO', 'NPROCESSO', 'NDOPROCESSO');
      const idxReceivedAt = findCol('DATARECEBIMENTO', 'DATADORECEBIMENTO', 'DATADERECEBIMENTO', 'RECEBIMENTO', 'DATAENTRADA', 'ENTRADA');
      const idxAdvanceDays = findCol('ANTECEDENCIA', 'DIASANTECEDENCIA', 'DIASDEANTECEDENCIA');
      const idxStatusDeadline = findCol('STATUSSOLICITACAO', 'STATUSDASOLICITACAO', 'STATUSPRAZO', 'STATUSDOPRAZO');
      const idxActivity = findCol('TIPOATIVIDADE', 'TIPODEATIVIDADE', 'ATIVIDADE');
      const idxRequester = findCol('SOLICITANTE', 'NOMESOLICITANTE', 'NOMEDOSOLICITANTE', 'DEMANDANTE');
      const idxMacro = findCol('UNIDADEMACRO', 'MACRO', 'INSTITUTO');
      const idxReqUnit = findCol('UNIDADEREQUISITANTE', 'UNIDADE', 'SETOR');
      
      // Cidades de Origem e Destino
      let idxOrigin = findCol('MUNICIPIOPARTIDA', 'MUNICIPIODEORIGEM', 'MUNICIPIOORIGEM', 'ORIGEM', 'CIDADEORIGEM', 'LOCALPARTIDA');
      if (idxOrigin === -1) {
        idxOrigin = cleanHeaders.findIndex((h) => h === 'PARTIDA' || (h.includes('PARTIDA') && !h.includes('DATA') && !h.includes('HORA') && !h.includes('DT')));
      }

      const idxDest = findCol('DESTINO', 'MUNICIPIODESTINO', 'MUNICIPIODEDESTINO', 'CIDADEDESTINO', 'LOCALDESTINO');
      
      // Retorno (Identificado antes para não confundir com saída)
      const idxRetDate = findCol('DATARETORNO', 'DATADORETORNO', 'DATAVOLTA', 'DATACHEGADA', 'RETORNO', 'VOLTA', 'DTRETORNO');
      const idxRetTime = findCol('HORARETORNO', 'HORARIODORETORNO', 'HORARIORETORNO', 'HORAVOLTA', 'HORARIOVOLTA');
      
      // Horário de Saída
      const idxDepTime = findCol('HORASAIDA', 'HORARIODASAIDA', 'HORARIODESAIDA', 'HORARIOSAIDA', 'HORARIOPARTIDA', 'HORAPARTIDA');

      // 4. DETECÇÃO DA DATA DE SAÍDA (DATA DA DEMANDA NA PLANILHA REAL DA UNILAB)
      let idxDepDate = findCol(
        'DATADEMANDA', 'DATADADEMANDA', 'DATADEDEMANDA',
        'DATASAIDA', 'DATADASAIDA', 'DATADESAIDA',
        'DATAPARTIDA', 'DATADAPARTIDA', 'DATADEPARTIDA', 
        'DATAVIAGEM', 'DATADAVIAGEM', 'DATADEVIAGEM',
        'DATAIDA', 'DATADAIDA', 'DATADEIDA',
        'DATAINICIO', 'DATADEINICIO', 'DATAINICIAL', 'DATAUTILIZACAO',
        'DATAPREVISTA', 'DATADAATIVIDADE', 'DTSAIDA', 'DTPARTIDA', 'DTVIAGEM'
      );

      // Se não achou exato, busca qualquer coluna contendo DATA / DIA que não seja Recebimento nem Retorno
      if (idxDepDate === -1) {
        idxDepDate = cleanHeaders.findIndex((h, idx) => {
          if (idx === idxReceivedAt || idx === idxRetDate || idx === idxRetTime || idx === idxDepTime) return false;
          return (
            (h.includes('DATA') || h.includes('DIA') || h.includes('DT')) &&
            !h.includes('REC') &&
            !h.includes('RET') &&
            !h.includes('VOLTA') &&
            !h.includes('SEMANA') &&
            !h.includes('NASC') &&
            !h.includes('HORA')
          );
        });
      }

      // Se ainda não achou, busca DEMANDA ou SAIDA ou PARTIDA que não seja cidade nem horário
      if (idxDepDate === -1) {
        idxDepDate = cleanHeaders.findIndex((h, idx) => {
          if (idx === idxOrigin || idx === idxReceivedAt || idx === idxRetDate || idx === idxDepTime || idx === idxRetTime) return false;
          return (h.includes('DEMANDA') || h.includes('SAIDA') || h.includes('PARTIDA') || h.includes('VIAGEM')) && !h.includes('HORA') && !h.includes('SITUACAO') && !h.includes('STATUS');
        });
      }

      // 5. AUTO-DETECÇÃO DE DATA POR ANÁLISE DE CONTEÚDO NAS LINHAS (Se os cabeçalhos falharem)
      if (idxDepDate === -1) {
        let bestColIdx = -1;
        let maxDateMatchCount = 0;

        for (let c = 0; c < maxCols; c++) {
          if (c === idxReceivedAt || c === idxRetDate || c === idxDepTime || c === idxRetTime || c === idxOrigin || c === idxDest) {
            continue;
          }

          let dateMatches = 0;
          for (let r = headerRowIndex + 1; r < Math.min(rows.length, headerRowIndex + 15); r++) {
            const cellVal = rows[r] ? rows[r][c] : null;
            if (cellVal instanceof Date) {
              dateMatches++;
            } else if (typeof cellVal === 'number' && ((cellVal > 1000 && cellVal < 60000) || (cellVal >= 1 && cellVal <= 31))) {
              dateMatches++;
            } else if (typeof cellVal === 'string') {
              const strVal = cellVal.trim();
              if (strVal.includes('/') || strVal.includes('-') || /^\d{1,2}$/.test(strVal)) {
                dateMatches++;
              }
            }
          }

          if (dateMatches > maxDateMatchCount) {
            maxDateMatchCount = dateMatches;
            bestColIdx = c;
          }
        }

        if (bestColIdx !== -1 && maxDateMatchCount >= 2) {
          idxDepDate = bestColIdx;
        }
      }

      // Passageiros e KM
      const idxPax = findCol('QUANTPASSAGEIROS', 'QUANTIDADEPASSAGEIROS', 'QUANTIDADEDEPASSAGEIROS', 'PASSAGEIROS', 'PAX', 'LOTACAO', 'QUANTIDADE');
      const idxKm = findCol('KMTOTAL', 'KMPREVISTO', 'KMREAL', 'KM', 'QUILOMETRAGEM', 'DISTANCIA');
      
      // Frota e Alocação
      const idxContractor = findCol('CONTRATADA', 'EMPRESA', 'LOCADORA');
      const idxDriver = findCol('MOTORISTA', 'CONDUTOR', 'NOMEMOTORISTA');
      const idxVehicle = findCol('VEICULO', 'MODELOVEICULO', 'MODELODOVEICULO', 'MODELO');
      const idxPlate = findCol('PLACA', 'PLACAVEICULO', 'PLACADOVEICULO');
      
      // Situação e Observações
      const idxStatus = findCol('SITUACAO', 'SITUACAODEMANDA', 'SITUACAODADEMANDA', 'STATUSDEMANDA', 'ESTADO', 'PARECER');
      const idxNotes = findCol('OBSERVACOES', 'OBSERVACAO', 'OBS', 'JUSTIFICATIVA');
      const idxReportStatus = findCol('SITUACAORELATORIODEVIAGEM', 'SITUACAORELATORIOVIAGEM', 'RELATORIODEVIAGEM', 'RELATORIOVIAGEM', 'RELATORIO');

      const sheetTrips: TripRequest[] = [];
      const sheetErrors: string[] = [];

      for (let r = headerRowIndex + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !Array.isArray(row) || row.every((c) => String(c).trim() === '')) continue;

        try {
          // Extração do número do processo
          let processNum = idxProcess !== -1 ? String(row[idxProcess] || '').trim() : '';
          if (!processNum) {
            const itemNum = idxItem !== -1 ? String(row[idxItem] || '').trim() : `${r}`;
            processNum = `23282.${String(r + sheetMonthIndex * 100).padStart(6, '0')}/${sheetYear}-${(r % 90) + 10}`;
          }

          const requester = idxRequester !== -1 ? String(row[idxRequester] || '').trim() : 'Solicitante Institucional';
          
          // Se for linha de cabeçalho repetida ou totalizador
          if (
            processNum.toUpperCase().includes('PROCESSO') || 
            processNum.toUpperCase().includes('TOTAL') || 
            (!requester && !row[idxDepDate] && !row[idxDest])
          ) {
            continue;
          }

          // Datas de Saída e Retorno ajustadas com o contexto do mês da aba e o conteúdo da célula
          const rawDepDate = idxDepDate !== -1 ? row[idxDepDate] : null;
          const depDateStr = this.parseExcelDate(rawDepDate, sheetMonthIndex, sheetYear);
          
          const rawDepTime = idxDepTime !== -1 ? row[idxDepTime] : null;
          const depTimeStr = this.parseExcelTime(rawDepTime);

          const rawRetDate = idxRetDate !== -1 ? row[idxRetDate] : null;
          const retDateStr = rawRetDate ? this.parseExcelDate(rawRetDate, sheetMonthIndex, sheetYear) : depDateStr;

          const rawRetTime = idxRetTime !== -1 ? row[idxRetTime] : null;
          const retTimeStr = rawRetTime ? this.parseExcelTime(rawRetTime) : '18:00';

          const departureDatetime = `${depDateStr}T${depTimeStr}:00-03:00`;
          const returnDatetime = `${retDateStr}T${retTimeStr}:00-03:00`;

          // Recebimento e Antecedência
          const rawRecDate = idxReceivedAt !== -1 ? row[idxReceivedAt] : null;
          const receivedDateStr = rawRecDate ? this.parseExcelDate(rawRecDate, sheetMonthIndex, sheetYear) : depDateStr;
          const receivedAt = `${receivedDateStr}T09:00:00-03:00`;

          const advanceDays = idxAdvanceDays !== -1 && Number(row[idxAdvanceDays])
            ? Number(row[idxAdvanceDays])
            : 7;

          let statusDeadline: StatusDeadline = advanceDays >= 5 ? 'Dentro do Prazo' : 'Fora do Prazo';
          if (idxStatusDeadline !== -1 && row[idxStatusDeadline]) {
            const cleanDeadline = String(row[idxStatusDeadline]).toLowerCase();
            if (cleanDeadline.includes('fora')) statusDeadline = 'Fora do Prazo';
            else if (cleanDeadline.includes('dentro')) statusDeadline = 'Dentro do Prazo';
          }

          // Itinerário
          const originName = idxOrigin !== -1 ? String(row[idxOrigin] || '') : 'Redenção';
          const destName = idxDest !== -1 ? String(row[idxDest] || '') : 'Fortaleza';
          const originId = this.normalizeCityId(originName, cities, true);
          const destId = this.normalizeCityId(destName, cities, false);

          // KM Total
          let km = idxKm !== -1 && Number(row[idxKm]) ? Number(row[idxKm]) : 0;
          if (km <= 0) {
            km = DistanceService.calculateTotalKm(originId, destId);
          }

          // Passageiros
          const pax = idxPax !== -1 && Number(row[idxPax]) ? Number(row[idxPax]) : 1;

          // Unidade e Atividade
          const macroUnit = idxMacro !== -1 ? this.normalizeMacroUnit(String(row[idxMacro] || '')) : 'IDR';
          const requestingUnit = idxReqUnit !== -1 ? String(row[idxReqUnit] || '').trim() : `${macroUnit} Acadêmico`;
          const activityType = idxActivity !== -1 ? this.normalizeActivityType(String(row[idxActivity] || '')) : 'Graduação';

          // Verificação de Alocação de Recursos (Contratada, Motorista, Veículo)
          const contName = idxContractor !== -1 ? String(row[idxContractor] || '').trim() : '';
          const driverName = idxDriver !== -1 ? String(row[idxDriver] || '').trim() : '';
          const plateStr = idxPlate !== -1 ? String(row[idxPlate] || '').trim().toUpperCase() : '';
          const vehModel = idxVehicle !== -1 ? String(row[idxVehicle] || '').trim() : '';

          // Situação da Demanda (respeitando estritamente a coluna da planilha)
          const rawStatusStr = idxStatus !== -1 ? String(row[idxStatus] || '') : '';
          const status = this.normalizeStatus(rawStatusStr);

          // Resolução de IDs de Frota
          let allocatedContractorId: string | undefined = undefined;
          let allocatedDriverId: string | undefined = undefined;
          let allocatedVehicleId: string | undefined = undefined;

          if (status === 'Confirmado ao Demandante') {
            // Contratada
            if (contName) {
              const cMatch = contractors.find((c) => c.name.toLowerCase().includes(contName.toLowerCase()) || contName.toLowerCase().includes(c.name.toLowerCase()));
              allocatedContractorId = cMatch ? cMatch.id : contractors[0]?.id;
            } else {
              allocatedContractorId = contractors[0]?.id;
            }

            // Motorista
            if (driverName) {
              const dMatch = drivers.find((d) => d.name.toLowerCase().includes(driverName.toLowerCase()) || driverName.toLowerCase().includes(d.name.toLowerCase()));
              allocatedDriverId = dMatch ? dMatch.id : drivers[0]?.id;
            } else {
              allocatedDriverId = drivers[0]?.id;
            }

            // Veículo
            if (plateStr) {
              const vMatch = vehicles.find((v) => v.plate.toUpperCase().includes(plateStr) || plateStr.includes(v.plate.toUpperCase()));
              allocatedVehicleId = vMatch ? vMatch.id : vehicles[0]?.id;
            } else if (vehModel) {
              const vMatch = vehicles.find((v) => v.model.toLowerCase().includes(vehModel.toLowerCase()) || vehModel.toLowerCase().includes(v.model.toLowerCase()));
              allocatedVehicleId = vMatch ? vMatch.id : vehicles[0]?.id;
            } else {
              allocatedVehicleId = pax > 15 ? 'veh-5' : pax > 8 ? 'veh-3' : 'veh-2';
            }
          }

          // Observações
          const notes = idxNotes !== -1 ? String(row[idxNotes] || '').trim() : '';

          // Relatório Pós-Viagem
          let reportStatus: TravelReportStatus = 'Não Aplicável';
          if (status === 'Confirmado ao Demandante') {
            const repStr = idxReportStatus !== -1 ? String(row[idxReportStatus] || '').toLowerCase() : '';
            if (repStr.includes('finaliz') || repStr.includes('concluid') || repStr.includes('ok') || repStr.includes('aprov')) {
              reportStatus = 'Finalizado no Sistema';
            } else {
              reportStatus = 'Aguardando Envio da Contratada';
            }
          }

          const newTrip: TripRequest = {
            id: `trip-import-${sheetName}-${r}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            process_number: processNum,
            received_at: receivedAt,
            advance_days: advanceDays,
            status_deadline: statusDeadline,
            activity_type: activityType,
            requester_name: requester || 'Solicitante Institucional',
            requester_email: `${requester.toLowerCase().replace(/[^a-z]/g, '.')}@unilab.edu.br`,
            macro_unit: macroUnit,
            requesting_unit: requestingUnit,
            origin_city_id: originId,
            destination_city_id: destId,
            departure_datetime: departureDatetime,
            return_datetime: returnDatetime,
            passenger_count: pax,
            estimated_km: km,
            real_km: status === 'Confirmado ao Demandante' ? km : undefined,
            status: status,
            allocated_contractor_id: allocatedContractorId,
            allocated_driver_id: allocatedDriverId,
            allocated_vehicle_id: allocatedVehicleId,
            travel_report_status: reportStatus,
            notes: notes || undefined,
            created_at: receivedAt,
            updated_at: new Date().toISOString(),
          };

          sheetTrips.push(newTrip);
          allTrips.push(newTrip);
        } catch (err: any) {
          totalErrors++;
          sheetErrors.push(`Linha ${r + 1}: ${err?.message || 'Erro ao processar linha'}`);
        }
      }

      sheetTrips.sort((a, b) => {
        const timeA = new Date(a.departure_datetime).getTime() || 0;
        const timeB = new Date(b.departure_datetime).getTime() || 0;
        if (timeA !== timeB) return timeA - timeB;
        return a.process_number.localeCompare(b.process_number);
      });

      sheetsResult.push({
        sheetName,
        totalRows: rows.length - (headerRowIndex + 1),
        validTrips: sheetTrips,
        errors: sheetErrors,
      });
    });

    // Ordenação global de todas as viagens pela data da demanda
    allTrips.sort((a, b) => {
      const timeA = new Date(a.departure_datetime).getTime() || 0;
      const timeB = new Date(b.departure_datetime).getTime() || 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.process_number.localeCompare(b.process_number);
    });

    return {
      fileName,
      sheets: sheetsResult,
      allTrips,
      totalImported: allTrips.length,
      totalErrors,
    };
  }

  /**
   * Gera e faz o download de um modelo padrão de planilha Excel (.xlsx) com as 26 colunas oficiais
   */
  static downloadTemplateExcel(): void {
    const wb = XLSX.utils.book_new();

    const headers = [
      'ITEM',
      'PROCESSO',
      'DATA DO RECEBIMENTO',
      'DIAS DE ANTECEDÊNCIA',
      'DIA DA SEMANA',
      'STATUS DA SOLICITAÇÃO',
      'TIPO DE ATIVIDADE',
      'SOLICITANTE',
      'UNIDADE MACRO',
      'UNIDADE REQUISITANTE',
      'PARTIDA',
      'DESTINO',
      'DATA DA DEMANDA',
      'HORÁRIO DE SAÍDA',
      'DATA DO RETORNO',
      'HORÁRIO DO RETORNO',
      'QUANT. DE PASSAGEIROS',
      'KM TOTAL',
      'CONTRATADA',
      'MOTORISTA',
      'CATEGORIA',
      'TIPO DO VEÍCULO',
      'VEÍCULO',
      'PLACA',
      'SITUAÇÃO',
      'OBSERVAÇÃO',
      'SITUAÇÃO RELATÓRIO DE VIAGEM'
    ];

    const sampleRows = [
      [
        1,
        '23282.000418/2026-41',
        '05/01/2026',
        9,
        'Quarta-feira',
        'Dentro do Prazo',
        'Graduação',
        'Mayra Garcia Maia Costa',
        'ICEN',
        'Coordenação de Química',
        'Redenção',
        'Fortaleza',
        '14/01/2026',
        '07:30',
        '14/01/2026',
        '17:00',
        12,
        130,
        'Crateús Locadora de Veículos',
        'Francisco de Assis Silva',
        'Motoristas de 10-21',
        'Van',
        'Mercedes-Benz Sprinter 416',
        'SBM-1A11',
        'Confirmado ao Demandante',
        'Visita técnica aos laboratórios do Nutec',
        'Finalizado no Sistema'
      ]
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    XLSX.utils.book_append_sheet(wb, ws, '01-2026');

    XLSX.writeFile(wb, 'Modelo_SIG_FROTA_2026.xlsx');
  }
}
