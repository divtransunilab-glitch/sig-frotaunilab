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
  raw_text?: string;
}

export class PdfParserService {
  /**
   * Extrai todo o texto contido no arquivo PDF (todas as páginas)
   */
  static async extractTextFromPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;

    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      fullText += `\n--- PÁGINA ${pageNum} ---\n` + pageText;
    }

    return fullText;
  }

  /**
   * Analisa e extrai os campos estruturados de um processo / solicitação UNILAB
   */
  static parseTripPdfText(rawText: string): ExtractedTripData {
    const result: ExtractedTripData = { raw_text: rawText };
    const cleanText = rawText.replace(/\s+/g, ' ');

    // 1. Número do Processo SEI (ex: 23282.001234/2026-12 ou similar)
    const seiMatch =
      cleanText.match(/23282\.\d{5,6}\/\d{4}-\d{2}/) ||
      cleanText.match(/\b\d{5}\.\d{5,6}\/\d{4}-\d{2}\b/) ||
      cleanText.match(/(?:processo|sei|nº)[\s:.\-\/]*(\d{5}\.\d{5,6}\/\d{4}-\d{2})/i);
    if (seiMatch) {
      result.process_number = seiMatch[0].trim();
    }

    // 2. E-mail do solicitante
    const emailMatch = cleanText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      result.requester_email = emailMatch[0].trim().toLowerCase();
    }

    // 3. Nome do solicitante / Interessado
    const requesterMatch =
      cleanText.match(/(?:solicitante|interessad[oa]|requisitante|servidor responsável)[\s:.\-]+([A-ZÀ-Úa-zà-ú\s]{5,50})(?=[,\.;\n\r]|e-mail|email|cargo|siape|unidade)/i) ||
      cleanText.match(/(?:nome(?:\s+do\s+solicitante)?)[\s:.\-]+([A-ZÀ-Úa-zà-ú\s]{5,50})(?=[,\.;\n\r]|e-mail|email|cargo|siape)/i);
    if (requesterMatch && requesterMatch[1]) {
      const name = requesterMatch[1].trim();
      if (name.length > 3 && !/processo|unilab|instituto|universidade/i.test(name)) {
        result.requester_name = name;
      }
    }

    // 4. Unidade Macro da UNILAB
    const macroUnits: MacroUnit[] = [
      'ICS',
      'IDR',
      'PROADI',
      'PROPAE',
      'ICEN',
      'GR',
      'PROEX',
      'IH',
      'PROINTER',
      'ICSA',
      'SECOM',
      'PROPPG',
      'DTI'
    ];
    for (const unit of macroUnits) {
      const reg = new RegExp(`\\b${unit}\\b`, 'i');
      if (reg.test(cleanText)) {
        result.macro_unit = unit;
        break;
      }
    }

    // Se mencionar Reitoria, mapeia para GR
    if (!result.macro_unit && /\breitoria\b/i.test(cleanText)) {
      result.macro_unit = 'GR';
    }
    // Se mencionar IHM (Humanidades), mapeia para IH
    if (!result.macro_unit && /\b(ihm|instituto de humanidades)\b/i.test(cleanText)) {
      result.macro_unit = 'IH';
    }

    // 5. Unidade Requisitante / Setor
    const unitMatch =
      cleanText.match(/(?:unidade\s+requisitante|setor|coordena[çc][ãa]o|instituto|diretoria)[\s:.\-]+([A-ZÀ-Úa-zà-ú0-9\s\/-]{3,50})(?=[,\.;\n\r]|solicitante|respons[aá]vel|origem|destino)/i);
    if (unitMatch && unitMatch[1]) {
      result.requesting_unit = unitMatch[1].trim();
    } else if (result.macro_unit) {
      result.requesting_unit = result.macro_unit;
    }

    // 6. Cidades de Origem e Destino
    const allCities = DistanceService.getCities();

    let detectedOriginCityId: string | undefined;
    let detectedDestCityId: string | undefined;

    // Procura por origem explícita
    const originMatch = cleanText.match(/(?:origem|partida|sa[íi]da|endereço\s+de\s+origem)[\s:.\-]+([A-ZÀ-Úa-zà-ú\s]{3,40})(?=[,\.;\n\r]|destino|data|hor[aá]rio)/i);
    if (originMatch) {
      const originStr = originMatch[1].toLowerCase();
      const city = allCities.find((c) => originStr.includes(c.name.toLowerCase()));
      if (city) detectedOriginCityId = city.id;
    }

    // Procura por destino explícito
    const destMatch = cleanText.match(/(?:destino|desembarque|local\s+de\s+destino|cidade\s+de\s+destino)[\s:.\-]+([A-ZÀ-Úa-zà-ú\s]{3,40})(?=[,\.;\n\r]|data|hor[aá]rio|itiner[aá]rio|retorno)/i);
    if (destMatch) {
      const destStr = destMatch[1].toLowerCase();
      const city = allCities.find((c) => destStr.includes(c.name.toLowerCase()));
      if (city) detectedDestCityId = city.id;
    }

    // Fallback inteligente para cidades mencionadas no texto
    if (!detectedOriginCityId || !detectedDestCityId) {
      if (/liberdade|auroras|palmares|reden[çc][ãa]o/i.test(cleanText)) {
        if (!detectedOriginCityId) {
          const redencao = allCities.find((c) => c.name.toLowerCase() === 'redenção');
          if (redencao) detectedOriginCityId = redencao.id;
        }
      }

      for (const c of allCities) {
        if (detectedOriginCityId && c.id === detectedOriginCityId) continue;
        const reg = new RegExp(`\\b${c.name}\\b`, 'i');
        if (reg.test(cleanText)) {
          if (!detectedDestCityId) {
            detectedDestCityId = c.id;
          }
        }
      }
    }

    if (detectedOriginCityId) result.origin_city_id = detectedOriginCityId;
    if (detectedDestCityId) result.destination_city_id = detectedDestCityId;

    // 7. Datas e Horários (Saída e Retorno)
    const dateMatches = [...cleanText.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
    if (dateMatches.length >= 1) {
      const [, d1, m1, y1] = dateMatches[0];
      result.departure_date = `${y1}-${m1.padStart(2, '0')}-${d1.padStart(2, '0')}`;
      if (dateMatches.length >= 2) {
        const [, d2, m2, y2] = dateMatches[1];
        result.return_date = `${y2}-${m2.padStart(2, '0')}-${d2.padStart(2, '0')}`;
      } else {
        result.return_date = result.departure_date;
      }
    }

    // Horários no padrão HH:MM ou HHhMM ou HHh
    const timeMatches = [...cleanText.matchAll(/\b([01]?\d|2[0-3])[:hH]([0-5]\d)?\b/g)];
    if (timeMatches.length >= 1) {
      const h1 = timeMatches[0][1].padStart(2, '0');
      const min1 = (timeMatches[0][2] || '00').padStart(2, '0');
      result.departure_time = `${h1}:${min1}`;
      if (timeMatches.length >= 2) {
        const h2 = timeMatches[1][1].padStart(2, '0');
        const min2 = (timeMatches[1][2] || '00').padStart(2, '0');
        result.return_time = `${h2}:${min2}`;
      }
    }

    // 8. Quantidade de passageiros
    const passCountMatch =
      cleanText.match(/(?:passageiros?|n[ºo]\s*(?:de)?\s*passageiros?|qtd\.?\s*passageiros?|quantidade\s*(?:de)?\s*passageiros?)[\s:.\-]+(\d{1,3})/i) ||
      cleanText.match(/(\d{1,3})\s*(?:passageiros?|pessoas|alunos|estudantes|servidores)/i);
    if (passCountMatch && passCountMatch[1]) {
      const parsed = parseInt(passCountMatch[1], 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 60) {
        result.passenger_count = parsed;
      }
    }

    // 9. Nomes dos passageiros
    const passNamesMatch = cleanText.match(/(?:lista(?:\s*de\s*passageiros)?|passageiros\s*previstos|nomes?|viajantes)[\s:.\-]+([A-ZÀ-Úa-zà-ú0-9\s,;\.\(\)\/-]{10,250})(?=[,\.;\n\r]|objetivo|itiner[aá]rio|ve[íi]culo|motorista|$)/i);
    if (passNamesMatch && passNamesMatch[1]) {
      result.passenger_names = passNamesMatch[1].trim();
    }

    // 10. Objetivo da viagem
    const objMatch = cleanText.match(/(?:objetivo|finalidade|motivo|justificativa|descri[çc][ãa]o\s+da\s+viagem)[\s:.\-]+([^\.;\n\r]{10,180})/i);
    if (objMatch && objMatch[1]) {
      result.trip_objective = objMatch[1].trim();
    }

    // 11. Tipo de Atividade
    if (/p[oó]s[-\s]gradua[çc][ãa]o|mestrado|doutorado|especializa[çc][ãa]o/i.test(cleanText)) {
      result.activity_type = 'Pós Graduação';
    } else if (/gradua[çc][ãa]o|curso|aula\s+de\s+campo|disciplina|estudantes/i.test(cleanText)) {
      result.activity_type = 'Graduação';
    } else if (/pesquisa|coleta|laborat[oó]rio|amostra/i.test(cleanText)) {
      result.activity_type = 'Pesquisa';
    } else if (/extens[ãa]o|comunidade|projeto\s+social/i.test(cleanText)) {
      result.activity_type = 'Extensão';
    } else if (/administrativ[oa]|reuni[ãa]o|gabinete|visita\s+t[eé]cnica|banco|compras/i.test(cleanText)) {
      result.activity_type = 'Administrativo';
    }

    return result;
  }
}
