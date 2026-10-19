export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export type FaqTabId = 'general' | 'pymes' | 'inversores';

export interface FaqCategory {
  id: FaqTabId;
  label: string;
  sectionTitle: string;
  sectionDescription: string;
  placeholderText: string;
  items: FaqItem[];
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'general',
    label: 'General',
    sectionTitle: 'Preguntas generales sobre Lencord',
    sectionDescription:
      'Información institucional sobre cómo funciona la plataforma, marco normativo, modelo tecnológico y custodia segura de fondos.',
    placeholderText:
      'Estamos compilando las preguntas más frecuentes sobre el funcionamiento general de la plataforma. Muy pronto vas a encontrar aquí las respuestas a todas tus consultas.',
    items: [
      {
        id: 'que-es-lencord',
        question: '¿Qué es Lencord?',
        answer:
          'Escribí acá la descripción de qué es Lencord. Podés usar saltos de línea para separar párrafos.',
      },
      {
        id: 'diferencia-prestamo-banco-comercial',
        question: '¿Qué diferencia existe entre un préstamo en Lencord y en un banco comercial?',
        answer:
          'Escribí acá la descripción de la diferencia entre un préstamo en Lencord y en un banco comercial. Podés usar saltos de línea para separar párrafos.',
      },
    ],
  },
  {
    id: 'pymes',
    label: 'Para PyMEs',
    sectionTitle: 'Financiamiento colectivo para PyMEs',
    sectionDescription:
      'Requisitos para solicitar crédito, documentación contable solicitada, evaluación de scoring crediticio, proceso de fondeo y pagos mensuales.',
    placeholderText:
      'Las preguntas frecuentes para empresas y PyMEs que buscan financiamiento están en proceso de redacción y estarán publicadas en breve.',
    items: [],
  },
  {
    id: 'inversores',
    label: 'Para inversores',
    sectionTitle: 'Inversión y rendimientos para inversores',
    sectionDescription:
      'Cómo participar en el fondeo de créditos, esquemas de tasas (fija TNA o UVA+spread), custodia de saldos bancarios y acreditación automática de cobranzas.',
    placeholderText:
      'El apartado de preguntas frecuentes para inversores individuales e institucionales está siendo preparado y estará disponible próximamente.',
    items: [],
  },
];
