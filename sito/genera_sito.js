#!/usr/bin/env node
/**
 * Genera il sito del gruppo 5ive Stars a partire dai PDF nella cartella documenti/.
 *
 * Uso: node sito/genera_sito.js   (il sito viene scritto in _site/)
 *
 * Cartelle e nomi dei file (Norme di Progetto, §3.1.8):
 *   documenti/lettere-di-presentazione/LetteraDiPresentazione_AAAA-MM-GG.pdf
 *   documenti/esterni/gestionali/NomeDocumento_vX.Y.Z.pdf
 *   documenti/esterni/tecnici/NomeDocumento_vX.Y.Z.pdf
 *   documenti/interni/NomeDocumento_vX.Y.Z.pdf
 *   documenti/verbali/esterni/VE_AAAA-MM-GG.pdf
 *   documenti/verbali/interni/VI_AAAA-MM-GG.pdf
 *   documenti/diari-di-bordo/DiarioDiBordo_AAAA-MM-GG.pdf
 * Di ogni documento versionato viene pubblicata solo la versione più alta.
 * Non servono dipendenze esterne: bastano Node.js e git.
 */
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
const RE_VERBALE = /^(?<tipo>VI|VE)_(?<d>\d{4}-\d{2}-\d{2})\.pdf$/;

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
    const meta = (conVersione ? `v${versione.join(".")} · ` : "") + data;
    voci.push({ titolo: titoloDaNome(nome), file: url(p), meta, ordine: data });
  }
  return voci.sort((a, b) => confronta(b.ordine, a.ordine) || confronta(b.titolo, a.titolo));
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
    voci.push({ titolo: t, file: url(p), meta: d, ordine: d });
  }
  return voci.sort((a, b) => confronta(b.ordine, a.ordine));
}

function voce(v, classe = "doc") {
  const t = escapeHtml(v.titolo);
  return (
    `<a class="${classe}" href="${escapeHtml(v.file)}" target="_blank" rel="noopener" title="${t}">` +
    `<span class="doc-name">${t}</span><span class="doc-meta">${escapeHtml(v.meta)}</span></a>`
  );
}

function elenco(voci, vuoto) {
  if (!voci.length) return `<ul class="docs"><li class="empty">${vuoto}</li></ul>`;
  return '<ul class="docs">' + voci.map((v) => `<li>${voce(v)}</li>`).join("") + "</ul>";
}

/** Sottogruppo con titolo, mostrato solo se contiene documenti. */
function gruppo(titolo, voci) {
  return voci.length ? `<h4>${escapeHtml(titolo)}</h4>` + elenco(voci, "") : "";
}

function bloccoLettere(voci) {
  if (!voci.length) return '<p class="empty">Nessuna lettera di presentazione pubblicata.</p>';
  let out = voce(voci[0], "doc doc-main");
  if (voci.length > 1) out += "<h3>Lettere precedenti</h3>" + elenco(voci.slice(1), "");
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
  const verbaliE = documentiDatati("verbali/esterni", RE_VERBALE, (g) => `Verbale esterno ${g.d}`);
  const verbaliI = documentiDatati("verbali/interni", RE_VERBALE, (g) => `Verbale interno ${g.d}`);
  const diari = documentiDatati("diari-di-bordo", RE_DATA, (g) => `Diario di bordo ${g.d}`);

  const sostituzioni = {
    "{{LETTERE}}": bloccoLettere(lettere),
    "{{ESTERNI}}":
      gruppo("Gestionali", gestionali) + gruppo("Tecnici", tecnici) ||
      elenco([], "Nessun documento pubblicato."),
    "{{INTERNI}}": elenco(interni, "Nessun documento pubblicato."),
    "{{VERBALI_ESTERNI}}": elenco(verbaliE, "Nessun verbale esterno pubblicato."),
    "{{VERBALI_INTERNI}}": elenco(verbaliI, "Nessun verbale interno pubblicato."),
    "{{DIARI}}": elenco(diari, "Nessun diario di bordo pubblicato."),
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
