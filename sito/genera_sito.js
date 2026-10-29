#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const SITO = __dirname;
const ROOT = path.dirname(SITO);
const DOCUMENTI = path.join(ROOT, "documenti");
const OUT = path.join(ROOT, "_site");

// Titoli leggibili dei documenti; per i nomi non presenti il titolo si ricava dal nome del file.
const TITOLI = {
  LetteraDiPresentazione: "Lettera di Presentazione",
  ValutazioneCapitolati: "Valutazione dei capitolati",
  DichiarazioneImpegni: "Dichiarazione degli impegni",
  NormeDiProgetto: "Norme di Progetto",
  PianoDiProgetto: "Piano di Progetto",
  PianoDiQualifica: "Piano di Qualifica",
  AnalisiDeiRequisiti: "Analisi dei Requisiti",
  Glossario: "Glossario",
  SpecificaTecnica: "Specifica Tecnica",
  ManualeUtente: "Manuale Utente",
  DiarioDiBordo: "Diario di bordo",
};

const RE_VERSIONE = /^(?<nome>[A-Za-z]+)_v(?<v>\d+\.\d+\.\d+)\.pdf$/;
const RE_DATA = /^(?<nome>[A-Za-z]+)_(?<d>\d{4}-\d{2}-\d{2})\.pdf$/;
const RE_VERBALE = /^(?<tipo>VI|VE)_(?<d>\d{4}-\d{2}-\d{2})(?:_(?<chi>[A-Za-z]+))?\.pdf$/;

/** Segnala un problema; nelle GitHub Actions compare come avviso nel riepilogo. */
function avviso(msg, file) {
  if (process.env.GITHUB_ACTIONS) {
    console.log(file ? `::warning file=${file}::${msg}` : `::warning::${msg}`);
  } else {
    console.log(`ATTENZIONE: ${msg}` + (file ? ` (${file})` : ""));
  }
}

function aaaammgg(d) {
  const due = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function confronta(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function titoloDaNome(nome) {
  if (nome in TITOLI) return TITOLI[nome];
  const parole = nome.replace(/(?<!^)(?=[A-Z])/g, " ").split(/\s+/).filter(Boolean);
  const testo = parole.length
    ? [parole[0], ...parole.slice(1).map((p) => p.toLowerCase())].join(" ")
    : nome;
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

/** Percorso relativo alla radice del repository, sempre con «/». */
function relativo(p) {
  return path.relative(ROOT, p).split(path.sep).join("/");
}

/** Data dell'ultimo commit che ha modificato il file (AAAA-MM-GG). */
function dataUltimaModifica(percorso) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", percorso], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out) return out;
  } catch {
    // git non disponibile o cartella fuori da un repository: si usa la data del file
  }
  return aaaammgg(fs.statSync(percorso).mtime);
}

function pdfIn(cartella) {
  const d = path.join(DOCUMENTI, cartella);
  if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) return [];
  return fs
    .readdirSync(d, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".pdf"))
    .map((e) => e.name)
    .sort()
    .map((nome) => path.join(d, nome));
}

function url(p) {
  return relativo(p).split("/").map(encodeURIComponent).join("/");
}

/** Per ogni documento tiene solo la versione più alta. */
function documentiVersionati(cartella) {
  const migliori = new Map();
  const maggiore = (a, b) => {
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return false;
  };
  for (const p of pdfIn(cartella)) {
    const nomeFile = path.basename(p);
    const m = nomeFile.match(RE_VERSIONE);
    let nome, versione;
    if (!m) {
      avviso(`nome non conforme, atteso NomeDocumento_vX.Y.Z.pdf: ${nomeFile}`, relativo(p));
      nome = path.basename(p, ".pdf");
      versione = [0, 0, 0];
    } else {
      nome = m.groups.nome;
      versione = m.groups.v.split(".").map(Number);
    }
    if (!migliori.has(nome) || maggiore(versione, migliori.get(nome).versione)) {
      migliori.set(nome, { p, versione });
    }
  }
  const voci = [];
  for (const [nome, { p, versione }] of migliori) {
    const data = dataUltimaModifica(p);
    const conVersione = versione.some((x) => x !== 0);
    voci.push({ titolo: titoloDaNome(nome), file: url(p), versione: conVersione ? `v${versione.join(".")}` : "", data });
  }
  return voci.sort((a, b) => confronta(b.data, a.data) || confronta(b.titolo, a.titolo));
}

