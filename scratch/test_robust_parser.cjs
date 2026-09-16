const fs = require('fs');

// Simulação de cidades cadastradas
const CITIES = [
  { id: 'city-1', name: 'Acarape', state: 'CE' },
  { id: 'city-11', name: 'Baturité', state: 'CE' },
  { id: 'city-17', name: 'Canindé', state: 'CE' },
  { id: 'city-20', name: 'Caucaia', state: 'CE' },
  { id: 'city-27', name: 'Fortaleza', state: 'CE' },
  { id: 'city-30', name: 'Guaramiranga', state: 'CE' },
  { id: 'city-42', name: 'Juazeiro do Norte', state: 'CE' },
  { id: 'city-46', name: 'Maracanaú', state: 'CE' },
  { id: 'city-47', name: 'Maranguape', state: 'CE' },
  { id: 'city-58', name: 'Pacatuba', state: 'CE' },
  { id: 'city-59', name: 'Pacoti', state: 'CE' },
  { id: 'city-69', name: 'Quixadá', state: 'CE' },
  { id: 'city-70', name: 'Quixeramobim', state: 'CE' },
  { id: 'city-71', name: 'Redenção', state: 'CE' },
  { id: 'city-78', name: 'Sobral', state: 'CE' },
];

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findCity(text, cities, excludeId) {
  if (!text) return undefined;
  const normText = normalize(text);

  // Aliases conhecidos
  if (/messejana|aldeota|papicu|parangaba|mucuripe|centro|benfica|aeroporto de fortaleza|pinto martins/.test(normText)) {
    const f = cities.find(c => normalize(c.name) === 'fortaleza');
    if (f) return f.id;
  }
  if (/campus da liberdade|liberdade|auroras/.test(normText)) {
    const r = cities.find(c => normalize(c.name) === 'redencao');
    if (r) return r.id;
  }
  if (/campus palmares|palmares/.test(normText)) {
    const a = cities.find(c => normalize(c.name) === 'acarape');
    if (a) return a.id;
  }

  // Busca cada cidade da base
  for (const city of cities) {
    if (excludeId && city.id === excludeId) continue;
    const normCity = normalize(city.name);
    // Regex com word boundary
    const reg = new RegExp(`\\b${normCity}\\b`, 'i');
    if (reg.test(normText)) {
      return city.id;
    }
  }
  return undefined;
}

// Teste com o PDF real onde havia justificativa preenchida
const testTextWithJustification = `
MINISTÉRIO DA EDUCAÇÃO
UNIVERSIDADE DA INTEGRAÇÃO INTERNACIONAL DA LUSOFONIA AFRO-BRASILEIRA
INSTITUTO DE CIÊNCIAS DA SAÚDE
Rua José Franco de Oliveira, S/N, , Redenção/CE, CEP 62790-970

FORMULÁRIO - VEÍCULO OFICIAL

Processo nº 23282.013254/2026-11

1. DADOS DO SOLICITANTE

Nome do Solicitante SIAPE
CAROLINA MARIA DE LIMA CARVALHO 1483962
Unidade Requisitante SIGLA
INSTITUTO DE CIÊNCIAS DA SAÚDE ICS
E-mail (Utilizado p/ Confirmação de Viagem) Telefone (c/ DDD)
carolinacarvalho@unilab.edu.br 85 987824463

2. DADOS DA VIAGEM

Natureza da Atividade (Marcar c/ "X")
Atividade Curricular de Graduação X Atividade Curricular de Pós-Graduação
Atividade de Pesquisa Atividade de Extensão, Arte e/ou Cultura
Atividade Administrativa Transporte de Bens/Materiais

Objetivo/Justificativa da Viagem
Realização das Práticas da Disciplina Processo de Cuidar em Saúde Mental do curso de enfermagem

Justificativa p/ Envio de Solicitação Fora do Prazo Mínimo Estabelecido em Normativo
A solicitação está sendo enviada fora do prazo devido ao atraso no calendário acadêmico e liberação tardia das escalas do hospital.

Em caso de solicitações de viagens vinculadas a projetos de pesquisa, atestar a inexistência de rubrica (ajuda de custo) destinada ao pagamento de despesas com deslocamentos.

--- PÁGINA 2 ---

Em casos de deslocamento de ou para aeroportos, informar o código de solicitação (PCDP) do Sistema de Concessão de Diárias e Passagens (SCDP)...

Endereço de Partida (Acrescentar Pontos de Referência, se Possível)
CAMPUS DA LIBERDADE

Endereço de Destino (Acrescentar Pontos de Referência, se Possível)
HOSPITA DE SAUDE MENTAL PROFESSOR FROTA PINTO - HSM. ENDRECO: Rua Vicente Nobre Macêdo, S/n - Messejana, Fortaleza - CE, 60841-110. POR TRAS DO GONZAGUINHA DA MESSEJANA AO LADO DA PRAÇA, FINAL DA RUA.

Data de Partida Horário Nº de Passageiros
17/09/2026 6:30 13
Data de Retorno Horário Nº de Passageiros
17/09/2026 12:00 13

Necessidade de Paradas no Percurso (A Divisão de Transportes não responsabilizará por possíveis danos ou prejuízos ocorridos durante as paradas)
Parada nº Nome do Passageiro e/ou Motivo da Parada Endereço
01 DORCAS MBUCA ANTÓNIO DOMINGOS EM FRENTE AO CEMITÉRIO DE ACARAPE
02 PEDRO HENRIQUE SOARES FERREIRA POSTO PREDILETO - PACATUBA

Formulário - Veículo Oficial 3025 (1517658) SEI 23282.013254/2026-11 / pg. 2
`;

