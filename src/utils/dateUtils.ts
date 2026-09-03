import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata datas de maneira segura e à prova de falhas (RangeError: Invalid time value)
 */
export function safeFormatDate(
  dateValue?: string | Date | null, 
  formatStr: string = 'dd/MM/yyyy', 
  fallback: string = '-'
): string {
  if (!dateValue) return fallback;
  try {
    const d = typeof dateValue === 'string' ? parseISO(dateValue) : dateValue;
    if (!isValid(d) || isNaN(d.getTime())) return fallback;
    return format(d, formatStr, { locale: ptBR });
  } catch {
    return fallback;
  }
}
