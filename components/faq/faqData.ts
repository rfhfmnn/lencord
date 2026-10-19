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
          'Lencord es una solución tecnológica que facilita la originación y gestión de préstamos colectivos (crowdlending o peer-to-peer lending), conectando online a inversores con PyMEs. Al eliminar la intermediación bancaria, las empresas acceden a financiamiento en mejores condiciones y los inversores obtienen un mayor rendimiento por su capital, todo bajo un esquema de total transparencia y flexibilidad en plazos y montos.',
      },
      {
        id: 'diferencia-prestamo-banco-comercial',
        question: '¿Qué diferencia existe entre un préstamo en Lencord y en un banco comercial?',
        answer:
          'En Lencord no prestamos capital propio, por lo que no buscamos encarecer el crédito con tasas elevadas. Al conectar directamente a inversores y prestatarios mediante tecnología, eliminamos costos operativos e intermediarios para distribuir ese ahorro: ofreciendo financiamiento más accesible para quienes lo necesitan y mejores rendimientos para quienes invierten.',
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
