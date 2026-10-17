# Sartoria · Storyline del pitch

> Dal bozzetto a una decisione di produzione in 10 giorni, senza campione fisico.

---

## 1. Il problema

Oggi una maison scopre se una borsa piace solo dopo averla prodotta.

Prima paga i campioni fisici (di solito tre giri), lo shooting e il primo ordine al produttore. Passano circa sei mesi e si spendono oltre 160 mila euro su un'idea che nessun cliente ha ancora visto.

Se poi la borsa non vende, finisce in saldo. Se vende più del previsto, mancano i pezzi.

**Il messaggio:** si decide quanto produrre senza sapere cosa vuole il cliente.

---

## 2. L'idea

Invertiamo l'ordine: **prima chiediamo al mercato, poi produciamo.**

Per chiedere al mercato non serve il campione. Servono immagini e video credibili, fedeli al prodotto e allo stile del brand, da mettere davanti ai clienti veri.

Sartoria li crea partendo da un semplice bozzetto.

---

## 3. Il viaggio di un prodotto

Seguiamo un solo prodotto dall'inizio alla fine: la **Cabas Cognac**, una tote in pelle di un brand milanese.

### Tappa 0 · Il brand si presenta

Il brand carica il suo **documento di identità aziendale** (brand book, linee guida, manifesto), anche in PDF o scansione. **Evolus AI** lo legge e lo riassume, e Sartoria ne ricava le caratteristiche del brand: manifesto, valori, tono di voce, palette con i codici colore, materiali, codici di design e cose che il brand non fa mai.

Da lì in poi ogni prodotto viene scritto dentro questi confini: niente loghi esterni se il brand non li usa, solo i suoi materiali e i suoi colori.

### Tappa 1 · Il bozzetto diventa un prodotto del brand

Il designer carica un bozzetto e scrive due righe di brief. Il sistema legge i vincoli (misure, colore, chiusura, manici) e li fissa nella "carta d'identità" del prodotto: il suo **DNA**.

Il prodotto viene disegnato con **Qwen Image 2.1**, un modello di immagini open source. Essendo open, possiamo **addestrarlo sullo stile del brand** con una LoRA: un piccolo "strato" che gli insegna le pelli, le cuciture e le finiture di quella maison. Il risultato non sembra un'immagine generica ma un prodotto di quel brand.

Siccome i pesi sono aperti, Qwen gira **sui nostri server** (un pod GPU su RunPod): i bozzetti e lo stile del brand non escono dall'azienda.

### Tappa 2 · Il prototipo 3D

Dalla foto del prodotto ricostruiamo il **modello 3D** con **TRELLIS.2**, il modello open di Microsoft (licenza MIT), insieme a **Hunyuan3D 2.1** di Tencent e **SAM 3D** di Meta. Il team li confronta e sceglie il migliore.

Il 3D serve a una cosa concreta: **verificare le misure** (28 × 22 × 10 cm) e far sì che la borsa abbia le proporzioni giuste in ogni foto e video successivo.

### Tappa 3 · I contenuti, pronti per i social

Con lo stesso Qwen Image e la LoRA del brand creiamo tutto quello che serve per lanciare il prodotto:

- foto prodotto (fronte, lato, retro)
- una scena lifestyle
- la borsa indossata da una modella
- scatti editoriali
- i fotogrammi dei reel con creator virtuali
- la pagina prodotto

È sempre la stessa borsa, in ogni immagine. Per i contenuti della Cabas sono serviti **circa 40 minuti di calcolo e 5 dollari**.

### Tappa 4 · Il test di mercato

I contenuti approvati diventano una **campagna social** (Instagram, TikTok, Pinterest) in quattro Paesi, con una pagina di **pre-ordine**.

Dopo 10 giorni e 2.500 euro di budget: 234 mila persone raggiunte e 40 pre-ordini. La scena lifestyle porta un pre-ordine a 37 €, meno della metà della foto prodotto (91 €).

*(Nella demo la risposta del pubblico è simulata, sui dati di lanci passati.)*

### Tappa 5 · La decisione

La previsione **non la fa l'intelligenza artificiale generativa**. La fa la statistica classica, confrontando questo test con i lanci passati del brand:

- **sell-through previsto: 74,5%**, sopra l'obiettivo del 65%
- **pezzi da ordinare: 710**

Verdetto: **GO**.

### Tappa 6 · Il cliente riscrive il prodotto

**Gemma 4**, il modello open di Google, legge i numeri del test, la previsione e i commenti in quattro lingue, e li trasforma in azioni su prodotto, contenuti e ordine. Gira su GPU AMD tramite **AMD Token Factory**.

Il 15% dei commenti chiede una tracolla, altri una tasca con la zip. Con un clic la modifica entra nel DNA del prodotto, e il giro successivo parte già corretto.

Alla fine **Evolus AI** riassume tutto (verdetto, previsione, commenti, azioni e rischi) in tre punti che il management legge in un minuto.

---

## 4. L'impatto

| | Oggi | Con Sartoria |
|---|---|---|
| Primo segnale dal mercato | 26 settimane | 10 giorni |
| Soldi spesi prima di sapere se vende | 163.850 € | 2.505 € |
| Campioni e shooting | 7.850 € | 5 $ di calcolo |

**Il messaggio:** il 98% in meno di capitale a rischio. E se il prodotto non convince, lo fermiamo prima di aver speso.

---

## 5. Perché modelli open

Tre motivi, detti semplici:

1. **Si possono addestrare sul brand.** Con Qwen Image e una LoRA il modello impara lo stile della maison. Con un modello chiuso non si può.
2. **I dati restano in casa.** I modelli girano sui nostri server: bozzetti e collezioni non ancora presentate non vanno a terzi.
3. **Costano poco e non dipendono da un fornitore.** Se domani esce un modello 3D migliore, lo sostituiamo senza cambiare il resto.

**Prossimo passo:** Gemma 4 oggi legge il test di mercato. Siccome vede anche le immagini, lo useremo come "occhio critico" del 3D: guarda il modello da più angoli, lo confronta con il bozzetto e dice quale versione è più fedele, o cosa rifare.

---

## 6. Chiusura

> Dieci giorni invece di sei mesi. Meno del 2% del capitale a rischio.
> **Sartoria: si produce solo quello che il mercato ha già scelto.**

---

### Modelli open citati

| Modello | Chi lo fa | Cosa fa in Sartoria |
|---|---|---|
| Qwen Image 2.1 + LoRA del brand | Alibaba | Disegna prodotto, foto, scene e fotogrammi nello stile del brand |
| TRELLIS.2 | Microsoft | Ricostruisce il 3D dalla foto (scelta di default) |
| Hunyuan3D 2.1 | Tencent | Ricostruzione 3D alternativa, spesso con texture migliori |
| SAM 3D | Meta | Ricostruzione 3D alternativa da una sola foto |
| Gemma 4 (su AMD Token Factory) | Google | Legge il test di mercato e i commenti, propone le modifiche. *Prossimo passo:* controlla il 3D e sceglie la versione più fedele |

### Servizi

| Servizio | Cosa fa in Sartoria |
|---|---|
| Evolus AI | Legge il documento di identità aziendale (anche PDF e scansioni) per ricavare le caratteristiche del brand, e riassume l'analisi di mercato alla fine |