function parseRobust(text, cities) {
  const res = {};

  // 1. Processo SEI
  // Prioridade 1: "Processo nº 23282.XXXXXX/2026-XX" no topo
  const procMatch =
    text.match(/Processo\s*(?:nº|n[ºo]\.?)?[\s:]*(\d{5,6}\.\d{5,7}\/\d{4}-\d{2})/i) ||
    text.match(/\b(23282\.\d{5,7}\/\d{4}-\d{2})\b/);
  if (procMatch) {
    res.process_number = procMatch[1].trim();
  }

  // 2. Solicitante
  // Pega a seção entre "1. DADOS DO SOLICITANTE" e "2. DADOS DA VIAGEM"
  const sec1 = text.match(/1\.\s*DADOS\s+DO\s+SOLICITANTE[\s\S]*?(?=2\.\s*DADOS\s+DA\s+VIAGEM|$)/i);
  const sec1Text = sec1 ? sec1[0] : text;

  // E-mail primeiro para ajudar a validar
  const emailM = sec1Text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailM) {
    res.requester_email = emailM[1].trim().toLowerCase();
  }

  // Telefone em qualquer formato no bloco do solicitante: 85 987824463 ou (85) 98782-4463
  const telM =
    sec1Text.match(/(?:Telefone|Contato)[^\d\n\r]*(\(?\d{2}\)?\s*9?\s*\d{4}[-\s]?\d{4})/i) ||
    sec1Text.match(/\b(\d{2}\s*9\s*\d{4}[-\s]?\d{4})\b/) ||
    sec1Text.match(/\b(\d{2}\s*\d{8,9})\b/);
  if (telM) {
    res.requester_phone = telM[1].replace(/\s+/g, ' ').trim();
  }

  // Nome do solicitante:
  // No cabeçalho: "Nome do Solicitante SIAPE \n NOME 123456"
  const nameBlock = sec1Text.match(/Nome do Solicitante[\s\S]*?(?=Unidade Requisitante|E-mail|$)/i);
  if (nameBlock) {
    const lines = nameBlock[0]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/Nome do Solicitante|SIAPE|1\.\s*DADOS/i.test(l));

    for (const l of lines) {
      // Remove SIAPE do final se presente
      const candidate = l.replace(/\b\d{5,8}\b.*$/, '').trim();
      // Não pode ser nome de instituição
      if (
        candidate.length >= 4 &&
        !/instituto|universidade|unilab|ciências|saúde|humanidades|reitoria|gabinete/i.test(candidate) &&
        !/^\d+$/.test(candidate)
      ) {
        res.requester_name = candidate;
        break;
      }
    }
  }

  // 3. Unidade Macro e Requisitante
  const siglaM =
    sec1Text.match(/SIGLA[\s\S]*?\b(ICS|IDR|IH|ICEN|PROADI|PROPAE|GR|PROEX|PROINTER|ICSA|SECOM|PROPPG|DTI)\b/i) ||
    sec1Text.match(/\b(ICS|IDR|IH|ICEN|PROADI|PROPAE|GR|PROEX|PROINTER|ICSA|SECOM|PROPPG|DTI)\b/);
  if (siglaM) {
    res.macro_unit = siglaM[1].toUpperCase();
  }

  const uReqM = sec1Text.match(/Unidade Requisitante[\s\S]*?(?=SIGLA|E-mail|$)/i);
  if (uReqM) {
    const uLines = uReqM[0]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/Unidade Requisitante|SIGLA/i.test(l));
    if (uLines.length > 0) {
      res.requesting_unit = uLines[0]
        .replace(/\b(ICS|IDR|IH|ICEN|PROADI|PROPAE|GR|PROEX|PROINTER|ICSA|SECOM|PROPPG|DTI)\b/g, '')
        .trim();
    }
  }
  if (!res.requesting_unit && res.macro_unit) {
    res.requesting_unit = res.macro_unit;
  }

  // 4. Natureza da Atividade (X)
  const natM = text.match(/Natureza da Atividade[\s\S]*?(?=Objetivo\/Justificativa|$)/i);
  const natT = natM ? natM[0] : text;

  if (
    /(?:Gradua[çc][ãa]o)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:Gradua[çc][ãa]o)/i.test(natT) &&
    !/P[oó]s[-\s]Gradua[çc][ãa]o[^\n\r]*?[\[\(]?\s*X/i.test(natT)
  ) {
    res.activity_type = 'Graduação';
  } else if (
    /(?:P[oó]s[-\s]Gradua[çc][ãa]o)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:P[oó]s[-\s]Gradua[çc][ãa]o)/i.test(natT)
  ) {
    res.activity_type = 'Pós Graduação';
  } else if (
    /(?:Pesquisa)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:Pesquisa)/i.test(natT)
  ) {
    res.activity_type = 'Pesquisa';
  } else if (
    /(?:Extens[ãa]o)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:Extens[ãa]o)/i.test(natT)
  ) {
    res.activity_type = 'Extensão';
  } else if (
    /(?:Administrativ[oa]|Transporte de Bens)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:Administrativ[oa]|Transporte de Bens)/i.test(natT)
  ) {
    res.activity_type = 'Administrativo';
  }

  // 5. Objetivo da Viagem (EXCLUINDO Justificativa de fora do prazo / pesquisa / aeroporto)
  // O objetivo fica rigorosamente entre "Objetivo/Justificativa da Viagem" e "Justificativa p/"
  const objM = text.match(/Objetivo(?:\/Justificativa)?(?:\s+da\s+Viagem)?[\s\S]*?(?=Justificativa\s+p\/|Justificativa\s+para|Em\s+caso\s+de\s+solicitações|Endereço\s+de\s+Partida|$)/i);
  if (objM) {
    const oLines = objM[0]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/Objetivo(?:\/Justificativa)?/i.test(l));
    if (oLines.length > 0) {
      // Limpeza de texto de modelo
      const cleaned = oLines.join(' ').replace(/\s+/g, ' ').trim();
      if (!/Justificativa\s+p\/|Fora do Prazo/i.test(cleaned)) {
        res.trip_objective = cleaned;
      }
    }
  }

  // 6. Endereço de Partida e Origem
  const partM = text.match(/Endereço\s+de\s+Partida(?:\s*\([^\)]*\))?[\s\S]*?(?=Endereço\s+de\s+Destino|Data\s+de\s+Partida|$)/i);
  if (partM) {
    const pLines = partM[0]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/Endereço\s+de\s+Partida/i.test(l));
    if (pLines.length > 0) {
      res.origin_address = pLines.join(' ').replace(/\s+/g, ' ').trim();
    }
  }
  res.origin_city_id = findCity(res.origin_address || 'Campus da Liberdade', cities) || 'city-71';

  // 7. Endereço de Destino e Cidade de Destino
  const destM = text.match(/Endereço\s+de\s+Destino(?:\s*\([^\)]*\))?[\s\S]*?(?=Data\s+de\s+Partida|Necessidade\s+de\s+Paradas|Horário|$)/i);
  if (destM) {
    const dLines = destM[0]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/Endereço\s+de\s+Destino/i.test(l));
    if (dLines.length > 0) {
      res.destination_address = dLines.join(' ').replace(/\s+/g, ' ').trim();
    }
  }

  // Cidade de destino: busca na base completa de cidades
  res.destination_city_id = findCity(res.destination_address, cities, res.origin_city_id);
  if (!res.destination_city_id) {
    // Busca em todo o texto após "Endereço de Destino"
    const afterDest = text.split(/Endereço\s+de\s+Destino/i)[1] || '';
    const slice = afterDest.slice(0, 500);
    res.destination_city_id = findCity(slice, cities, res.origin_city_id);
  }

  // 8. Datas, Horários e Quantidade de Passageiros
  const combinedRows = [...text.matchAll(/(\d{2}\/\d{2}\/\d{4})\s+([01]?\d|2[0-3])[:hH]([0-5]\d)\s+(\d{1,3})/g)];
  if (combinedRows.length >= 1) {
    const [, d1, h1, min1, count1] = combinedRows[0];
    const [day, month, year] = d1.split('/');
    res.departure_date = `${year}-${month}-${day}`;
    res.departure_time = `${h1.padStart(2, '0')}:${min1}`;
    res.passenger_count = parseInt(count1, 10);

    if (combinedRows.length >= 2) {
      const [, d2, h2, min2] = combinedRows[1];
      const [rDay, rMonth, rYear] = d2.split('/');
      res.return_date = `${rYear}-${rMonth}-${rDay}`;
      res.return_time = `${h2.padStart(2, '0')}:${min2}`;
    }
  }

  // 9. Paradas no Percurso (Cidades Secundárias)
  const paradasSec = text.match(/Necessidade\s+de\s+Paradas[\s\S]*?(?=3\.\s*RESPONSÁVEL|4\.\s*RELAÇÃO|$)/i);
  if (paradasSec) {
    const pText = paradasSec[0];
    const intermediates = [];
    for (const city of cities) {
      if (city.id === res.origin_city_id || city.id === res.destination_city_id) continue;
      const reg = new RegExp(`\\b${normalize(city.name)}\\b`, 'i');
      if (reg.test(normalize(pText))) {
        if (!intermediates.includes(city.id)) {
          intermediates.push(city.id);
        }
      }
    }
    if (intermediates.length > 0) {
      res.intermediate_cities = intermediates;
    }
  }

  return res;
}

const parsed = parseRobust(testTextWithJustification, CITIES);
console.log("PARSED RESULT:\n", JSON.stringify(parsed, null, 2));
