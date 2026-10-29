# 5ive Stars – Documentazione

Repository dei documenti del gruppo **5ive Stars** (Gruppo 5), progetto didattico di Ingegneria del Software, Università degli Studi di Padova, A.A. 2026/2027.

I documenti sono consultabili sul sito del gruppo: https://5ivestars.github.io/docs/

## Struttura del repository

```
docs/
├── .github/
│   └── workflows/
│       └── pubblica-sito.yml        GitHub Action che genera e pubblica il sito
├── documenti/                       solo i PDF approvati
│   ├── lettere-di-presentazione/    Lettere di Presentazione
│   ├── esterni/
│   │   ├── gestionali/              Valutazione dei capitolati, Dichiarazione degli impegni,
│   │   │                            Piano di Progetto, Piano di Qualifica
│   │   └── tecnici/                 Analisi dei Requisiti, Specifica Tecnica, Manuale Utente
│   ├── interni/                     Norme di Progetto, Glossario
│   ├── verbali/
│   │   ├── esterni/                 verbali con proponente e committente
│   │   └── interni/                 verbali delle riunioni del gruppo
│   └── diari-di-bordo/              diari di bordo in PDF
├── sito/                            codice del sito
│   ├── genera_sito.js               genera la pagina a partire da documenti/
│   ├── modello.html                 modello della pagina
│   └── assets/                      foglio di stile, font Poppins, logo (chiaro e scuro) e icona
├── README.md
└── .gitignore
```

La suddivisione dei documenti segue il regolamento del progetto didattico: documentazione esterna (gestionale e tecnica), documentazione interna e verbali.

## Nomi dei file

| Cartella | Nome del file |
|---|---|
| `lettere-di-presentazione/` | `LetteraDiPresentazione_AAAA-MM-GG.pdf` |
| `esterni/gestionali/`, `esterni/tecnici/`, `interni/` | `NomeDocumento_vX.Y.Z.pdf` |
| `verbali/esterni/` | `VE_AAAA-MM-GG.pdf`; con più incontri esterni nello stesso giorno `VE_AAAA-MM-GG_Azienda.pdf` (per esempio `VE_2026-10-28_Halue.pdf`) |
| `verbali/interni/` | `VI_AAAA-MM-GG.pdf` |
| `diari-di-bordo/` | `DiarioDiBordo_AAAA-MM-GG.pdf` |

## Pubblicare un documento

1. Il documento viene verificato e approvato secondo le Norme di Progetto.
2. Il PDF viene caricato nella cartella giusta di `documenti/`, anche dal sito di GitHub (**Add file → Upload files**).
3. La GitHub Action **Pubblica sito** rigenera e pubblica il sito in uno o due minuti; l'avanzamento si vede nella scheda **Actions**.

Regole applicate dal sito:

- in ogni sezione i documenti sono elencati dal più recente al più vecchio;
- la Lettera di Presentazione più recente compare in cima alla pagina;
- di ogni documento versionato compare solo la versione più alta (conviene comunque rimuovere dalla cartella la versione precedente);
- un file con un nome non conforme viene pubblicato lo stesso, ma l'Action lo segnala con un avviso.

Per vedere il sito in locale serve Node.js (versione 18 o successiva, nessuna dipendenza da installare): `node sito/genera_sito.js`, poi aprire `_site/index.html`. Il sito non usa servizi esterni per i caratteri: Poppins è incluso in `sito/assets/fonts/`; le foto del gruppo vengono dai profili GitHub.

## Contatti

5ive.stars.swe@gmail.com
