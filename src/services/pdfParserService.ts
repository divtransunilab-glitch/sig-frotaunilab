import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { DistanceService } from './distanceService';
import { ActivityType, MacroUnit, City } from '../types';

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

// Normaliza strings removendo acentos e caracteres especiais para comparação flexível
function normalizeText(str?: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Localiza a cidade correspondente na base oficial de cidades da UNILAB
 */
function matchCityInText(text: string, cities: City[], excludeCityId?: string): string | undefined {
  if (!text) return undefined;
  const normText = normalizeText(text);

  // Aliases de bairros / locais comuns de Fortaleza
  if (
    /messejana|aldeota|papicu|parangaba|mucuripe|centro|benfica|aeroporto|pinto martins|edson queiroz|antonio bezerra|maraponga|itaperi|montese|meireles|hospita[l]?\s+de\s+saude\s+mental|hsm\b/i.test(
      normText
    )
  ) {
    const fort = cities.find((c) => normalizeText(c.name) === 'fortaleza');
    if (fort) return fort.id;
  }

  // Aliases de Campi da UNILAB
  if (/campus da liberdade|auroras|liberdade\b/i.test(normText)) {
    const red = cities.find((c) => normalizeText(c.name) === 'redencao');
    if (red) return red.id;
  }
  if (/campus palmares|palmares\b/i.test(normText)) {
    const aca = cities.find((c) => normalizeText(c.name) === 'acarape');
    if (aca) return aca.id;
  }
  if (/campus dos males|males\b/i.test(normText)) {
    const sfc = cities.find((c) => normalizeText(c.name).includes('francisco do conde'));
    if (sfc) return sfc.id;
  }

  // Busca na lista completa das 82 cidades cadastradas (priorizando nomes maiores para evitar falso positivo)
  const sortedCities = [...cities].sort((a, b) => b.name.length - a.name.length);

  for (const city of sortedCities) {
    if (excludeCityId && city.id === excludeCityId) continue;
    const normCity = normalizeText(city.name);
    if (normCity.length < 3) continue;

    const regex = new RegExp(`\\b${normCity}\\b`, 'i');
    if (regex.test(normText)) {
      return city.id;
    }
  }

  return undefined;
}

export class PdfParserService {
  /**
   * Extrai todo o texto contido no arquivo PDF preservando quebras de linha estruturais de tabelas e blocos
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
        if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 4) {
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
    const allCities = DistanceService.getCities();

    // 1. NÚMERO DO PROCESSO SEI
    // Prioridade absoluta: formato "Processo nº 23282.XXXXXX/2026-XX" no cabeçalho
    const procTopMatch = rawText.match(/Processo\s*(?:n[ºo]\.?|numero|n°)?[\s:]*(\d{5,6}\.\d{5,7}\/\d{4}-\d{2})/i);
    if (procTopMatch) {
      result.process_number = procTopMatch[1].trim();
    } else {
      const seiGeneral = rawText.match(/\b(23282\.\d{5,7}\/\d{4}-\d{2})\b/) ||
                         rawText.match(/\b(\d{5}\.\d{5,7}\/\d{4}-\d{2})\b/);
      if (seiGeneral) {
        result.process_number = seiGeneral[1].trim();
      }
    }

    // 2. SEÇÃO 1: DADOS DO SOLICITANTE
    const sec1Match = rawText.match(/1\.\s*DADOS\s+DO\s+SOLICITANTE[\s\S]*?(?=2\.\s*DADOS\s+DA\s+VIAGEM|$)/i);
    const sec1Text = sec1Match ? sec1Match[0] : rawText;

    // E-mail do Solicitante
    const emailMatch = sec1Text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      result.requester_email = emailMatch[1].trim().toLowerCase();
    }

    // Telefone do Solicitante (suporta formatos: "(85) 996043849", "(85) 98782-4463", "85 996043849", etc.)
    const labelPhoneMatch = sec1Text.match(/(?:Telefone|Contato|Celular)[\s\S]*?(\(?\d{2}\)?\s*9?\s*\d{4}[-\s]?\d{4})/i);
    let extractedPhoneStr: string | null = null;
    if (labelPhoneMatch && labelPhoneMatch[1]) {
      extractedPhoneStr = labelPhoneMatch[1];
    } else {
      const allPhones = [
        ...sec1Text.matchAll(/(?:\(?\d{2}\)?\s*)?9\s*\d{4}[-\s]?\d{4}/g),
        ...sec1Text.matchAll(/\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/g),
        ...rawText.matchAll(/(?:\(?\d{2}\)?\s*)?9\s*\d{4}[-\s]?\d{4}/g),
        ...rawText.matchAll(/\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/g),
      ];
      if (allPhones.length > 0 && allPhones[0][0]) {
        extractedPhoneStr = allPhones[0][0];
      }
    }

    if (extractedPhoneStr) {
      const rawDigits = extractedPhoneStr.replace(/\D/g, '');
      if (rawDigits.length === 11) {
        // Formata: (85) 98782-4463
        result.requester_phone = `(${rawDigits.slice(0, 2)}) ${rawDigits.slice(2, 7)}-${rawDigits.slice(7)}`;
      } else if (rawDigits.length === 10) {
        // Formata: (85) 8782-4463
        result.requester_phone = `(${rawDigits.slice(0, 2)}) ${rawDigits.slice(2, 6)}-${rawDigits.slice(6)}`;
      } else if (rawDigits.length === 9) {
        // Assume DDD 85 padrão Unilab
        result.requester_phone = `(85) ${rawDigits.slice(0, 5)}-${rawDigits.slice(5)}`;
      } else if (rawDigits.length === 8) {
        result.requester_phone = `(85) ${rawDigits.slice(0, 4)}-${rawDigits.slice(4)}`;
      } else {
        result.requester_phone = extractedPhoneStr.replace(/\s+/g, ' ').trim();
      }
    }

    // Nome do Solicitante
    const nameBlock = sec1Text.match(/Nome do Solicitante[\s\S]*?(?=Unidade Requisitante|E-mail|$)/i);
    if (nameBlock) {
      const lines = nameBlock[0]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/Nome do Solicitante|SIAPE|1\.\s*DADOS/i.test(l));

      for (const line of lines) {
        const candidate = line.replace(/[\d\/]{5,}.*$/, '').replace(/\b\d{5,8}\b.*$/, '').trim();
        if (
          candidate.length >= 4 &&
          !/instituto|universidade|unilab|ciências|saúde|humanidades|reitoria|gabinete|serviço|pró-reitoria/i.test(candidate) &&
          !/^\d+$/.test(candidate)
        ) {
          result.requester_name = candidate;
          break;
        }
      }
    }
    if (!result.requester_name) {
      const altSol = sec1Text.match(/(?:Nome do Solicitante)[\s:.\n\r]+(?:SIAPE[\s:.\n\r]+)?([A-ZÀ-Úa-zà-ú\s]{4,60}?)(?:\s+\d{6,8}|\s+Unidade)/i);
      if (altSol) result.requester_name = altSol[1].trim();
    }

    // Unidade Macro e Unidade Requisitante
    const siglaMatch =
      sec1Text.match(/SIGLA[\s\S]*?\b(ICS|IDR|IH|ICEN|PROADI|PROPAE|GR|PROEX|PROINTER|ICSA|SECOM|PROPPG|DTI)\b/i) ||
      sec1Text.match(/\b(ICS|IDR|IH|ICEN|PROADI|PROPAE|GR|PROEX|PROINTER|ICSA|SECOM|PROPPG|DTI)\b/);
    if (siglaMatch) {
      result.macro_unit = siglaMatch[1].toUpperCase() as MacroUnit;
    }

    const reqSection = sec1Text.match(/Unidade Requisitante[\s\S]*?(?=SIGLA|E-mail|$)/i);
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

    // 3. SEÇÃO 2: DADOS DA VIAGEM
    // Natureza da Atividade (Marcação com "X")
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

    // 4. OBJETIVO DA VIAGEM
    // Exclui rigorosamente qualquer campo de justificativa fora do prazo, normas ou modelos institucionais
    const objSection = rawText.match(
      /Objetivo(?:\/Justificativa)?(?:\s+da\s+Viagem)?[\s\S]*?(?=Justificativa\s+p\/|Justificativa\s+para|Em\s+caso\s+de\s+solicitações|Endereço\s+de\s+Partida|$)/i
    );
    if (objSection) {
      const lines = objSection[0]
        .split('\n')
        .map((l) => l.trim())
        .filter(
          (l) =>
            l &&
            !/Objetivo(?:\/Justificativa)?/i.test(l) &&
            !/Justificativa\s+p\/|Fora do Prazo|Estabelecido em Normativo|Em caso de solicitações|atestar a inexistência|aeroportos|PCDP|SCDP/i.test(l)
        );
      if (lines.length > 0) {
        result.trip_objective = lines.join(' ').replace(/\s+/g, ' ').trim();
      }
    }
    if (result.trip_objective) {
      result.trip_objective = result.trip_objective
        .replace(/Justificativa\s+p\/.*$/i, '')
        .replace(/Justificativa\s+para.*$/i, '')
        .replace(/Em\s+caso\s+de\s+solicitações.*$/i, '')
        .trim();
    }

    // 5. ENDEREÇO DE PARTIDA E CIDADE DE ORIGEM
    const origSection = rawText.match(/Endereço\s+de\s+Partida(?:\s*\([^\)]*\))?[\s\S]*?(?=Endereço\s+de\s+Destino|Data\s+d[ea]\s+Partida|$)/i);
    if (origSection) {
      const lines = origSection[0]
        .split('\n')
        .map((l) => l.trim())
        .filter(
          (l) =>
            l &&
            !/Endereço\s+de\s+Partida/i.test(l) &&
            !/Objetivo(?:\/Justificativa)?(?:\s+da\s+Viagem)?/i.test(l) &&
            !/--- PÁGINA \d+ ---/i.test(l) &&
            !/SEI\s*\/?\s*UNILAB/i.test(l)
        );
      if (lines.length > 0) {
        let cleanOrig = lines.join(' ').replace(/\s+/g, ' ').trim();
        cleanOrig = cleanOrig.replace(/Objetivo(?:\/Justificativa)?(?:\s+da\s+Viagem)?.*$/i, '').trim();
        result.origin_address = cleanOrig;
      }
    }
    result.origin_city_id = matchCityInText(result.origin_address || 'Campus da Liberdade', allCities) || 'city-71';

    // 6. ENDEREÇO DE DESTINO E CIDADE DE DESTINO
    const destSection = rawText.match(
      /Endereço\s+de\s+Destino(?:\s*\([^\)]*\))?[\s\S]*?(?=Data\s+d[ea]\s+Partida|Data\s+d[ea]\s+Sa[íi]da|Necessidade\s+de\s+Paradas|Horário|$)/i
    );
    if (destSection) {
      const lines = destSection[0]
        .split('\n')
        .map((l) => l.trim())
        .filter(
          (l) =>
            l &&
            !/Endereço\s+de\s+Destino/i.test(l) &&
            !/Objetivo(?:\/Justificativa)?(?:\s+da\s+Viagem)?/i.test(l) &&
            !/--- PÁGINA \d+ ---/i.test(l) &&
            !/SEI\s*\/?\s*UNILAB/i.test(l)
        );
      if (lines.length > 0) {
        let cleanDest = lines.join(' ').replace(/\s+/g, ' ').trim();
        cleanDest = cleanDest.replace(/Objetivo(?:\/Justificativa)?(?:\s+da\s+Viagem)?.*$/i, '').trim();
        result.destination_address = cleanDest;
      }
    }

    // Localização dinâmica da cidade de destino na base de dados completa
    result.destination_city_id = matchCityInText(result.destination_address || '', allCities, result.origin_city_id);
    if (!result.destination_city_id) {
      // Se não encontrou no endereço, procura no trecho do texto logo após a menção de destino
      const splitDest = rawText.split(/Endereço\s+de\s+Destino/i);
      if (splitDest[1]) {
        const destBlock = splitDest[1].slice(0, 600);
        result.destination_city_id = matchCityInText(destBlock, allCities, result.origin_city_id);
      }
    }

    // 7. DATAS, HORÁRIOS E NÚMERO DE PASSAGEIROS
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

    // Fallbacks para datas e horários
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
      const passM = rawText.match(/(?:Nº\s*(?:de)?\s*Passageiros[^\d\n\r]*)(\d{1,3})/i);
      if (passM) {
        result.passenger_count = parseInt(passM[1], 10);
      }
    }

    // 8. PARADAS NO PERCURSO (CIDADES SECUNDÁRIAS)
    const paradasSection = rawText.match(/Necessidade\s+de\s+Paradas[\s\S]*?(?=3\.\s*RESPONSÁVEL|4\.\s*RELAÇÃO|$)/i);
    if (paradasSection) {
      const pText = paradasSection[0];
      const intermediates: string[] = [];
      for (const city of allCities) {
        if (city.id === result.origin_city_id || city.id === result.destination_city_id) continue;
        const normCity = normalizeText(city.name);
        if (normCity.length < 3) continue;

        const reg = new RegExp(`\\b${normCity}\\b`, 'i');
        if (reg.test(normalizeText(pText))) {
          if (!intermediates.includes(city.id)) {
            intermediates.push(city.id);
          }
        }
      }
      if (intermediates.length > 0) {
        result.intermediate_cities = intermediates;
      }
    }

    // 9. RELAÇÃO DE PASSAGEIROS (NOMES E CONTAGEM — suporta células quebradas em múltiplas linhas no PDF SEI)
    const relacaoPassageiros = rawText.match(
      /4\.\s*RELA[ÇC][ÃA]O\s+DE\s+PASSAGEIROS([\s\S]*?)(?=Documento\s+assinado\s+eletronicamente|A\s+autenticidade\s+deste\s+documento|\nNotas\b|Refer[êe]ncia:\s*Processo|$)/i
    );
    if (relacaoPassageiros) {
      const headerNoise =
        /^(Passageiro|n[ºo°]|Comunidade|Interna\s+ou|Externa\??|Especifica[çc][ãa]o|\(em\s+caso\s+de|Externa\)|Nome\s+do\s+Passageiro|SIAPE|\/\s*Matr[íi]cula|Matr[íi]cula|\(Apenas\s+p\/|Servidor\s+ou|Discente\)|Telefone|de\s+Contato|\(c\/\s*DDD\)|---\s*P[ÁA]GINA\s+\d+\s*---|Formul[áa]rio\s*-|SEI\s+\d)/i;

      const lines = relacaoPassageiros[1]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !headerNoise.test(l));

      const grouped: Array<{ num: number; parts: string[] }> = [];
      let current: { num: number; parts: string[] } | null = null;
      let lastNum = 0;

      for (const line of lines) {
        const rowStart = line.match(/^(\d{1,2})(?:\s+(.*))?$/);
        if (rowStart) {
          const num = parseInt(rowStart[1], 10);
          if (num >= 1 && num <= 65 && num > lastNum && num <= lastNum + 3) {
            if (current) grouped.push(current);
            lastNum = num;
            current = { num, parts: [] };
            if (rowStart[2]) {
              current.parts.push(rowStart[2]);
            }
            continue;
          }
        }
        if (current) {
          current.parts.push(line);
        }
      }
      if (current) grouped.push(current);

      const names: string[] = [];
      for (const p of grouped) {
        const nameParts: string[] = [];
        for (const part of p.parts) {
          const cleaned = part
            .replace(/\b(?:Comunidade\s+)?(?:Interna|Externa)\b/gi, '')
            .replace(/\+?\d[\d\s().\/-]{4,}/g, '')
            .replace(/\b\d{2,12}\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (cleaned.length >= 2 && /[A-Za-zÀ-ÿ]/.test(cleaned)) {
            nameParts.push(cleaned);
          }
        }
        const fullName = nameParts.join(' ').replace(/\s+/g, ' ').trim();
        if (fullName.length >= 3) {
          names.push(`${p.num}. ${fullName}`);
        }
      }

      if (names.length > 0) {
        result.passenger_names = names.join('\n');
        if (!result.passenger_count) {
          result.passenger_count = names.length;
        }
      }
    }

    // 10. RESPONSÁVEL PELOS PASSAGEIROS
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
