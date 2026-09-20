# Первый конвейер BuildY: SiteStarter

Дата: 2026-09-21. Статус: **проект плана для принятия**.
Это план извлечения, не опубликованный registry и не готовые адаптеры.
Исходные commit и находки: `fw/.project/conveyor-intake.md` в соседнем репозитории.
Состояние upstream не проверялось. Версии из локальных README не считаются
доказательством доступности или качества опубликованных пакетов.

## Результат

Студия выбирает профиль и получает локальный проект со своим кодом,
зафиксированными зависимостями, воспроизводимой сборкой, контекстом для агента
и проверками. FWYML не знает слов blog, shop, Codex, Templ или UI8Kit.

Граница ответственности:

- `fw`: форматы композиции, наблюдаемые контракты, версии и conformance.
- `fwyml`: разрешение графа, проверка совместимости, получение источников,
  владение файлами, запуск выбранных инструментов и диагностика.
- Внешний BuildY registry: поддерживаемые сочетания, immutable pins,
  генераторы, валидаторы, правила и продуктовые профили.
- Проект студии: выбранные типы данных, маршруты, страницы, дизайн и расширения.
- Codex: единственный контракт данных и runtime SoT для данного семейства.
- UI8Kit Codegen: определения примитивов, utils, семантика DOM и emitters.
  UI8Kit Registry: готовый digest для установки. Это отдельный формат от FW
  registry; связать их должен внешний адаптер, а не общий парсер CLI.

Независимость от стека означает отсутствие обязательного стека и правил
по именам продуктов. Знание формата package.json/go.mod сейчас остаётся
ограниченной встроенной возможностью CLI. Новые языки сначала поставляют
полные файлы манифестов и внешние генераторы. Не добавлять по одному renderer
в ядро на каждый язык; унификацию существующих Go/npm renderers провести
отдельно после доказанного рабочего конвейера.

## Постоянные и выбираемые требования

Во внешнем профиле BuildY обязательны UI8Kit primitives + utils + rules,
исполняемая проверка Retag и HTML5-семантики, строгая проверка Codex manifest
и данных. Нельзя случайно снять их снятием optional-флага. Профиль включает
их через dependencies/quality и проверяет состав до сборки.

ARIA здесь разделяется на базовую корректность семантического HTML и
выбираемый пакет интерактивного поведения. Не удалять уже корректные
атрибуты примитивов при отказе от behavior-пакета. Строгая UI8px-проверка —
отдельный выбранный валидатор. Отсутствие UI означает headless-профиль:
там не должно быть фиктивного набора UI-зависимостей.

`post`, `page`, `portfolio`, `product`, `tenant` — пользовательские схемы
Codex, не enum ядра FW. Схема должна фиксировать vocabulary, обязательность,
локализацию, вложенность и версии миграций. Tenant-модель не равна
реализации tenant isolation: маршрутизация и авторизация требуют отдельного
контракта при появлении соответствующего продукта.

SSR, SPA, PWA и аналогичные характеристики — требования к внешним записям
и совместимости. Это не взаимоисключающий enum универсального core: например,
PWA может включать SSR. Не проектировать заранее все сочетания языков и БД.

## Минимальная поставка

Первыми собрать четыре конфигурации на одной доказанной связке SQLite/Codex:

1. **site-db**: страницы, настройки, меню, Templ BFF; нет post, admin,
   markdown-авторинга и content-sync.
2. **blog-db**: site-db + post и маршруты списка/детали; нет admin и markdown.
3. **blog-markdown**: blog-db + content/ и отдельный content-sync; runtime
   читает Codex, а не markdown. Seed — производный артефакт.
4. **headless-db**: Codex manifest и запуск pinned backend; нет BFF, Templ,
   kit, UI-зависимостей, маршрутов сайта, admin или markdown.

После них:

