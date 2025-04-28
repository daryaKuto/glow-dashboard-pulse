
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('https://api.fungun.dev/stats/targets', () => {
    return HttpResponse.json({ online: 4, total: 6 });
  }),

  http.get('https://api.fungun.dev/stats/rooms', () => {
    return HttpResponse.json({ count: 3 });
  }),

  http.get('https://api.fungun.dev/stats/scenarios', () => {
    return HttpResponse.json({ count: 12 });
  }),

  http.get('https://api.fungun.dev/sessions/latest', () => {
    return HttpResponse.json({ score: 91, accuracy: 86 });
  }),

  http.get('https://api.fungun.dev/invites/pending', () => {
    return HttpResponse.json([
      { id: 1, from: "Alex" },
      { id: 2, from: "Sarah" }
    ]);
  }),

  http.get('https://api.fungun.dev/stats/hits', () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return HttpResponse.json(
      days.map(day => ({
        date: day,
        hits: Math.floor(Math.random() * 100)
      }))
    );
  }),
];
