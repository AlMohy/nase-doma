# Naše doma

Malá webová aplikace pro dva lidi v jedné domácnosti: nákupní lístek, domácí úkoly s férovým skóre,
otázka dne a rozhodovač („co k večeři / jaký film“). Česky i rusky, světlý i tmavý režim.

- Otevřít: **https://almohy.github.io/nase-doma/** → v Safari „Sdílet“ → „Přidat na plochu“.
- Žádný účet, žádné reklamy, žádné knihovny. Data jsou v telefonu; sdílení mezi dvěma telefony
  se zapne vlastní bezplatnou databází (Firebase Realtime Database), návod je v aplikaci v záložce **Víc**.
- Funguje i bez signálu (service worker).

Soubory: `index.html`, `app.js` (obrazovky), `sync.js` (data a sdílení), `preklady.js` (cs + ru),
`otazky.js` (otázky dne), `app.css`, `sw.js`, `manifest.webmanifest`, `ikony/`.