- admin-варианты первых трёх — только после подписанного canonical bundle;
- landing — выбор страниц и собственного layout, без blog-кода;
- portfolio — после определения его kind/маршрутов в продукте;
- Postgres — после отдельного теста подключения, миграций и seed;
- shop — после настоящих catalog/cart/checkout контрактов. Существующий
  SiteStarter их не предоставляет, поэтому готовый shop не обещается.

Admin работает отдельным origin и поставляется подписанным готовым bundle.
Его исходники Svelte не становятся вторым UI runtime исходного Templ BFF.
Если нужен один исходный продукт с несколькими UI targets, сначала изменить
через ADR текущий контракт «один UI runtime», затем добавить conformance.
Local-colocate остаётся отдельным профилем; не включать его proxy в production BFF.

## Где живёт первый внешний registry

Предлагаемая authoring-площадка: SiteStarter `.project/.fw/registry/`.
Она внешняя относительно обоих core-репозиториев и владеет только этим
семейством сайтов. После стабилизации её можно вынести в отдельный репозиторий
без изменения схем или CLI. UI8Kit Registry остаётся registry примитивов.

Структура после принятия плана:

```text
.project/.fw/
  registry/index.yaml
  registry/records/          # adapters, tools, rules, ownership
  registry/artifacts/        # извлечённые малые модули, не копия всего сайта
  profiles/                 # site-db, blog-db, blog-markdown, headless-db
  tests/                    # CLI -> build -> HTTP -> removal
```

У каждой записи: точный источник, версия/commit, digest, зависимости,
экспортируемые файлы, владелец каждого файла, проверки и conformance receipt.
Пути к локальным checkout разрешены для разработки, но не для portable release.
Не помечать запись verified только для прохождения `verify --strict`.

## Разделение SiteStarter

Сначала написать тесты текущего поведения и отсутствия модулей; затем:

1. `internal/site/feature.go`, `content.go`: вынести post-маршруты, blog
   navigation, CTA и default copy в отдельный выбранный slice. Composition
   root формируется при сборке. Без post соответствующие исходники/импорты
   и пункты меню отсутствуют, а не скрыты веткой `if enabled`.
2. `internal/bff/handler.go`: принять собранный public handler. Сохранить
   CMS_BASE_URL как единственную связь с Codex; не подключать драйвер БД в BFF.
3. `cms/codex.manifest.json`: создавать из выбранных kinds одним внешним
   генератором. Несколько записей не должны независимо владеть этим файлом.
4. `internal/cms/manifest.go`: подключить/адаптировать canonical Codex
   schema validation. Отрицательные тесты: неизвестный тип поля, повторный
   nested id, неверный items, лишний JSON-ключ, некорректные localized values.
   Не выводить полную семантику Codex из одного локального Go struct.
5. `cmd/content-sync`, `internal/contentmd`, content fixtures и yaml.v3
   принадлежат markdown slice. Убрать неявное добавление menu в compileTargets:
   виды seed должны точно совпадать с выбранной схемой.
6. `internal/kit`: установить только выбранные Templ-примитивы и их utils
   через pinned UI8Kit digest либо воспроизводимый codegen adapter. Зафиксировать
   import module path; проверить несовпадения локального набора с 33 bricks.
7. `internal/ui`, `internal/views`, assets: layout и блоки отделить от
   продуктового текста и blog-only представлений. Шрифты/картинки копировать
   побайтово; CSS build получает только выбранные исходники.
8. `scripts`, package.json, go.mod и CI: один владелец агрегатных манифестов;
   профиль задаёт точные tools, сборку, Retag, опциональный UI8px, тесты.
9. Admin: сохранить существующий promotion protocol, origin и contract pin.
   Без admin отсутствуют bundle, receipt, promotion tooling и admin routes.

Не править GoBackend или FormSet ради этого конвейера. Не экспортировать
SiteStarter целиком как «template», иначе физическое отсутствие недоказуемо.

## Остаточные задачи компилятора до выпуска конвейера

