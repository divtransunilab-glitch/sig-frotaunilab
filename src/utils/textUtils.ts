const LOWERCASE_WORDS = new Set([
  'a', 'o', 'as', 'os',
  'da', 'de', 'do', 'das', 'dos',
  'e', 'em', 'na', 'no', 'nas', 'nos',
  'ao', 'aos', 'à', 'às',
  'para', 'por', 'pelo', 'pela', 'pelos', 'pelas',
  'com', 'sem', 'sob', 'sobre', 'entre', 'ou', 'um', 'uma', 'uns', 'umas',
  'p/', 'c/', 's/n'
]);

const UPPERCASE_ACRONYMS = new Set([
  'UNILAB', 'PROADI', 'DIVTRANS', 'PROPAE', 'PROEX', 'PROINTER', 'PROPPG', 'SECOM', 'DTI',
  'ICS', 'IDR', 'ICEN', 'ICSA', 'IH', 'GR', 'SEI', 'SIAPE', 'CEP', 'CPF', 'RG', 'CNH', 'KM',
  'HSM', 'HUWC', 'IJF', 'UFC', 'UECE', 'IFCE', 'UFPB', 'UFPE', 'UFRN', 'UFBA', 'USP', 'UNB',
  'PCDP', 'SCDP', 'PDF', 'S/N', 'BR',
  // Estados brasileiros (UF)
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
  // Algarismos romanos comuns
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'
]);

/**
 * Verifica se o texto (desconsiderando números e pontuação) está predominantemente em MAIÚSCULAS.
 */
export function isMostlyUppercase(text: string): boolean {
  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length < 2) return false;
  const upperCount = (letters.match(/[A-ZÀ-Ý]/g) || []).length;
  return upperCount / letters.length >= 0.8;
}

function formatSingleWord(rawWord: string, isFirstWord: boolean): string {
  if (!rawWord) return rawWord;

  // Trata palavras hifenizadas (ex.: "Aracoiaba-CE", "Pós-Graduação", "S/N")
  if (rawWord.includes('-') && !rawWord.startsWith('-') && !rawWord.endsWith('-')) {
    return rawWord
      .split('-')
      .map((part, idx) => formatSingleWord(part, isFirstWord && idx === 0))
      .join('-');
  }

  // Separa pontuação ao redor da palavra (parênteses, vírgulas, pontos, dois-pontos)
  const match = rawWord.match(/^([^A-Za-zÀ-ÿ0-9]*)([A-Za-zÀ-ÿ0-9/]+)([^A-Za-zÀ-ÿ0-9]*)$/);
  if (!match) return rawWord;

  const [, prefix, core, suffix] = match;
  const upperCore = core.toUpperCase();
  const lowerCore = core.toLowerCase();

  // Mantém siglas conhecidas e UFs em MAIÚSCULAS (exceto quando for 1ª palavra e minúscula comum, como "A")
  if (UPPERCASE_ACRONYMS.has(upperCore) && !(upperCore === 'I' && !isFirstWord && core === 'i')) {
    return `${prefix}${upperCore}${suffix}`;
  }

  // Mantém preposições/artigos em minúsculas no meio da frase
  if (!isFirstWord && LOWERCASE_WORDS.has(lowerCore)) {
    return `${prefix}${lowerCore}${suffix}`;
  }

  // Capitaliza apenas a primeira letra
  const capitalized = lowerCore.charAt(0).toUpperCase() + lowerCore.slice(1);
  return `${prefix}${capitalized}${suffix}`;
}

/**
 * Converte texto em Title Case padronizado em português (preservando quebras de linha, siglas e preposições).
 * Se `onlyIfUppercase` for true, só transforma linhas que vieram todas em MAIÚSCULAS.
 */
export function toTitleCasePtBr(text?: string, onlyIfUppercase = true): string {
  if (!text) return '';

  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (onlyIfUppercase && !isMostlyUppercase(trimmed)) {
        return trimmed;
      }

      const words = trimmed.split(/\s+/);
      let seenAlphaWord = false;
      return words
        .map((word) => {
          const hasLetter = /[A-Za-zÀ-ÿ]/.test(word);
          const isFirst = !seenAlphaWord && hasLetter;
          if (hasLetter) seenAlphaWord = true;
          return formatSingleWord(word, isFirst);
        })
        .join(' ');
    })
    .join('\n')
    .trim();
}
