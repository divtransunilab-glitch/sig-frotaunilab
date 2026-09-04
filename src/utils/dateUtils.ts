import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata datas de maneira segura e à prova de falhas (RangeError: Invalid time value)
 * Preserva o horário literal das strings ISO para evitar distorção por fuso horário local.
 */
export function safeFormatDate(
  dateValue?: string | Date | null, 
  formatStr: string = 'dd/MM/yyyy', 
  fallback: string = '-'
): string {
  if (!dateValue) return fallback;
  try {
    if (typeof dateValue === 'string' && dateValue.includes('T')) {
      const parts = dateValue.split('T');
      const dateParts = parts[0].split('-');
      const timeParts = parts[1].replace(/Z|\+.*$/g, '').split(':');
      if (dateParts.length === 3 && timeParts.length >= 2) {
        const y = parseInt(dateParts[0], 10);
        const m = parseInt(dateParts[1], 10) - 1;
        const d = parseInt(dateParts[2], 10);
        const h = parseInt(timeParts[0], 10);
        const min = parseInt(timeParts[1], 10);
        const sec = timeParts[2] ? parseInt(timeParts[2], 10) : 0;

        const localDate = new Date(y, m, d, h, min, sec);
        if (isValid(localDate) && !isNaN(localDate.getTime())) {
          return format(localDate, formatStr, { locale: ptBR });
        }
      }
    }

    const d = typeof dateValue === 'string' ? parseISO(dateValue) : dateValue;
    if (!isValid(d) || isNaN(d.getTime())) return fallback;
    return format(d, formatStr, { locale: ptBR });
  } catch {
    return fallback;
  }
}