function documentiDatati(cartella, regex = RE_DATA, titolo = null) {
  const voci = [];
  for (const p of pdfIn(cartella)) {
    const nomeFile = path.basename(p);
    const m = nomeFile.match(regex);
    let d, t;
    if (!m) {
      avviso(`nome non conforme: ${nomeFile}`, relativo(p));
      d = dataUltimaModifica(p);
      t = titoloDaNome(path.basename(p, ".pdf"));
    } else {
      d = m.groups.d;
      t = titolo ? titolo(m.groups) : titoloDaNome(m.groups.nome);
    }
    voci.push({ titolo: t, file: url(p), data: d, conforme: Boolean(m) });
  }
  return voci.sort((a, b) => confronta(b.data, a.data) || confronta(b.titolo, a.titolo));
}

const NUOVA_SCHEDA = '<span class="solo-lettori"> (si apre in una nuova scheda)</span>';

function attributiLink(v, titolo) {
  return `href="${escapeHtml(v.file)}" target="_blank" rel="noopener" title="${escapeHtml(titolo)}"`;
}

function data(d) {
  return `<time datetime="${escapeHtml(d)}">${escapeHtml(d)}</time>`;
}

/** Riga di un documento: nome, eventuale versione, data. */
function voceDocumento(v) {
  const versione = v.versione ? `<span class="doc-versione">${escapeHtml(v.versione)}</span>` : "";
  return (
    `<a class="doc" ${attributiLink(v, v.titolo)}>` +
    '<span class="doc-nodo" aria-hidden="true"></span>' +
    `<span class="doc-nome">${escapeHtml(v.titolo)}</span>` +
    `<span class="doc-dati">${versione}<span class="doc-data">${data(v.data)}</span></span>` +
    `${NUOVA_SCHEDA}</a>`
  );
}

function elenco(voci, vuoto) {
  if (!voci.length) return vuoto ? `<p class="vuoto">${vuoto}</p>` : "";
  return '<ul class="elenco">' + voci.map((v) => `<li>${voceDocumento(v)}</li>`).join("") + "</ul>";
}

/** Sottogruppo con titolo, mostrato solo se contiene documenti. */
function gruppo(titolo, voci) {
  return voci.length ? `<h4>${escapeHtml(titolo)}</h4>` + elenco(voci, "") : "";
}

/** Verbali: linea del tempo, dal più recente. */
function lineaDelTempo(voci, vuoto) {
  if (!voci.length) return `<p class="vuoto">${vuoto}</p>`;
  const righe = voci.map((v) => {
    const nome = v.titolo;
    return (
      `<li><a class="evento" ${attributiLink(v, `${nome} del ${v.data}`)}>` +
      `${data(v.data)}<span class="evento-nome">${escapeHtml(nome)}</span>${NUOVA_SCHEDA}</a></li>`
    );
  });
  return '<ol class="tempo">' + righe.join("") + "</ol>";
}

/** Diari di bordo: una tappa per settimana, dalla più recente. */
function binario(voci, vuoto) {
  if (!voci.length) return `<p class="vuoto">${vuoto}</p>`;
  const righe = voci.map((v) => {
    const nome = v.conforme ? `Diario di bordo del ${v.data}` : v.titolo;
    return (
      `<li><a class="tappa" ${attributiLink(v, nome)}>` +
      `<span class="solo-lettori">Diario di bordo del </span>${data(v.data)}${NUOVA_SCHEDA}</a></li>`
    );
  });
  return '<ol class="binario">' + righe.join("") + "</ol>";
}

