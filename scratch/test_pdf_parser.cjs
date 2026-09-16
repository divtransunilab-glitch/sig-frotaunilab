const fs = require('fs');

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

function parseUnilabForm(text) {
  const res = {};

  // 1. Processo SEI
  const seiMatch = text.match(/\b(23282\.\d{5,6}\/\d{4}-\d{2})\b/) || text.match(/\b(\d{5}\.\d{5,6}\/\d{4}-\d{2})\b/);
  if (seiMatch) res.process_number = seiMatch[1].trim();

  // 2. Solicitante
  // Formato: Nome do Solicitante ... SIAPE ... NOME 123456
  // Ou entre "Nome do Solicitante" e "Unidade Requisitante"
  const solicitanteBlock = text.match(/Nome do Solicitante[\s\S]*?(?=Unidade Requisitante|1\. DADOS DO SOLICITANTE|$)/i);
  if (solicitanteBlock) {
    const lines = solicitanteBlock[0]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/Nome do Solicitante|SIAPE|1\.\s*DADOS/i.test(l));
    
    // Procura uma linha que contenha o nome do solicitante
    // Pode ser: "CAROLINA MARIA DE LIMA CARVALHO 1483962" ou linha separada
    for (const line of lines) {
      // Remove possível número SIAPE no final (ex: "CAROLINA... 1483962")
      const cleanedName = line.replace(/\b\d{5,8}\b.*$/, '').trim();
      if (cleanedName.length >= 4 && !/^[0-9]+$/.test(cleanedName)) {
        res.requester_name = cleanedName;
        break;
      }
    }
  }

  // Se não achou por linhas, regex alternativo
  if (!res.requester_name) {
    const altSol = text.match(/(?:Nome do Solicitante)[\s:.\n\r]+(?:SIAPE[\s:.\n\r]+)?([A-ZÀ-Úa-zà-ú\s]{4,60}?)(?:\s+\d{6,8}|\s+Unidade)/i);
    if (altSol) res.requester_name = altSol[1].trim();
  }

  // 3. E-mail e Telefone do solicitante
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) res.requester_email = emailMatch[1].trim().toLowerCase();

  const phoneMatch = text.match(/Telefone\s*(?:\(c\/\s*DDD\))?[\s\S]*?(\d{2}\s*9?\d{4}[-\s]?\d{4})/i) ||
                     text.match(/\b(85\s*9\d{8}|85\s*\d{8})\b/);
  if (phoneMatch) res.requester_phone = phoneMatch[1].trim();

  // 4. Unidade Requisitante e SIGLA / MacroUnit
  // No formulário: Unidade Requisitante ... SIGLA ... INSTITUTO DE CIÊNCIAS DA SAÚDE ... ICS
  const siglaMatch = text.match(/\bSIGLA\s*[\n\r\s]*\b(ICS|IDR|IH|ICEN|PROADI|PROPAE|GR|PROEX|PROINTER|ICSA|SECOM|PROPPG|DTI)\b/i) ||
                     text.match(/\b(ICS|IDR|IH|ICEN|PROADI|PROPAE|GR|PROEX|PROINTER|ICSA|SECOM|PROPPG|DTI)\b/);
  if (siglaMatch) {
    res.macro_unit = siglaMatch[1].toUpperCase();
  }

  const reqUnitMatch = text.match(/Unidade Requisitante[\s\S]*?(?=SIGLA|E-mail|$)/i);
  if (reqUnitMatch) {
    const uLines = reqUnitMatch[0]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/Unidade Requisitante|SIGLA/i.test(l));
    if (uLines.length > 0) {
      res.requesting_unit = uLines[0].replace(/\b(ICS|IDR|IH|ICEN|PROADI|PROPAE|GR|PROEX|PROINTER|ICSA|SECOM|PROPPG|DTI)\b/g, '').trim();
    }
  }
  if (!res.requesting_unit && res.macro_unit) {
    res.requesting_unit = res.macro_unit;
  }

  // 5. Natureza da Atividade (Marcação com "X")
  const natBlock = text.match(/Natureza da Atividade[\s\S]*?(?=Objetivo\/Justificativa|$)/i);
  const blockToCheck = natBlock ? natBlock[0] : text;

  if (/(?:Gradua[çc][ãa]o)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:Gradua[çc][ãa]o)/i.test(blockToCheck) && !/P[oó]s[-\s]Gradua[çc][ãa]o[^\n\r]*?[\[\(]?\s*X/i.test(blockToCheck)) {
    res.activity_type = 'Graduação';
  } else if (/(?:P[oó]s[-\s]Gradua[çc][ãa]o)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:P[oó]s[-\s]Gradua[çc][ãa]o)/i.test(blockToCheck)) {
    res.activity_type = 'Pós Graduação';
  } else if (/(?:Pesquisa)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:Pesquisa)/i.test(blockToCheck)) {
    res.activity_type = 'Pesquisa';
  } else if (/(?:Extens[ãa]o)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:Extens[ãa]o)/i.test(blockToCheck)) {
    res.activity_type = 'Extensão';
  } else if (/(?:Administrativ[oa]|Transporte de Bens)[^\n\r]*?[\[\(]?\s*X\s*[\]\)]?|[\[\(]?\s*X\s*[\]\)]?[^\n\r]*?(?:Administrativ[oa]|Transporte de Bens)/i.test(blockToCheck)) {
    res.activity_type = 'Administrativo';
  } else {
    // Fallback por contexto
    if (/disciplina|curso de|aula de campo|gradua[çc][ãa]o/i.test(text)) res.activity_type = 'Graduação';
    else if (/p[oó]s[-\s]gradua[çc][ãa]o|mestrado/i.test(text)) res.activity_type = 'Pós Graduação';
    else if (/pesquisa/i.test(text)) res.activity_type = 'Pesquisa';
    else if (/extens[ãa]o/i.test(text)) res.activity_type = 'Extensão';
    else res.activity_type = 'Administrativo';
  }

  // 6. Objetivo/Justificativa da Viagem
  const objMatch = text.match(/Objetivo(?:\/Justificativa)?(?:\s+da\s+Viagem)?[\s\S]*?(?=Justificativa\s+p\/|Em\s+caso\s+de\s+solicitações|Endereço\s+de\s+Partida|$)/i);
  if (objMatch) {
    const oLines = objMatch[0]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/Objetivo(?:\/Justificativa)?/i.test(l));
    if (oLines.length > 0) {
      res.trip_objective = oLines.join(' ').replace(/\s+/g, ' ').trim();
    }
  }

  // 7. Endereço de Partida
  const partidaMatch = text.match(/Endereço\s+de\s+Partida(?:\s*\([^\)]*\))?[\s\S]*?(?=Endereço\s+de\s+Destino|Data\s+de\s+Partida|$)/i);
  if (partidaMatch) {
    const pLines = partidaMatch[0]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/Endereço\s+de\s+Partida/i.test(l));
    if (pLines.length > 0) {
      res.origin_address = pLines.join(' ').replace(/\s+/g, ' ').trim();
    }
  }

  // Determinação de Cidade de Origem
  // Se contiver Liberdade, Auroras, Palmares, Redenção ou Acarape
  const origText = (res.origin_address || text).toLowerCase();
  if (/liberdade|auroras|reden[çc][ãa]o/.test(origText)) {
    res.origin_city_id = 'city-71'; // Redenção
  } else if (/palmares|acarape/.test(origText)) {
    res.origin_city_id = 'city-1'; // Acarape
  } else if (/fortaleza/.test(origText)) {
    res.origin_city_id = 'city-27'; // Fortaleza
  } else {
    res.origin_city_id = 'city-71'; // Padrão UNILAB: Redenção
  }

  // 8. Endereço de Destino
  const destinoMatch = text.match(/Endereço\s+de\s+Destino(?:\s*\([^\)]*\))?[\s\S]*?(?=Data\s+de\s+Partida|Necessidade\s+de\s+Paradas|Horário|$)/i);
  if (destinoMatch) {
    const dLines = destinoMatch[0]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/Endereço\s+de\s+Destino/i.test(l));
    if (dLines.length > 0) {
      res.destination_address = dLines.join(' ').replace(/\s+/g, ' ').trim();
    }
  }

  // Determinação de Cidade de Destino a partir do endereço de destino ou do texto
  const destText = (res.destination_address || '').toLowerCase();
  if (/fortaleza|messejana|maracana[uú]|caucaia|aldeota/.test(destText)) {
    res.destination_city_id = 'city-27'; // Fortaleza
  } else if (/guaramiranga/.test(destText)) {
    res.destination_city_id = 'city-30';
  } else if (/baturit[eé]/.test(destText)) {
    res.destination_city_id = 'city-11';
  } else if (/quixad[aá]/.test(destText)) {
    res.destination_city_id = 'city-69';
  } else if (/quixeramobim/.test(destText)) {
    res.destination_city_id = 'city-70';
  } else if (/acarape/.test(destText)) {
    res.destination_city_id = 'city-1';
  } else if (/pacatuba/.test(destText)) {
    res.destination_city_id = 'city-58';
  } else if (/pacoti/.test(destText)) {
    res.destination_city_id = 'city-59';
  }

  // 9. Datas, Horários e Quantidade de Passageiros
  // Tabela:
  // Data de Partida | Horário | Nº de Passageiros
  // 17/09/2026      | 6:30    | 13
  // Data de Retorno | Horário | Nº de Passageiros
  // 17/09/2026      | 12:00   | 13
  const partRow = text.match(/Data de Partida[\s\S]*?(?=Data de Retorno|Necessidade de Paradas|$)/i);
  if (partRow) {
    const dateM = partRow[0].match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (dateM) {
      res.departure_date = `${dateM[3]}-${dateM[2]}-${dateM[1]}`;
    }
    const timeM = partRow[0].match(/\b([01]?\d|2[0-3])[:hH]([0-5]\d)\b/);
    if (timeM) {
      res.departure_time = `${timeM[1].padStart(2, '0')}:${timeM[2]}`;
    }
    const passM = partRow[0].match(/(?:Nº de Passageiros[^\d]*)(\d{1,3})/i) || partRow[0].match(/\b(\d{1,2})\b$/);
    if (passM) {
      res.passenger_count = parseInt(passM[1], 10);
    }
  }

  const retRow = text.match(/Data de Retorno[\s\S]*?(?=Necessidade de Paradas|3\. RESPONSÁVEL|$)/i);
  if (retRow) {
    const dateM = retRow[0].match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (dateM) {
      res.return_date = `${dateM[3]}-${dateM[2]}-${dateM[1]}`;
    }
    const timeM = retRow[0].match(/\b([01]?\d|2[0-3])[:hH]([0-5]\d)\b/);
    if (timeM) {
      res.return_time = `${timeM[1].padStart(2, '0')}:${timeM[2]}`;
    }
    if (!res.passenger_count) {
      const passM = retRow[0].match(/(?:Nº de Passageiros[^\d]*)(\d{1,3})/i);
      if (passM) res.passenger_count = parseInt(passM[1], 10);
    }
  }

  // 10. Necessidade de Paradas no Percurso (Cidades Secundárias)
  const paradasSection = text.match(/Necessidade\s+de\s+Paradas[\s\S]*?(?=3\.\s*RESPONSÁVEL|4\.\s*RELAÇÃO|$)/i);
  if (paradasSection) {
    const pText = paradasSection[0].toLowerCase();
    const intermediates = [];
    if (/acarape/.test(pText) && res.origin_city_id !== 'city-1' && res.destination_city_id !== 'city-1') {
      intermediates.push('city-1'); // Acarape
    }
    if (/pacatuba/.test(pText) && res.origin_city_id !== 'city-58' && res.destination_city_id !== 'city-58') {
      intermediates.push('city-58'); // Pacatuba
    }
    if (/guaramiranga/.test(pText) && res.origin_city_id !== 'city-30' && res.destination_city_id !== 'city-30') {
      intermediates.push('city-30');
    }
    if (/pacoti/.test(pText) && res.origin_city_id !== 'city-59' && res.destination_city_id !== 'city-59') {
      intermediates.push('city-59');
    }
    if (/baturit[eé]/.test(pText) && res.origin_city_id !== 'city-11' && res.destination_city_id !== 'city-11') {
      intermediates.push('city-11');
    }
    if (intermediates.length > 0) {
      res.intermediate_cities = intermediates;
    }
  }

  // 11. Relação de Passageiros (Nomes)
  const relacaoPassageiros = text.match(/4\.\s*RELAÇÃO\s+DE\s+PASSAGEIROS[\s\S]*$/i);
  if (relacaoPassageiros) {
    // Procura linhas ou padrões: 1 NOME MATRICULA TELEFONE
    const pLines = relacaoPassageiros[0].split('\n').map(l => l.trim());
    const names = [];
    for (const line of pLines) {
      // Exemplo: "1 ACURSIA BENJAMIM MUCUMBE 2022210290 85 996508230"
      const match = line.match(/^(\d{1,2})\s+([A-ZÀ-Ú\s]{5,50}?)(?:\s+\d{6,12}|\s*\+?\d{2,3}|$)/);
      if (match && !/Passageiro|Comunidade|Nome/i.test(match[2])) {
        const pNum = match[1];
        const pName = match[2].trim();
        names.push(`${pNum}. ${pName}`);
      }
    }
    if (names.length > 0) {
      res.passenger_names = names.join('; ');
      if (!res.passenger_count) {
        res.passenger_count = names.length;
      }
    }
  }

  return res;
}

const result = parseUnilabForm(sampleText);
console.log("Extracted Data:\n", JSON.stringify(result, null, 2));