В текущем проходе исправлены неявные языковые файлы, бинарные данные,
missing tools, порядок зависимостей, циклы/конфликты и document-relative paths.
Далее нужны отдельные контрактные задачи, а не реклама готового bootstrap:

- **Install/toolchain:** сейчас fetch получает Git, а npm/Go зависимости
  только декларируются. Спроектировать явную acquisition-фазу с immutable
  package locks/cache и проверкой prerequisites; обычные generate/verify
  не должны скрыто устанавливать пакеты. Windows npm .cmd требует корректного
  process adapter. Не считать текущую проверку npx полноценным installer.
- **Generated ownership:** command.outputs сейчас разрешает префиксы, но
  generated files не получают полноценные receipts/digests в lock. Нужны
  запись результата генерации, replay и удаление без потери пользовательских
  изменений. До этого удаление после generate нельзя считать доказанным.
- **Tree ownership:** текущий leftoverOwned классифицирует .go/src/internal
  по имени и может отвергать код пользователя или обходить node_modules.
  Заменить на exact ownership receipts + declared forbidden surfaces.
- **Integrity:** readiness/conformanceRefs — декларации. Проверять содержимое
  и связь receipt с конкретным source digest, версией suite и результатом;
  добавить source-cache tamper и checksum-negative тесты.
- **Paths:** защитить destination traversal, symlink escape и служебные файлы
  на всех write/delete путях. Покрыть rollback, прерывание и одинаковые targets.
- **Constraints:** hostFamilies/adapterConstraints и другие публичные поля
  либо проверять, либо явно исключить из обещаний alpha-схемы. Проверить
  caret semantics для major zero; не обещать полный SemVer без реализации.
- **Portable context:** сохраняемый fw.yaml с относительным registry source
  требует relocation-политики; пользователь должен запускать CLI из нового
  root без ссылки на исходный checkout автора.
- **Manifest aggregation:** owned go.mod/package.json и декларации зависимостей
  должны сверяться; файл нельзя считать совместимым лишь по наличию.

## Приёмка

Для каждого из четырёх начальных профилей pipeline на чистом каталоге:

1. validate -> resolve -> explicit fetch -> sync --dry-run -> sync.
2. Явная установка pinned prerequisites/dependencies по принятому acquisition
   контракту, generate, verify --strict, настоящая сборка Go/Templ/CSS.
3. Поднять pinned Codex и BFF из результата; проверить public страницы,
   unpublished-record rejection, типы/поля и отсутствие доступа BFF к БД.
4. Проверить точный список файлов, deps/imports, маршрутов и delivery assets.
   В site-db нет post/blog; в DB-only нет content-sync/yaml.v3/content;
   в headless нет cmd/starter/internal/kit/internal/views/templ/Node UI;
   без admin нет /admin и editor-origin proxy.
5. Повторить sync/generate: одинаковые owned bytes и lock без случайных
   абсолютных путей, времени или непинованных загрузок.
6. blog-markdown -> blog-db -> site-db: удалены все бывшие owned outputs,
   включая generated files; ручная правка вызывает конфликт и сохраняется.
7. Негативные проверки: неизвестный kind/field, несовместимый runtime,
   отсутствующий валидатор, неподписанный admin, drift источника, отсутствующий
   tool, изменённый бинарный asset, конфликт двух owners.

Матрица должна работать на Windows и Linux. Полная parity всех семи UI
runtime — отдельная проверка Codegen, не результат одной Templ-сборки.

## Порядок и граница принятия

Принять этот bounded scope; перенести intent/spec/plan в SiteStarter
`.sdlc/changes/fwyml-conveyor/` по его SDLC. Затем executable tests и исправления
оставшихся CLI gates, извлечение модулей и четыре профиля, полная приёмка.
Admin/Postgres/новые kinds идут после базовой матрицы и собственных receipts.

SiteStarter AGENTS.md требует принятого плана до auto-apply. Поэтому этот
документ подготовлен в extraction harness, а продуктовый код не изменён.
Публикация registry, CLI и любые production-действия в этот план не входят.
