# Kto gdzie siedzi

Plan biura, na którym każdy zakłada swój profil (imię i nazwisko, ikonka albo zdjęcie) i klika kółko, przy którym siedzi. Najechanie na kółko pokazuje, kto tam siedzi. Zmiany widać u wszystkich na żywo.

Nikt nie zakłada kont ani nie loguje się: po wejściu na stronę wystarczy wpisać imię i nazwisko. Dane trzyma Firebase (projekt `hub-poznan`), a stronę hostuje GitHub Pages. Nic nie trzeba instalować.

## Pliki

| Plik | Do czego |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | sama aplikacja |
| `firebase-config.js` | dane projektu Firebase (już wpisane) |
| `firestore.rules` | reguły bazy: każdy zapisuje tylko własny profil |

## Uruchomienie krok po kroku

### 1. W konsoli Firebase (https://console.firebase.google.com, projekt `hub-poznan`)

**Logowanie anonimowe**
1. Menu po lewej: **Build → Authentication → Get started**.
2. Zakładka **Sign-in method**, wybierz **Anonymous**.
3. Przesuń przełącznik **Enable** na włączony i kliknij **Save**.

**Baza danych**
1. Menu po lewej: **Build → Firestore Database → Create database**.
2. Lokalizacja `eur3 (europe-west)`, tryb **production mode**. Jeśli zapyta o wersję, wybierz **Standard**.
3. Zakładka **Rules**: zaznacz cały tekst (Ctrl+A), usuń, wklej całą zawartość pliku `firestore.rules` (otwórz go w Notatniku) i kliknij **Publish**.

### 2. GitHub Pages
1. Na github.com utwórz nowe repozytorium.
2. Kliknij **Add file → Upload files** i przeciągnij tam pliki z tego folderu, a potem **Commit changes**.
3. **Settings → Pages → Build and deployment**: źródło **Deploy from a branch**, gałąź `main`, folder `/ (root)`, **Save**.
4. Po minucie strona działa pod adresem `https://TWOJLOGIN.github.io/NAZWA-REPOZYTORIUM/`. Link wyślij reszcie biura.

### 3. Pierwsze użycie
Otwórz stronę, wpisz imię i nazwisko, wybierz obrazek, kliknij wolne kółko. Każdy robi to sam na swoim urządzeniu.

## Dobrze wiedzieć
- **Profil jest przypisany do przeglądarki.** Jeśli ktoś otworzy stronę na drugim urządzeniu albo wyczyści dane przeglądarki, zrobi nowy profil, a stary zostanie na liście. Stary profil usuwa się z jego przeglądarki przyciskiem „Usuń profil”. W razie potrzeby administrator może usunąć dokument w Firestore Database (kolekcja `profiles`).
- **Jedyną ochroną jest link.** Kto go ma, może wejść i założyć profil, więc nie publikuj go w internecie.
- Błąd „Włącz logowanie anonimowe” na stronie oznacza, że nie zrobiłeś kroku z logowaniem anonimowym. Jeśli mimo włączenia dalej nie działa, dodaj domenę strony w **Authentication → Settings → Authorized domains** (np. `TWOJLOGIN.github.io`).
- Klucz `apiKey` w `firebase-config.js` nie jest hasłem i może być publiczny. Dostępu do danych pilnują reguły z `firestore.rules`.
- Podgląd lokalny: `python3 -m http.server` w folderze z plikami i adres `http://localhost:8000`. Dwuklik na `index.html` nie zadziała, bo przeglądarka blokuje wtedy moduły.
- Zdjęcia są zmniejszane do 112 px i zapisują się w profilu. Przy kilkudziesięciu osobach darmowy plan Firebase w zupełności wystarcza.
- Układ pokoi jest w `app.js`, w tablicy `ROOMS` na początku pliku.
