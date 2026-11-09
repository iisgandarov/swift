/** Short original motivational lines (az / en), one per day. */
export const QUOTES: { az: string; en: string }[] = [
  { az: "Bugünkü nizam-intizam, sabahkı azadlığı yaradır.", en: "Discipline today creates freedom tomorrow." },
  { az: "Kiçik addımlar, böyük irəliləyiş.", en: "Small steps, big progress." },
  { az: "Başlamaq üçün mükəmməl olmaq lazım deyil.", en: "You don't have to be perfect to begin." },
  { az: "Bir tapşırıq bitir, sonra növbətiyə keç.", en: "Finish one thing, then move to the next." },
  { az: "Diqqət ən dəyərli resursundur.", en: "Attention is your most valuable resource." },
  { az: "Planlı gün, sakit ağıl.", en: "A planned day is a calm mind." },
  { az: "Bu gün atdığın addım sabahını formalaşdırır.", en: "Today's step shapes your tomorrow." },
  { az: "Əhəmiyyətli olanı əvvəl et.", en: "Do what matters first." },
  { az: "Sürət deyil, davamlılıq qazandırır.", en: "Consistency wins, not speed." },
  { az: "Yazdığın plan, ağlında daşıdığın yükdən yüngüldür.", en: "A written plan weighs less than one you carry in your head." },
  { az: "Hər tamamlanan iş yeni enerji verir.", en: "Every finished task gives you new energy." },
  { az: "Az, amma dərin işlə.", en: "Work on less, but go deeper." },
  { az: "Gününü sən idarə et, gün səni yox.", en: "Run your day, or it will run you." },
  { az: "İndi başla, sonra mükəmməlləşdir.", en: "Start now, refine later." },
  { az: "Fokus — \"yox\" deməyi bacarmaqdır.", en: "Focus is the art of saying no." },
  { az: "Dünən bitdi, sabah gəlməyib — bu gün səninlədir.", en: "Yesterday is done, tomorrow isn't here — today is yours." },
  { az: "Böyük məqsədlər kiçik tapşırıqlarla gerçəkləşir.", en: "Big goals are reached through small tasks." },
  { az: "Dincəlmək də planın bir hissəsidir.", en: "Rest is part of the plan too." },
  { az: "Bir saat fokus, bir gün dağınıqlıqdan güclüdür.", en: "One focused hour beats a scattered day." },
  { az: "Ritmini tap, sonra onu qoru.", en: "Find your rhythm, then protect it." },
  { az: "Sadə plan, güclü icra.", en: "Simple plan, strong execution." },
  { az: "Bitirilmiş iş, mükəmməl plandan yaxşıdır.", en: "Done is better than a perfect plan." },
  { az: "Hər səhər yeni başlanğıcdır.", en: "Every morning is a fresh start." },
  { az: "Vaxtını ver, nəticəni al.", en: "Give it your time, get your results." },
  { az: "Aydın hədəf, asan yol.", en: "Clear goal, easier path." },
  { az: "Özünə verdiyin sözü tut.", en: "Keep the promises you make to yourself." },
  { az: "Bir az hər gün, çox şey bir ildə.", en: "A little every day becomes a lot in a year." },
  { az: "Qarışıqlıqdan əvvəl prioritetlərini seç.", en: "Choose your priorities before the noise does." },
  { az: "Gücünü vacib olana sərf et.", en: "Spend your energy on what's important." },
  { az: "İrəli, hər dəfə bir addımla.", en: "Forward, one step at a time." },
];

export function quoteOfTheDay(localDate: string) {
  const [y, m, d] = localDate.split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return QUOTES[dayNumber % QUOTES.length];
}
