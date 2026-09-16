const sampleText = `
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
01 DORCAS MBUCA ANTÓNIO DOMINGOS, NARIELY ANDRADE DE LIMA PONTES, PEDRO HENRIQUE SOARES FERREIRA, CLEMILDA JOSÉ ALFREDO, MUNIRA IAMDI, ACURSIA BENJAMIM MUCUMBE, NELSON BIÓR FIARÉ, HELINEIDE CARVALHO BONFIM DIAS e FATISALDA MENDES DOS SANTOS MADEIRA. EM FRENTE AO CEMITÉRIO DE ACARAPE
02 PEDRO HENRIQUE SOARES FERREIRA PARADA DE ÔNIBUS LOCALIZADA APÓS A ROTATÓRIA DO POSTO PREDILETO - PACATUBA

3. RESPONSÁVEL PELOS PASSAGEIROS
Nome do Responsável SIAPE Telefone de Contato (c/ DDD)
CAROLINA MARIA DE LIMA CARVALHO 1483962 85 987824463
HILANA DAYANA DODOU 1063163 85 997508346

4. RELAÇÃO DE PASSAGEIROS
Passageiro nº Comunidade Interna ou Externa? Especificação (em caso de Comunidade Externa) Nome do Passageiro SIAPE / Matrícula (Apenas p/ Servidor ou Discente) Telefone de Contato (c/ DDD)
1 ACURSIA BENJAMIM MUCUMBE 2022210290 85 996508230
2 CLEMILDA JOSÉ ALFREDO 2023111200 85 994155565
3 DORCAS MBUCA ANTÓNIO DOMINGOS 2022207885 85 996198840
4 FATISALDA MENDES DOS SANTOS MADEIRA 2023109810
5 HELINEIDE CARVALHO BONFIM DIAS 2023200852 +239 9998630
6 MANUEL TONDELE GONÇALVES 2022212002 85 996621604
`;

function parsePdfText(rawText) {
  const result = {};

  // 1. Processo SEI
  const seiMatch =
    rawText.match(/\b(23282\.\d{5,6}\/\d{4}-\d{2})\b/) ||
    rawText.match(/\b(\d{5}\.\d{5,6}\/\d{4}-\d{2})\b/);
  if (seiMatch) {
    result.process_number = seiMatch[1].trim();
  }

  // 2. Solicitante
  const solSection = rawText.match(/Nome do Solicitante[\s\S]*?(?=Unidade Requisitante|1\. DADOS|$)/i);
  if (solSection) {
    const lines = solSection[0]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/Nome do Solicitante|SIAPE|1\.\s*DADOS/i.test(l));
    for (const line of lines) {
      const clean = line.replace(/\b\d{5,8}\b.*$/, '').trim();
      if (clean.length >= 4 && !/^\d+$/.test(clean) && !/solicitante|unilab|instituto/i.test(clean)) {
        result.requester_name = clean;
        break;
      }
    }
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

  // 4. Unidade Requisitante e Macro Unit
  const siglaMatch =
    rawText.match(/SIGLA[\s\S]*?\b(ICS|IDR|IH|ICEN|PROADI|PROPAE|GR|PROEX|PROINTER|ICSA|SECOM|PROPPG|DTI)\b/i) ||
    rawText.match(/\b(ICS|IDR|IH|ICEN|PROADI|PROPAE|GR|PROEX|PROINTER|ICSA|SECOM|PROPPG|DTI)\b/);
  if (siglaMatch) {
    result.macro_unit = siglaMatch[1].toUpperCase();
  }

  const reqSection = rawText.match(/Unidade Requisitante[\s\S]*?(?=SIGLA|E-mail|$)/i);
  if (reqSection) {
    const lines = reqSection[0]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/Unidade Requisitante|SIGLA/i.test(l));
    if (lines.length > 0) {
      result.requesting_unit = lines[0].replace(/\b(ICS|IDR|IH|ICEN|PROADI|PROPAE|GR|PROEX|PROINTER|ICSA|SECOM|PROPPG|DTI)\b/g, '').trim();
    }
  }
  if (!result.requesting_unit && result.macro_unit) {
    result.requesting_unit = result.macro_unit;
  }

  // 5. Natureza da Atividade (Marcação com "X")
  const natSection = rawText.match(/Natureza da Atividade[\s\S]*?(?=Objetivo\/Justificativa|$)/i);
  const natText = natSection ? natSection[0] : rawText;

  if (/(?:Gradua[çc][ãa]o)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:Gradua[çc][ãa]o)/i.test(natText) && !/P[oó]s[-\s]Gradua[çc][ãa]o[^\n\r]*?[\[\(]?\s*X/i.test(natText)) {
    result.activity_type = 'Graduação';
  } else if (/(?:P[oó]s[-\s]Gradua[çc][ãa]o)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:P[oó]s[-\s]Gradua[çc][ãa]o)/i.test(natText)) {
    result.activity_type = 'Pós Graduação';
  } else if (/(?:Pesquisa)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:Pesquisa)/i.test(natText)) {
    result.activity_type = 'Pesquisa';
  } else if (/(?:Extens[ãa]o)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:Extens[ãa]o)/i.test(natText)) {
    result.activity_type = 'Extensão';
  } else if (/(?:Administrativ[oa]|Transporte de Bens)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:Administrativ[oa]|Transporte de Bens)/i.test(natText)) {
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
      .map(l => l.trim())
      .filter(l => l && !/Objetivo(?:\/Justificativa)?/i.test(l));
    if (lines.length > 0) {
      result.trip_objective = lines.join(' ').replace(/\s+/g, ' ').trim();
    }
  }

  // 7. Endereço de Partida e Origem
  const origSection = rawText.match(/Endereço\s+de\s+Partida(?:\s*\([^\)]*\))?[\s\S]*?(?=Endereço\s+de\s+Destino|Data\s+de\s+Partida|$)/i);
  if (origSection) {
    const lines = origSection[0]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/Endereço\s+de\s+Partida/i.test(l));
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
    result.origin_city_id = 'city-71';
  }

  // 8. Endereço de Destino
  const destSection = rawText.match(/Endereço\s+de\s+Destino(?:\s*\([^\)]*\))?[\s\S]*?(?=Data\s+de\s+Partida|Necessidade\s+de\s+Paradas|Horário|$)/i);
  if (destSection) {
    const lines = destSection[0]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/Endereço\s+de\s+Destino/i.test(l));
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
  }

  // 9. Datas, Horários e Quantidade de Passageiros
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

  // Fallback se não pegou linha combinada
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

  // 10. Necessidade de Paradas no Percurso (Cidades Secundárias)
  const paradasSection = rawText.match(/Necessidade\s+de\s+Paradas[\s\S]*?(?=3\.\s*RESPONSÁVEL|4\.\s*RELAÇÃO|$)/i);
  if (paradasSection) {
    const pText = paradasSection[0].toLowerCase();
    const intermediates = [];
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
    const lines = relacaoPassageiros[0].split('\n').map(l => l.trim());
    const names = [];
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
      .map(l => l.trim())
      .filter(l => l && !/3\.\s*RESPONSÁVEL|Nome do Responsável|SIAPE|Telefone/i.test(l));
    const respList = [];
    for (const line of lines) {
      // Ex: CAROLINA MARIA DE LIMA CARVALHO 1483962 85 987824463
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

const parsed = parsePdfText(sampleText);
console.log(JSON.stringify(parsed, null, 2));
