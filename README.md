# airc-vibe-page

Учебный starter AI Room Club для проекта типа «сайт, лендинг или анимационная статья».

[Use this template](https://github.com/FocusSam/airc-vibe-page/generate) · [Live demo](https://focussam.github.io/airc-vibe-page/) · [Release v1.0.0](https://github.com/FocusSam/airc-vibe-page/releases/tag/v1.0.0)

**Главный принцип:** сначала собери один рабочий сценарий на локальных данных. База, вход и инфраструктура появляются только тогда, когда без них уже нельзя.

Начни с `START_HERE.md`. Готовые команды для агента лежат в `docs/INSTALL_WITH_AGENT.md`.

## Быстрый запуск

Нужен Node.js 22 или новее. Рекомендуем Node.js 24 LTS.

```bash
npm run doctor
npm run check
npm run dev
```

Открой `http://127.0.0.1:4173`. Устанавливать npm-зависимости не нужно.

## Экраны

- `#/` — публичная страница и форма.
- `#/workspace` — список заявок владельца.
- `#/story` — пример длинной смысловой страницы.
- `#/styleguide` — визуальные правила.

## Режимы данных

**local** — режим по умолчанию. Записи живут в `localStorage` текущего браузера. Он подходит для обучения, прототипа и проверки сценария.

**supabase** — опциональный учебный режим. Настройка лежит в `docs/SUPABASE_SETUP.md`. Для продукта с персональными данными граждан РФ сначала прочитай `docs/RF_PRODUCTION.md` и получи профильную юридическую оценку.

## Что лежит в проекте

`PRODUCT.md`, `FLOW.md`, `DESIGN_SYSTEM.md` и `DATA_MODEL.md` хранят продуктовый контекст.

`AGENTS.md` читает Codex. `CLAUDE.md` читает Claude Code. Ядро правил у них одинаковое.

`DECISIONS.md` хранит важные решения. `TASKS.md` — ближайшие задачи.

`docs/` содержит инструкции по изменению проекта, данным, безопасности, публикации и работе с агентами.

## Публикация на GitHub Pages

В проект уже добавлен workflow `.github/workflows/pages.yml`.

1. Создай пустой репозиторий на GitHub.
2. Загрузи в его корень содержимое этой папки.
3. Открой `Settings → Pages`.
4. В поле `Source` выбери `GitHub Actions`.
5. Отправь изменение в ветку `main` или запусти workflow вручную.

Workflow сам выполнит `doctor`, `check`, `build` и опубликует папку `dist`. Подробности — в `docs/PUBLISH_STATIC.md`.

## Лицензия и происхождение

Starter распространяется по MIT-лицензии. Код написан для AI Room Club с нуля. В `THIRD_PARTY_NOTES.md` зафиксировано, что исходники `di-sukharev/vibe` не копировались.
