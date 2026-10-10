# TUBES AI Store

RFQ-магазин по украинскому каталогу `informatsiya-pro-produkt-v-elektronnomu-formati.pdf`.

## Что уже работает

- 1 736 карточек, 430 категорий и 52 686 индексов из 1 737 страниц PDF;
- 2 394 фотографии продукции, вырезанные по границам графических объектов PDF;
- 3 491 таблица и 50 477 строк характеристик с активными индексами;
- украинские описания из исходного каталога;
- поиск, фильтрация по исходным разделам и страницы товаров;
- сохранение позиции в локальный список запроса цены;
- экспертный API с поиском по полному тексту каталога;
- AI використовує лише сторінки каталогу TUBES International і показує посилання на PDF;
- при наличии `OPENAI_API_KEY` ответы формирует OpenAI Responses API; без ключа работает безопасный резервный режим.

## Запуск

```bash
npm install
copy .env.example .env.local
npm run dev
```

Відкрийте `http://localhost:3000`. Для перевірки на тому самому порту, що використовується в тестах: `npm run dev -- -p 3210`.

## Перевірка

Після запуску сервера на `http://localhost:3210`:

```bash
npm run test:integrity
npm run test:catalog
npm run test:search
npm run test:assistant
npm run test:security
```

`npm run test:e2e` додатково потребує встановлений пакет Playwright або шлях до нього через `NODE_PATH`.

## Повторный импорт каталога

```bash
python -m pip install pymupdf pillow
python scripts/import_catalog.py "D:\путь\к\informatsiya-pro-produkt-v-elektronnomu-formati.pdf"
python scripts/render_catalog_images.py "D:\путь\к\informatsiya-pro-produkt-v-elektronnomu-formati.pdf" --force
```

Импорт обновляет `src/data/catalog-index.json` и `src/data/catalog-content.json`.

## AI-ілюстрації товарів (OpenAI gpt-image-1)

Скрипт генерує зображення для товарів без фото з PDF і зберігає їх у `public/ai-products/`, маніфест — `src/data/ai-images.json`. На сайті такі картинки позначені «AI» та підписом, що це не фото продукції.

```bash
npm run images:generate -- --dry-run                 # список товарів і приклад промпта, без запитів
npm run images:generate                              # усі товари без фото (≈28 шт.)
npm run images:generate -- --slug corroflon-p409 --force --quality high
npm run images:generate -- --edit --slug <slug>      # очистити наявне фото з PDF (фон, артефакти)
```

Параметри: `--limit N`, `--quality low|medium|high` (за замовчуванням medium), `--size 1024x1024|1536x1024|1024x1536`, `--concurrency 1..5`. Після генерації закомітьте `public/ai-products/*.webp` і `src/data/ai-images.json`.

## Переменные окружения

- `OPENAI_API_KEY` — секретный ключ OpenAI, хранить только на сервере;
- `OPENAI_MODEL` — модель Responses API, по умолчанию `gpt-5.4-mini`;
- `OPENAI_IMAGE_MODEL` — модель генерації зображень, за замовчуванням `gpt-image-1`.

## Ограничения источника

Каталог не містить актуальних цін або складських залишків. Система показує кандидатів, сторінки-джерела та параметри, яких бракує, але вимагає підтвердження інженером за актуальною документацією виробника. Для хімічної сумісності використовуються лише прямо наведені в каталозі дані, зокрема таблиця на сторінці 157.
