# Student Flow

Реальний вебдодаток для студентської групи на `Next.js + Supabase`: староста керує груповими задачами, оголошеннями, розкладом і посиланнями, а кожен студент має власний акаунт і персональний планер.

## Що вже працює

- реєстрація і вхід через `Supabase Auth`
- автоматичне створення профілю після реєстрації
- перший зареєстрований користувач отримує роль старости
- групові задачі для всієї групи або окремого студента
- особисті задачі для кожного користувача
- оголошення для всієї групи
- корисні посилання: `Google Drive`, `Zoom`, `Moodle`, `Telegram`, конспекти
- розклад на тиждень
- темна тема
- адаптація під телефон

## Як запустити

1. Встанови залежності:

```bash
npm install
```

2. Створи файл `.env.local` і додай:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

3. У Supabase відкрий `SQL Editor` і встав вміст файлу:

[schema.sql](/Users/veronikachepil/Documents/New%20project/supabase/schema.sql)

4. Запусти сайт:

```bash
npm run dev
```

5. Відкрий:

`http://localhost:3000`

## Важливо

- якщо в Supabase увімкнене `Confirm email`, після реєстрації треба підтвердити пошту
- перший користувач стає старостою автоматично
- таблиці і доступи вже описані через `RLS policies`

## Структура

- [app/page.js](/Users/veronikachepil/Documents/New%20project/app/page.js): уся логіка інтерфейсу, auth і CRUD
- [lib/supabase.js](/Users/veronikachepil/Documents/New%20project/lib/supabase.js): створення Supabase client
- [supabase/schema.sql](/Users/veronikachepil/Documents/New%20project/supabase/schema.sql): таблиці, тригери, ролі, політики
