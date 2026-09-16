import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { DistanceService } from './distanceService';
import { ActivityType, MacroUnit } from '../types';

if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      pdfjsWorker ||
      `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  } catch (err) {
    console.warn('PDF.js worker initialization:', err);
  }
}

export interface ExtractedTripData {
  process_number?: string;
  requester_name?: string;
  requester_email?: string;
  requester_phone?: string;
  macro_unit?: MacroUnit;
  requesting_unit?: string;
  origin_city_id?: string;
  origin_address?: string;
  destination_city_id?: string;
  destination_address?: string;
  departure_date?: string; // YYYY-MM-DD
  departure_time?: string; // HH:mm
  return_date?: string; // YYYY-MM-DD
  return_time?: string; // HH:mm
  passenger_count?: number;
  passenger_names?: string;
  trip_objective?: string;
  activity_type?: ActivityType;
  intermediate_cities?: string[];
  responsible_names?: string;
  raw_text?: string;
}

export class PdfParserService {
  /**
   * Extrai todo o texto contido no arquivo PDF preservando quebras de linha entre linhas e células de tabelas
   */
  static async extractTextFromPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;

    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      let pageText = '';
      let lastY: number | null = null;

      for (const item of textContent.items as any[]) {
        if (!('str' in item)) continue;
        const currentY = item.transform ? Math.round(item.transform[5]) : null;
        if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 5) {
          pageText += '\n';
        } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
          pageText += ' ';
        }
        pageText += item.str;
        if (item.hasEOL) {
          pageText += '\n';
        }
        lastY = currentY;
      }

      fullText += `\n--- PÁGINA ${pageNum} ---\n` + pageText;
    }

    return fullText;
  }

  /**
   * Analisa e extrai os campos estruturados do FORMULÁRIO - VEÍCULO OFICIAL (SEI UNILAB)
   */
  static parseTripPdfText(rawText: string): ExtractedTripData {
    const result: ExtractedTripData = { raw_text: rawText };

    // 1. Processo SEI (ex: 23282.013254/2026-11)
    const seiMatch =
      rawText.match(/\b(23282\.\d{5,6}\/\d{4}-\d{2})\b/) ||
      rawText.match(/\b(\d{5}\.\d{5,6}\/\d{4}-\d{2})\b/);
    if (seiMatch) {
      result.process_number = seiMatch[1].trim();
    }

    // 2. Solicitante (Nome Completo)
    const solSection = rawText.match(/Nome do Solicitante[\s\S]*?(?=Unidade Requisitante|1\. DADOS|$)/i);
    if (solSection) {
      const lines = solSection[0]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/Nome do Solicitante|SIAPE|1\.\s*DADOS/i.test(l));
      for (const line of lines) {
        const clean = line.replace(/\b\d{5,8}\b.*$/, '').trim();
        if (clean.length >= 4 && !/^\d+$/.test(clean) && !/solicitante|unilab|instituto/i.test(clean)) {
          result.requester_name = clean;
          break;
        }
      }
    }
    if (!result.requester_name) {
      const altSol = rawText.match(/(?:Nome do Solicitante)[\s:.\n\r]+(?:SIAPE[\s:.\n\r]+)?([A-ZÀ-Úa-zà-ú\s]{4,60}?)(?:\s+\d{6,8}|\s+Unidade)/i);
      if (altSol) result.requester_name = altSol[1].trim();
    }

    // 3. E-mail e Telefone do Solicitante
    const emailMatch = rawText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      result.requester_email = emailMatch[1].trim().toLowerCase();
    }

    const phoneMatch =
      rawText.match(/Telefone\s*(?:\(c\/\s*DDD\))?[\s\S]*?(\d{2}\s*9?\d{4}[-\s]?\d{4})/i) ||
      rawText.match(/\b(85\s*9\d{8}|85\s*\d{8})\b/);
    if (phoneMatch) {
      result.requester_phone = phoneMatch[1].trim();
    }

    // 4. Unidade Requisitante e Macro Unit (ICS, IDR, etc.)
    const siglaMatch =
      rawText.match(/SIGLA[\s\S]*?\b(ICS|IDR|IH|ICEN|PROADI|PROPAE|GR|PROEX|PROINTER|ICSA|SECOM|PROPPG|DTI)\b/i) ||
      rawText.match(/\b(ICS|IDR|IH|ICEN|PROADI|PROPAE|GR|PROEX|PROINTER|ICSA|SECOM|PROPPG|DTI)\b/);
    if (siglaMatch) {
      result.macro_unit = siglaMatch[1].toUpperCase() as MacroUnit;
    }

    const reqSection = rawText.match(/Unidade Requisitante[\s\S]*?(?=SIGLA|E-mail|$)/i);
    if (reqSection) {
      const lines = reqSection[0]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/Unidade Requisitante|SIGLA/i.test(l));
      if (lines.length > 0) {
        result.requesting_unit = lines[0]
          .replace(/\b(ICS|IDR|IH|ICEN|PROADI|PROPAE|GR|PROEX|PROINTER|ICSA|SECOM|PROPPG|DTI)\b/g, '')
          .trim();
      }
    }
    if (!result.requesting_unit && result.macro_unit) {
      result.requesting_unit = result.macro_unit;
    }

    // 5. Natureza da Atividade (Marcação com "X")
    const natSection = rawText.match(/Natureza da Atividade[\s\S]*?(?=Objetivo\/Justificativa|$)/i);
    const natText = natSection ? natSection[0] : rawText;

    if (
      /(?:Gradua[çc][ãa]o)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:Gradua[çc][ãa]o)/i.test(natText) &&
      !/P[oó]s[-\s]Gradua[çc][ãa]o[^\n\r]*?[\[\(]?\s*X/i.test(natText)
    ) {
      result.activity_type = 'Graduação';
    } else if (
      /(?:P[oó]s[-\s]Gradua[çc][ãa]o)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:P[oó]s[-\s]Gradua[çc][ãa]o)/i.test(natText)
    ) {
      result.activity_type = 'Pós Graduação';
    } else if (
      /(?:Pesquisa)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:Pesquisa)/i.test(natText)
    ) {
      result.activity_type = 'Pesquisa';
    } else if (
      /(?:Extens[ãa]o)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:Extens[ãa]o)/i.test(natText)
    ) {
      result.activity_type = 'Extensão';
    } else if (
      /(?:Administrativ[oa]|Transporte de Bens)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:Administrativ[oa]|Transporte de Bens)/i.test(natText)
    ) {
      result.activity_type = 'Administrativo';
    } else {
      if (/disciplina|curso de|aula de campo|gradua[çc][ãa]o/i.test(rawText)) result.activity_type = 'Graduação';
      else if (/p[oó]s[-\s]gradua[çc][ãa]o|mestrado/i.test(rawText)) result.activity_type = 'Pós Graduação';
      else if (/pesquisa/i.test(rawText)) result.activity_type = 'Pesquisa';
      else if (/extens[ãa]o/i.test(rawText)) result.activity_type = 'Extensão';
      else result.activity_type = 'Administrativo';
    }

    // 6. Objetivo / Justificativa da Viagem
    const objSection = rawText.match(/Objetivo(?:\/Justificativa)?(?:\s+da\s+Viagem)?[\s\S]*?(?=Justificativa\s+p\/|Em\s+caso\s+de\s+solicitações|Endereço\s+de\s+Partida|$)/i);
    if (objSection) {
      const lines = objSection[0]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/Objetivo(?:\/Justificativa)?/i.test(l));
      if (lines.length > 0) {
        result.trip_objective = lines.join(' ').replace(/\s+/g, ' ').trim();
      }
    }

    // 7. Endereço de Partida e Origem
    const origSection = rawText.match(/Endereço\s+de\s+Partida(?:\s*\([^\)]*\))?[\s\S]*?(?=Endereço\s+de\s+Destino|Data\s+de\s+Partida|$)/i);
    if (origSection) {
      const lines = origSection[0]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/Endereço\s+de\s+Partida/i.test(l));
      if (lines.length > 0) {
        result.origin_address = lines.join(' ').replace(/\s+/g, ' ').trim();
      }
    }

    const origCheck = (result.origin_address || rawText).toLowerCase();
    if (/liberdade|auroras|reden[çc][ãa]o/.test(origCheck)) {
      result.origin_city_id = 'city-71'; // Redenção
    } else if (/palmares|acarape/.test(origCheck)) {
      result.origin_city_id = 'city-1'; // Acarape
    } else if (/fortaleza/.test(origCheck)) {
      result.origin_city_id = 'city-27'; // Fortaleza
    } else {
      result.origin_city_id = 'city-71'; // Padrão UNILAB: Redenção
    }

    // 8. Endereço de Destino e Cidade de Destino
    const destSection = rawText.match(/Endereço\s+de\s+Destino(?:\s*\([^\)]*\))?[\s\S]*?(?=Data\s+de\s+Partida|Necessidade\s+de\s+Paradas|Horário|$)/i);
    if (destSection) {
      const lines = destSection[0]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/Endereço\s+de\s+Destino/i.test(l));
      if (lines.length > 0) {
        result.destination_address = lines.join(' ').replace(/\s+/g, ' ').trim();
      }
    }

    const destCheck = (result.destination_address || '').toLowerCase();
    if (/fortaleza|messejana|maracana[uú]|caucaia|aldeota/.test(destCheck)) {
      result.destination_city_id = 'city-27'; // Fortaleza
    } else if (/guaramiranga/.test(destCheck)) {
      result.destination_city_id = 'city-30';
    } else if (/baturit[eé]/.test(destCheck)) {
      result.destination_city_id = 'city-11';
    } else if (/quixad[aá]/.test(destCheck)) {
      result.destination_city_id = 'city-69';
    } else if (/quixeramobim/.test(destCheck)) {
      result.destination_city_id = 'city-70';
    } else if (/acarape/.test(destCheck)) {
      result.destination_city_id = 'city-1';
    } else if (/pacatuba/.test(destCheck)) {
      result.destination_city_id = 'city-58';
    } else if (/pacoti/.test(destCheck)) {
      result.destination_city_id = 'city-59';
    } else if (/sobral/.test(destCheck)) {
      result.destination_city_id = 'city-78';
    } else if (/juazeiro/.test(destCheck)) {
      result.destination_city_id = 'city-42';
    }

    // 9. Datas, Horários e Quantidade de Passageiros
    // Identifica linhas estruturadas de tabela: Data de Partida / Retorno | Horário | Nº Passageiros
    const combinedRows = [...rawText.matchAll(/(\d{2}\/\d{2}\/\d{4})\s+([01]?\d|2[0-3])[:hH]([0-5]\d)\s+(\d{1,3})/g)];
    if (combinedRows.length >= 1) {
      const [, d1, h1, min1, count1] = combinedRows[0];
      const [day, month, year] = d1.split('/');
      result.departure_date = `${year}-${month}-${day}`;
      result.departure_time = `${h1.padStart(2, '0')}:${min1}`;
      result.passenger_count = parseInt(count1, 10);

      if (combinedRows.length >= 2) {
        const [, d2, h2, min2] = combinedRows[1];
        const [rDay, rMonth, rYear] = d2.split('/');
        result.return_date = `${rYear}-${rMonth}-${rDay}`;
        result.return_time = `${h2.padStart(2, '0')}:${min2}`;
      }
    }

    // Fallbacks para datas e horários se não encontrados em formato tabular contíguo
    if (!result.departure_date) {
      const dates = [...rawText.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
      if (dates.length >= 1) {
        const [, d, m, y] = dates[0];
        result.departure_date = `${y}-${m}-${d}`;
        if (dates.length >= 2) {
          const [, rd, rm, ry] = dates[1];
          result.return_date = `${ry}-${rm}-${rd}`;
        } else {
          result.return_date = result.departure_date;
        }
      }
    }

    if (!result.departure_time) {
      const times = [...rawText.matchAll(/\b([01]?\d|2[0-3])[:hH]([0-5]\d)\b/g)];
      if (times.length >= 1) {
        result.departure_time = `${times[0][1].padStart(2, '0')}:${times[0][2]}`;
        if (times.length >= 2) {
          result.return_time = `${times[1][1].padStart(2, '0')}:${times[1][2]}`;
        }
      }
    }

    if (!result.passenger_count) {
      const passM = rawText.match(/(?:Nº de Passageiros[^\d\n\r]*)(\d{1,3})/i);
      if (passM) {
        result.passenger_count = parseInt(passM[1], 10);
      }
    }

    // 10. Necessidade de Paradas no Percurso (Cidades Secundárias)
    const paradasSection = rawText.match(/Necessidade\s+de\s+Paradas[\s\S]*?(?=3\.\s*RESPONSÁVEL|4\.\s*RELAÇÃO|$)/i);
    if (paradasSection) {
      const pText = paradasSection[0].toLowerCase();
      const intermediates: string[] = [];
      if (/acarape/.test(pText) && result.origin_city_id !== 'city-1' && result.destination_city_id !== 'city-1') {
        intermediates.push('city-1'); // Acarape
      }
      if (/pacatuba/.test(pText) && result.origin_city_id !== 'city-58' && result.destination_city_id !== 'city-58') {
        intermediates.push('city-58'); // Pacatuba
      }
      if (/guaramiranga/.test(pText) && result.origin_city_id !== 'city-30' && result.destination_city_id !== 'city-30') {
        intermediates.push('city-30');
      }
      if (/pacoti/.test(pText) && result.origin_city_id !== 'city-59' && result.destination_city_id !== 'city-59') {
        intermediates.push('city-59');
      }
      if (/baturit[eé]/.test(pText) && result.origin_city_id !== 'city-11' && result.destination_city_id !== 'city-11') {
        intermediates.push('city-11');
      }
      if (intermediates.length > 0) {
        result.intermediate_cities = intermediates;
      }
    }

    // 11. Relação de Passageiros (Nomes e Contagem)
    const relacaoPassageiros = rawText.match(/4\.\s*RELAÇÃO\s+DE\s+PASSAGEIROS[\s\S]*$/i);
    if (relacaoPassageiros) {
      const lines = relacaoPassageiros[0].split('\n').map((l) => l.trim());
      const names: string[] = [];
      for (const line of lines) {
        const match = line.match(/^(\d{1,2})\s+([A-ZÀ-Ú\s]{5,50}?)(?:\s+\d{6,12}|\s*\+?\d{2,3}|$)/);
        if (match && !/Passageiro|Comunidade|Nome/i.test(match[2])) {
          const pNum = match[1];
          const pName = match[2].trim();
          names.push(`${pNum}. ${pName}`);
        }
      }
      if (names.length > 0) {
        result.passenger_names = names.join('; ');
        if (!result.passenger_count) {
          result.passenger_count = names.length;
        }
      }
    }

    // 12. Responsável pelos Passageiros (Seção 3)
    const respSection = rawText.match(/3\.\s*RESPONSÁVEL\s+PELOS\s+PASSAGEIROS[\s\S]*?(?=4\.\s*RELAÇÃO|$)/i);
    if (respSection) {
      const lines = respSection[0]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/3\.\s*RESPONSÁVEL|Nome do Responsável|SIAPE|Telefone/i.test(l));
      const respList: string[] = [];
      for (const line of lines) {
        const m = line.match(/^([A-ZÀ-Ú\s]{5,50}?)(?:\s+(\d{6,8}))?(?:\s+([0-9\s\(\)\-\+]{8,18}))?$/);
        if (m && m[1] && !/Observações/i.test(m[1])) {
          const name = m[1].trim();
          const siape = m[2] ? ` (SIAPE ${m[2]})` : '';
          const tel = m[3] ? ` - Tel: ${m[3].trim()}` : '';
          respList.push(`${name}${siape}${tel}`);
        }
      }
      if (respList.length > 0) {
        result.responsible_names = respList.join('; ');
      }
    }

    return result;
  }
}
