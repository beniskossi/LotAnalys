import { DaySchedule } from './types';

export const DRAW_SCHEDULE: DaySchedule[] = [
  {
    day: 'Lundi',
    draws: [
      { time: '07:00', name: 'Digital Reveil 7h' },
      { time: '08:00', name: 'Digital Reveil 8h' },
      { time: '09:00', name: 'Reveil' },
      { time: '13:00', name: 'Etoile' },
      { time: '16:00', name: 'Akwaba' },
      { time: '18:15', name: 'Monday Special' },
      { time: '21:00', name: 'Digital 21h' },
      { time: '22:00', name: 'Digital 22h' },
      { time: '23:00', name: 'Digital 23h' },
    ],
  },
  {
    day: 'Mardi',
    draws: [
      { time: '07:00', name: 'Digital Reveil 7h' },
      { time: '08:00', name: 'Digital Reveil 8h' },
      { time: '09:00', name: 'La Matinale' },
      { time: '13:00', name: 'Emergence' },
      { time: '16:00', name: 'Sika' },
      { time: '18:15', name: 'Lucky Tuesday' },
      { time: '21:00', name: 'Digital 21h' },
      { time: '22:00', name: 'Digital 22h' },
      { time: '23:00', name: 'Digital 23h' },
    ],
  },
  {
    day: 'Mercredi',
    draws: [
      { time: '07:00', name: 'Digital Reveil 7h' },
      { time: '08:00', name: 'Digital Reveil 8h' },
      { time: '09:00', name: 'Premiere Heure' },
      { time: '13:00', name: 'Fortune' },
      { time: '16:00', name: 'Baraka' },
      { time: '18:15', name: 'Midweek' },
      { time: '21:00', name: 'Digital 21h' },
      { time: '22:00', name: 'Digital 22h' },
      { time: '23:00', name: 'Digital 23h' },
    ],
  },
  {
    day: 'Jeudi',
    draws: [
      { time: '07:00', name: 'Digital Reveil 7h' },
      { time: '08:00', name: 'Digital Reveil 8h' },
      { time: '09:00', name: 'Kado' },
      { time: '13:00', name: 'Privilege' },
      { time: '16:00', name: 'Monni' },
      { time: '18:15', name: 'Fortune Thursday' },
      { time: '21:00', name: 'Digital 21h' },
      { time: '22:00', name: 'Digital 22h' },
      { time: '23:00', name: 'Digital 23h' },
    ],
  },
  {
    day: 'Vendredi',
    draws: [
      { time: '07:00', name: 'Digital Reveil 7h' },
      { time: '08:00', name: 'Digital Reveil 8h' },
      { time: '09:00', name: 'Cash' },
      { time: '13:00', name: 'Solution' },
      { time: '16:00', name: 'Wari' },
      { time: '18:15', name: 'Friday Bonanza' },
      { time: '21:00', name: 'Digital 21h' },
      { time: '22:00', name: 'Digital 22h' },
      { time: '23:00', name: 'Digital 23h' },
    ],
  },
  {
    day: 'Samedi',
    draws: [
      { time: '01:00', name: 'Special Weekend 1h' },
      { time: '03:00', name: 'Special Weekend 3h' },
      { time: '07:00', name: 'Digital Reveil 7h' },
      { time: '08:00', name: 'Digital Reveil 8h' },
      { time: '09:00', name: 'Soutra' },
      { time: '13:00', name: 'Diamant' },
      { time: '16:00', name: 'Moaye' },
      { time: '18:15', name: 'National' },
      { time: '21:00', name: 'Digital 21h' },
    ],
  },
  {
    day: 'Dimanche',
    draws: [
      { time: '01:00', name: 'Special Weekend 1h' },
      { time: '03:00', name: 'Special Weekend 3h' },
      { time: '07:00', name: 'Digital Reveil 7h' },
      { time: '08:00', name: 'Digital Reveil 8h' },
      { time: '09:00', name: 'Benediction' },
      { time: '13:00', name: 'Prestige' },
      { time: '16:00', name: 'Awale' },
      { time: '18:15', name: 'Espoir' },
      { time: '21:00', name: 'Digital 21h' },
    ],
  },
];

export const getBallColorClass = (num: number): string => {
  if (num >= 1 && num <= 9) return 'bg-white text-gray-900 border border-gray-300';
  if (num >= 10 && num <= 19) return 'bg-blue-900 text-white'; // Bleu foncé
  if (num >= 20 && num <= 29) return 'bg-green-800 text-white'; // Vert foncé
  if (num >= 30 && num <= 39) return 'bg-indigo-600 text-white'; // Indigo
  if (num >= 40 && num <= 49) return 'bg-yellow-600 text-white'; // Jaune foncé
  if (num >= 50 && num <= 59) return 'bg-pink-500 text-white'; // Rose
  if (num >= 60 && num <= 69) return 'bg-orange-500 text-white'; // Orange
  if (num >= 70 && num <= 79) return 'bg-gray-500 text-white'; // Gris
  if (num >= 80 && num <= 90) return 'bg-red-600 text-white'; // Rouge
  return 'bg-gray-200 text-gray-500'; // Default
};