/** La Lettera di Presentazione più recente in evidenza; le precedenti in un elenco richiudibile. */
function bloccoLettere(voci) {
  if (!voci.length) return '<p class="vuoto">Nessuna Lettera di Presentazione pubblicata.</p>';
  const [ultima, ...precedenti] = voci;
  let out =
    `<a class="lettera" ${attributiLink(ultima, ultima.titolo)}>` +
    `<span class="lettera-titolo">${escapeHtml(ultima.titolo)}</span>` +
    `<span class="lettera-data">${data(ultima.data)}</span>` +
    `<span class="lettera-azione">Apri la lettera</span>${NUOVA_SCHEDA}</a>`;
  if (precedenti.length) {
    out +=
      `<details class="precedenti"><summary>Lettere precedenti (${precedenti.length})</summary>` +
      elenco(precedenti, "") + "</details>";
  }
  return out;
}

/** Copia ricorsiva di una cartella, saltando i file .gitkeep. */
function copiaCartella(da, a) {
  fs.mkdirSync(a, { recursive: true });
  for (const e of fs.readdirSync(da, { withFileTypes: true })) {
    if (e.name === ".gitkeep") continue;
    const sorgente = path.join(da, e.name);
    const destinazione = path.join(a, e.name);
    if (e.isDirectory()) copiaCartella(sorgente, destinazione);
    else if (e.isFile()) fs.copyFileSync(sorgente, destinazione);
  }
}

function main() {
  const lettere = documentiDatati("lettere-di-presentazione");
  const gestionali = documentiVersionati("esterni/gestionali");
  const tecnici = documentiVersionati("esterni/tecnici");
  const interni = documentiVersionati("interni");
  const verbale = (tipo) => (g) => `Verbale ${tipo}` + (g.chi ? ` con ${g.chi}` : "");
  const verbaliE = documentiDatati("verbali/esterni", RE_VERBALE, verbale("esterno"));
  const verbaliI = documentiDatati("verbali/interni", RE_VERBALE, verbale("interno"));
  const diari = documentiDatati("diari-di-bordo", RE_DATA, (g) => `Diario di bordo ${g.d}`);

  const sostituzioni = {
    "{{LETTERA}}": bloccoLettere(lettere),
    "{{ESTERNI}}":
      gruppo("Gestionali", gestionali) + gruppo("Tecnici", tecnici) ||
      elenco([], "Nessun documento esterno pubblicato."),
    "{{INTERNI}}": elenco(interni, "Nessun documento interno pubblicato."),
    "{{VERBALI_ESTERNI}}": lineaDelTempo(verbaliE, "Nessun verbale esterno pubblicato."),
    "{{VERBALI_INTERNI}}": lineaDelTempo(verbaliI, "Nessun verbale interno pubblicato."),
    "{{DIARI}}": binario(diari, "Nessun diario di bordo pubblicato."),
    "{{AGGIORNATO}}": fs.existsSync(DOCUMENTI) ? dataUltimaModifica(DOCUMENTI) : aaaammgg(new Date()),
  };
  let pagina = fs.readFileSync(path.join(SITO, "modello.html"), "utf8");
  for (const [segnaposto, valore] of Object.entries(sostituzioni)) {
    pagina = pagina.split(segnaposto).join(valore);
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT);
  fs.writeFileSync(path.join(OUT, "index.html"), pagina, "utf8");
  copiaCartella(path.join(SITO, "assets"), path.join(OUT, "assets"));
  if (fs.existsSync(DOCUMENTI)) copiaCartella(DOCUMENTI, path.join(OUT, "documenti"));

  const totale = [lettere, gestionali, tecnici, interni, verbaliE, verbaliI, diari]
    .reduce((n, l) => n + l.length, 0);
  console.log(`Sito generato in ${relativo(OUT)}/ con ${totale} documenti pubblicati.`);
}

main();
