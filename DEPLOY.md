# Деплой на GitHub Pages

Автодеплой уже настроен, но из-за ограничений GitHub App workflow файл нужно добавить вручную один раз.

## Вариант 1 - через UI (2 клика)
1. Открой https://github.com/AlfaGideon/TINVEST/settings/pages
2. Build and deployment → Source: **Deploy from a branch**
3. Branch: **main** → /(root) → Save
4. Через 30-60 сек сайт будет доступен: https://alfagideon.github.io/TINVEST/

## Вариант 2 - через Actions workflow (рекомендуется)
Создай файл `.github/workflows/pages.yml` через UI GitHub:

Перейди https://github.com/AlfaGideon/TINVEST/new/main?filename=.github/workflows/pages.yml

Вставь содержимое:

```yaml
name: Deploy TINVEST to Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - id: deployment
        uses: actions/deploy-pages@v4
```

Commit и Pages включится автоматически.

## Проверка
Открой https://alfagideon.github.io/TINVEST/ — должен загрузиться дашборд.

Если 404 — подожди 1 минуту и обнови.
